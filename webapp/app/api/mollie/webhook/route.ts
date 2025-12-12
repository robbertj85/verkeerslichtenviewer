import { NextRequest, NextResponse } from 'next/server';
import createMollieClient from '@mollie/api-client';

// In-memory storage for payment statuses
// NOTE: For production with multiple instances, use Redis/Vercel KV/database
// This is exported so the status route can access it
export const paymentStatuses = new Map<string, {
  status: string;
  sessionId: string;
  tripCount: number;
  paidAt?: string;
}>();

// Clean up old payment statuses periodically (keep for 24 hours)
const PAYMENT_STATUS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const paymentTimestamps = new Map<string, number>();

function cleanupOldPayments() {
  const now = Date.now();
  for (const [key, timestamp] of paymentTimestamps.entries()) {
    if (now - timestamp > PAYMENT_STATUS_TTL) {
      paymentStatuses.delete(key);
      paymentTimestamps.delete(key);
    }
  }
}

// Run cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldPayments, 60 * 60 * 1000);
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from Mollie webhook
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const paymentId = formData.get('id');

    // Validate payment ID
    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
    }

    // Validate payment ID format (Mollie payment IDs start with tr_)
    if (!/^tr_[a-zA-Z0-9]+$/.test(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID format' }, { status: 400 });
    }

    const mollieApiKey = process.env.MOLLIE_API_KEY;
    if (!mollieApiKey) {
      if (process.env.NODE_ENV === 'development') {
        console.error('MOLLIE_API_KEY not configured');
      }
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const mollieClient = createMollieClient({ apiKey: mollieApiKey });

    // Verify payment with Mollie API (this is the security check)
    // We don't trust the webhook data, we fetch directly from Mollie
    const payment = await mollieClient.payments.get(paymentId);

    // Store the payment status
    const metadata = payment.metadata as { sessionId?: string; tripCount?: string } | null;
    const now = Date.now();

    paymentStatuses.set(paymentId, {
      status: payment.status,
      sessionId: metadata?.sessionId || '',
      tripCount: parseInt(metadata?.tripCount || '0', 10),
      paidAt: payment.paidAt || undefined,
    });
    paymentTimestamps.set(paymentId, now);

    // Also store by session ID for easier lookup
    if (metadata?.sessionId) {
      const sessionKey = `session_${metadata.sessionId}`;
      paymentStatuses.set(sessionKey, {
        status: payment.status,
        sessionId: metadata.sessionId,
        tripCount: parseInt(metadata.tripCount || '0', 10),
        paidAt: payment.paidAt || undefined,
      });
      paymentTimestamps.set(sessionKey, now);
    }

    // Log payment status update (non-sensitive info only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Payment ${paymentId} status updated: ${payment.status}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    // Log error without exposing details in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Mollie webhook error:', error);
    }
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
