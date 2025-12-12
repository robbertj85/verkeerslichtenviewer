import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/lib/rate-limit';

interface Feature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    roadRegulatorName: string;
    tlc_organization: string;
    [key: string]: unknown;
  };
}

// Valid priority values for validation
const VALID_PRIORITIES = ['emergency', 'road_operator', 'public_transport', 'logistics', 'agriculture'];

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = rateLimit(`subjects:${clientId}`, rateLimitConfigs.dataApi);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimitConfigs.dataApi.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.reset),
          },
        }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Input validation
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const priority = searchParams.get('priority');

    // Validate page parameter
    let page = 1;
    if (pageParam) {
      page = parseInt(pageParam, 10);
      if (isNaN(page) || page < 1 || page > 10000) {
        return NextResponse.json(
          { error: 'Invalid page parameter. Must be a positive integer between 1 and 10000.' },
          { status: 400 }
        );
      }
    }

    // Validate limit parameter
    let limit = 100;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        return NextResponse.json(
          { error: 'Invalid limit parameter. Must be between 1 and 1000.' },
          { status: 400 }
        );
      }
    }

    // Validate priority parameter
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority parameter. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
          { status: 400 }
      );
    }

    // Read the GeoJSON file
    const dataPath = path.join(process.cwd(), 'public', 'data', 'traffic_lights.geojson');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Extract features
    let features: Feature[] = data.features;

    // Apply filters from query params
    const authority = searchParams.get('authority');
    const tlcOrganization = searchParams.get('tlc_organization');

    if (authority) {
      features = features.filter((f) =>
        f.properties.roadRegulatorName.toLowerCase() === authority.toLowerCase()
      );
    }

    if (priority) {
      const priorityKey = `has_${priority}`;
      features = features.filter((f) =>
        f.properties[priorityKey] === true
      );
    }

    if (tlcOrganization) {
      features = features.filter((f) =>
        f.properties.tlc_organization?.toLowerCase() === tlcOrganization.toLowerCase()
      );
    }

    // Pagination
    const offset = (page - 1) * limit;
    const paginatedFeatures = features.slice(offset, offset + limit);

    // Build response
    const response = {
      total: features.length,
      page,
      limit,
      total_pages: Math.ceil(features.length / limit),
      data: paginatedFeatures.map((f) => ({
        ...f.properties,
        coordinates: f.geometry.coordinates
      }))
    };

    return NextResponse.json(response, {
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
