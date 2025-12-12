import { NextRequest, NextResponse } from 'next/server';
import createMollieClient from '@mollie/api-client';
import { paymentStatuses } from '../webhook/route';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for status checks
    const clientId = getClientIdentifier(request);
    const rateLimitResult = rateLimit(`payment-status:${clientId}`, rateLimitConfigs.statusApi);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const sessionId = searchParams.get('sessionId');

    if (!paymentId && !sessionId) {
      return NextResponse.json({ error: 'Missing paymentId or sessionId' }, { status: 400 });
    }

    // Validate paymentId format (Mollie payment IDs start with tr_)
    if (paymentId && !/^tr_[a-zA-Z0-9]+$/.test(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID format' }, { status: 400 });
    }

    // Validate sessionId format (alphanumeric, dashes, and underscores)
    if (sessionId && !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // First check in-memory cache (populated by webhook)
    const cacheKey = paymentId || `session_${sessionId}`;
    const cachedStatus = paymentStatuses.get(cacheKey);

    if (cachedStatus) {
      return NextResponse.json({
        status: cachedStatus.status,
        isPaid: cachedStatus.status === 'paid',
        sessionId: cachedStatus.sessionId,
        tripCount: cachedStatus.tripCount,
      });
    }

    // If not in cache and we have a payment ID, fetch directly from Mollie
    if (paymentId) {
      const mollieApiKey = process.env.MOLLIE_API_KEY;
      if (!mollieApiKey) {
        return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
      }

      const mollieClient = createMollieClient({ apiKey: mollieApiKey });
      const payment = await mollieClient.payments.get(paymentId);
      const metadata = payment.metadata as { sessionId?: string; tripCount?: string } | null;

      return NextResponse.json({
        status: payment.status,
        isPaid: payment.status === 'paid',
        sessionId: metadata?.sessionId || '',
        tripCount: parseInt(metadata?.tripCount || '0', 10),
      });
    }

    // Session not found and no payment ID to look up
    return NextResponse.json({
      status: 'unknown',
      isPaid: false,
    });

  } catch (error) {
    // Log error without exposing details in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Payment status check error:', error);
    }
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
