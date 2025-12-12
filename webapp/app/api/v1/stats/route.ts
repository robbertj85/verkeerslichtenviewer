import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = rateLimit(`stats:${clientId}`, rateLimitConfigs.dataApi);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimitConfigs.dataApi.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Read the summary file
    const summaryPath = path.join(process.cwd(), 'public', 'data', 'summary.json');
    const fileContent = await fs.readFile(summaryPath, 'utf-8');
    const summary = JSON.parse(fileContent);

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'X-RateLimit-Limit': String(rateLimitConfigs.dataApi.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      }
    });

  } catch (error) {
    // Log error without exposing details in production
    if (process.env.NODE_ENV === 'development') {
      console.error('API error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
