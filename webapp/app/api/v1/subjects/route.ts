import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Read the GeoJSON file
    const dataPath = path.join(process.cwd(), 'public', 'data', 'traffic_lights.geojson');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Extract features
    let features: Feature[] = data.features;

    // Apply filters from query params
    const authority = searchParams.get('authority');
    const priority = searchParams.get('priority');
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
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
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
