/**
 * TypeScript types for UDAP Traffic Light data
 */

export interface TrafficLightProperties {
  type: 'traffic_light';
  id: string;
  name: string;
  identifier: string;
  latitude: number;
  longitude: number;
  roadRegulatorId: number | null;
  roadRegulatorName: string;
  subjectTypeName: string;
  // Priority categories
  has_emergency: boolean;
  has_road_operator: boolean;
  has_public_transport: boolean;
  has_logistics: boolean;
  has_agriculture: boolean;
  priorities: PriorityCategory[];
  priority_count: number;
  // Organizations
  tlc_organization: string;
  its_organization: string;
  ris_organization: string;
}

export type PriorityCategory =
  | 'emergency'
  | 'road_operator'
  | 'public_transport'
  | 'logistics'
  | 'agriculture';

export interface TrafficLightFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: TrafficLightProperties;
}

export interface TrafficLightData {
  type: 'FeatureCollection';
  metadata: {
    generated_at: string;
    total_traffic_lights: number;
    bounds: [number, number, number, number]; // [minx, miny, maxx, maxy]
    authorities: string[];
    tlc_organizations: string[];
    priority_categories: PriorityCategory[];
    source: string;
    source_url: string;
  };
  features: TrafficLightFeature[];
}

export interface Authority {
  name: string;
  slug: string;
  count: number;
}

export interface Summary {
  generated_at: string;
  total_traffic_lights: number;
  by_authority: Record<string, number>;
  by_tlc_organization: Record<string, number>;
  priority_stats: {
    emergency: number;
    road_operator: number;
    public_transport: number;
    logistics: number;
    agriculture: number;
  };
  source: string;
  source_url: string;
}

export interface Filters {
  // Authority filter
  authorities: string[];
  // Priority filters
  priorities: PriorityCategory[];
  // TLC Organization filter
  tlcOrganizations: string[];
  // Display options
  useSimpleMarkers: boolean;
  showLabels: boolean;
  // Boundary layers
  showBoundaries: boolean;
}

// Priority category display info
// Using SVG path data for clean, consistent icons
export const PRIORITY_INFO: Record<PriorityCategory, { name: string; color: string; icon: string; svgPath: string }> = {
  emergency: {
    name: 'Nood- en Hulpdiensten',
    color: '#dc2626',
    icon: '🚨',
    // Bell/alarm icon
    svgPath: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5'
  },
  road_operator: {
    name: 'Weginspecteur & Berging',
    color: '#f97316',
    icon: '🚧',
    // Wrench/tool icon
    svgPath: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z'
  },
  public_transport: {
    name: 'Openbaar Vervoer',
    color: '#2563eb',
    icon: '🚌',
    // Bus icon (simplified)
    svgPath: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12'
  },
  logistics: {
    name: 'Vrachtverkeer',
    color: '#16a34a',
    icon: '🚛',
    // Truck icon
    svgPath: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0V5.625c0-.621-.504-1.125-1.125-1.125H5.25c-.621 0-1.125.504-1.125 1.125v12m10.125-12h2.25c.621 0 1.152.416 1.32 1.007l1.68 5.93m0 0H14.25m2.25-6.937V9'
  },
  agriculture: {
    name: 'Landbouwverkeer',
    color: '#ca8a04',
    icon: '🚜',
    // Tractor/leaf icon (nature/agriculture)
    svgPath: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z'
  }
};

// Default filters
export const DEFAULT_FILTERS: Filters = {
  authorities: [],
  priorities: ['emergency', 'road_operator', 'public_transport', 'logistics', 'agriculture'],
  tlcOrganizations: [],
  useSimpleMarkers: false,
  showLabels: false,
  showBoundaries: false,
};
