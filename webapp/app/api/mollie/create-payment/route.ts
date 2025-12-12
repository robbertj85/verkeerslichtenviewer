import { NextRequest, NextResponse } from 'next/server';
import createMollieClient from '@mollie/api-client';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/lib/rate-limit';

// Pricing constants
const FREE_TIER_MAX_ROUTES = 10;
const PRICE_PER_TRIP = 0.05; // €0.05 per trip above free tier
const MAX_ROUTES_PER_ANALYSIS = 1750;

// Production domain - enforce HTTPS
const PRODUCTION_BASE_URL = 'https://verkeerslichtenviewer.nl';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for payment creation (strict)
    const clientId = getClientIdentifier(request);
    const rateLimitResult = rateLimit(`payment-create:${clientId}`, rateLimitConfigs.paymentApi);

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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Type guard for body
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { tripCount, sessionId } = body as { tripCount?: unknown; sessionId?: unknown };

    // Validate tripCount
    if (tripCount === undefined || typeof tripCount !== 'number' || !Number.isInteger(tripCount)) {
      return NextResponse.json({ error: 'Invalid trip count. Must be an integer.' }, { status: 400 });
    }

    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Sanitize sessionId (alphanumeric, dashes, and underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // Check if within supported range
    if (tripCount <= FREE_TIER_MAX_ROUTES) {
      return NextResponse.json({ error: 'Trip count is within free tier' }, { status: 400 });
    }

    if (tripCount > MAX_ROUTES_PER_ANALYSIS) {
      return NextResponse.json({
        error: 'Trip count exceeds maximum supported',
        requiresContact: true
      }, { status: 400 });
    }

    // Calculate price: €0.05 per trip above 10
    const paidTrips = tripCount - FREE_TIER_MAX_ROUTES;
    const price = Math.round(paidTrips * PRICE_PER_TRIP * 100) / 100; // Round to 2 decimals
    const priceString = price.toFixed(2); // Format as "X.XX"

    const mollieApiKey = process.env.MOLLIE_API_KEY;
    if (!mollieApiKey) {
      if (process.env.NODE_ENV === 'development') {
        console.error('MOLLIE_API_KEY not configured');
      }
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const mollieClient = createMollieClient({ apiKey: mollieApiKey });

    // Determine base URL - prefer production URL, fallback to env var, then localhost for dev
    const isProduction = process.env.NODE_ENV === 'production';
    let baseUrl: string;

    if (isProduction) {
      // Always use HTTPS production URL in production
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL || PRODUCTION_BASE_URL;
      // Ensure HTTPS
      if (!baseUrl.startsWith('https://')) {
        baseUrl = baseUrl.replace('http://', 'https://');
      }
    } else {
      // Development mode
      baseUrl = request.headers.get('origin') || 'http://localhost:3000';
    }

    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    const paymentData: Parameters<typeof mollieClient.payments.create>[0] = {
      amount: {
        currency: 'EUR',
        value: priceString,
      },
      description: `Bulk analyse - ${tripCount} ritten (${paidTrips} x €0,05)`,
      redirectUrl: `${baseUrl}/transport-analysis?payment=success&session=${sessionId}`,
      metadata: {
        tripCount: tripCount.toString(),
        paidTrips: paidTrips.toString(),
        sessionId,
      },
    };

    // Only add webhook URL for production (Mollie can't reach localhost)
    if (!isLocalhost) {
      paymentData.webhookUrl = `${baseUrl}/api/mollie/webhook`;
    }

    const payment = await mollieClient.payments.create(paymentData);

    return NextResponse.json({
      paymentId: payment.id,
      checkoutUrl: payment.getCheckoutUrl(),
      amount: priceString,
      paidTrips,
    });

  } catch (error) {
    // Log error without exposing details in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Mollie payment creation error:', error);
    }
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
