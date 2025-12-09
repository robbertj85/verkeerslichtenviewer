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
export const PRIORITY_INFO: Record<PriorityCategory, { name: string; color: string; icon: string }> = {
  emergency: {
    name: 'Nood- en Hulpdiensten',
    color: '#dc2626',
    icon: '🚨'
  },
  road_operator: {
    name: 'Weginspecteur & Berging',
    color: '#f97316',
    icon: '🚧'
  },
  public_transport: {
    name: 'Openbaar Vervoer',
    color: '#2563eb',
    icon: '🚌'
  },
  logistics: {
    name: 'Vrachtverkeer',
    color: '#16a34a',
    icon: '🚛'
  },
  agriculture: {
    name: 'Landbouwverkeer',
    color: '#ca8a04',
    icon: '🚜'
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
