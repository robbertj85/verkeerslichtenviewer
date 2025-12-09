import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface TrafficLightProperties {
  id: string;
  name: string;
  identifier: string;
  latitude: number;
  longitude: number;
  roadRegulatorId: number | null;
  roadRegulatorName: string;
  subjectTypeName: string;
  has_emergency: boolean;
  has_road_operator: boolean;
  has_public_transport: boolean;
  has_logistics: boolean;
  has_agriculture: boolean;
  priorities: string[];
  priority_count: number;
  tlc_organization: string;
  its_organization: string;
  ris_organization: string;
}

interface TrafficLightFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: TrafficLightProperties;
}

interface TrafficLightData {
  type: 'FeatureCollection';
  metadata: Record<string, unknown>;
  features: TrafficLightFeature[];
}

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get('format') || 'geojson';

    // Read the GeoJSON file
    const dataPath = path.join(process.cwd(), 'public', 'data', 'traffic_lights.geojson');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const data: TrafficLightData = JSON.parse(fileContent);

    switch (format.toLowerCase()) {
      case 'geojson': {
        return new NextResponse(JSON.stringify(data, null, 2), {
          headers: {
            'Content-Type': 'application/geo+json',
            'Content-Disposition': 'attachment; filename="udap-traffic-lights.geojson"',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      case 'json': {
        // Convert to flat JSON array
        const jsonData = data.features.map((f: TrafficLightFeature) => ({
          ...f.properties,
          longitude: f.geometry.coordinates[0],
          latitude: f.geometry.coordinates[1],
        }));

        return new NextResponse(JSON.stringify(jsonData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="udap-traffic-lights.json"',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      case 'csv': {
        // Build CSV
        const headers = [
          'id',
          'name',
          'identifier',
          'latitude',
          'longitude',
          'roadRegulatorId',
          'roadRegulatorName',
          'subjectTypeName',
          'has_emergency',
          'has_road_operator',
          'has_public_transport',
          'has_logistics',
          'has_agriculture',
          'priority_count',
          'tlc_organization',
          'its_organization',
          'ris_organization',
        ];

        const rows = data.features.map((f: TrafficLightFeature) => {
          const props = f.properties;
          return [
            props.id,
            `"${props.name?.replace(/"/g, '""') || ''}"`,
            props.identifier,
            props.latitude,
            props.longitude,
            props.roadRegulatorId || '',
            `"${props.roadRegulatorName?.replace(/"/g, '""') || ''}"`,
            props.subjectTypeName,
            props.has_emergency,
            props.has_road_operator,
            props.has_public_transport,
            props.has_logistics,
            props.has_agriculture,
            props.priority_count,
            `"${props.tlc_organization?.replace(/"/g, '""') || ''}"`,
            `"${props.its_organization?.replace(/"/g, '""') || ''}"`,
            `"${props.ris_organization?.replace(/"/g, '""') || ''}"`,
          ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="udap-traffic-lights.csv"',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      default:
        return NextResponse.json(
          { error: `Unsupported format: ${format}. Use geojson, json, or csv.` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
