/**
 * Types for Transport Analysis feature
 */

export type VehicleType = 'light' | 'heavy';
export type DataSource = 'tno_scenario' | 'tno_conservative' | 'operator';
export type CalculationMode = 'simple' | 'advanced';

export interface DataSourceInfo {
  id: DataSource;
  name: string;
  description: string;
  source: string;
  sourceUrl: string;
  // Fuel savings per avoided stop (liters diesel) for heavy vehicles
  heavyFuelSavingsPerStop: number;
  // Fuel savings per avoided stop (liters diesel) for light vehicles
  lightFuelSavingsPerStop: number;
}

export const DATA_SOURCES: Record<DataSource, DataSourceInfo> = {
  tno_scenario: {
    id: 'tno_scenario',
    name: 'TNO Scenario Model',
    description: 'Probabilistisch model met no-stop/slow-down/stop scenario\'s',
    source: 'Catalyst Heavy Duty Transport Living Lab',
    sourceUrl: 'https://publications.tno.nl/publication/34637725/OD9P2q/TNO-2020-P11453.pdf',
    // Based on median savings: 0.16 L for light, 0.12 L for heavy (Slow down - No stop)
    heavyFuelSavingsPerStop: 0.12, // liters diesel per scenario improvement
    lightFuelSavingsPerStop: 0.16,
  },
  tno_conservative: {
    id: 'tno_conservative',
    name: 'TNO (conservatief)',
    description: 'TNO onderzoek - lage schatting',
    source: 'TNO 2020 P11453',
    sourceUrl: 'https://publications.tno.nl/publication/34637725/OD9P2q/TNO-2020-P11453.pdf',
    heavyFuelSavingsPerStop: 0.12, // liters diesel per stop
    lightFuelSavingsPerStop: 0.16,
  },
  operator: {
    id: 'operator',
    name: 'Transportbedrijven',
    description: 'Praktijkmetingen van transportbedrijven (Vos Transport)',
    source: 'Talking Traffic / Vos Transport',
    sourceUrl: 'https://www.talking-traffic.com/nl/nieuws/brandstofbesparing-bij-ivri-s-voor-vrachtwagens-de-eerste-cijfers',
    heavyFuelSavingsPerStop: 1.0, // liters diesel per stop
    lightFuelSavingsPerStop: 0.5,
  },
};

export interface VehicleProfile {
  type: VehicleType;
  name: string;
  description: string;
}

export const VEHICLE_PROFILES: Record<VehicleType, VehicleProfile> = {
  light: {
    type: 'light',
    name: 'Licht vrachtverkeer',
    description: 'Vrachtwagens tot 30 ton',
  },
  heavy: {
    type: 'heavy',
    name: 'Zwaar vrachtverkeer',
    description: 'Vrachtwagens en LZV\'s boven 30 ton',
  },
};

// Get fuel savings per stop based on vehicle type and data source
export function getFuelSavingsPerStop(vehicleType: VehicleType, dataSource: DataSource): number {
  const source = DATA_SOURCES[dataSource];
  return vehicleType === 'heavy' ? source.heavyFuelSavingsPerStop : source.lightFuelSavingsPerStop;
}

// ============================================================================
// TNO Scenario-based model (from Catalyst/Heavy Duty Transport Living Lab)
// Based on cluster speed profiles and fuel consumption measurements
// ============================================================================

export type PassageScenario = 'no_stop' | 'slow_down' | 'stop';

export interface ScenarioDistribution {
  no_stop: number;  // Probability (0-1)
  slow_down: number;
  stop: number;
}

export interface ScenarioFuelConsumption {
  no_stop: number;  // Liters per 2000m passage
  slow_down: number;
  stop: number;
}

// Observed passage distributions without priority (TNO measurements)
// Source: Catalyst Heavy Duty Transport Living Lab, slide 57
export const TNO_PASSAGE_DISTRIBUTION: Record<VehicleType, ScenarioDistribution> = {
  light: {
    // Light trucks (<30t): n=213 passages
    no_stop: 84 / 213,    // 39.4%
    slow_down: 98 / 213,  // 46.0%
    stop: 31 / 213,       // 14.6%
  },
  heavy: {
    // Heavy trucks (>30t): n=686 passages
    no_stop: 291 / 686,   // 42.4%
    slow_down: 251 / 686, // 36.6%
    stop: 144 / 686,      // 21.0%
  },
};

// Fuel consumption per scenario (median values from boxplots)
// Source: Catalyst Heavy Duty Transport Living Lab, fuel consumption measurements
// "Median savings are in the same order of magnitude: 0.16 l for light and 0.12 l for heavy"
export const TNO_FUEL_CONSUMPTION: Record<VehicleType, ScenarioFuelConsumption> = {
  light: {
    // Lighter trucks (<30t) - fuel consumption over 2000m passage
    no_stop: 0.477,    // Median from boxplot
    slow_down: 0.636,  // Median from boxplot
    stop: 0.80,        // Estimated from pattern (Stop - No stop ≈ 0.32 L)
  },
  heavy: {
    // Heavier trucks (>30t) - fuel consumption over 2000m passage
    no_stop: 0.57,     // Median from boxplot
    slow_down: 0.68,   // Median from boxplot
    stop: 0.85,        // Median from boxplot
  },
};

// Priority success rate: 60% of priority requests are granted
// Based on research findings
export const PRIORITY_SUCCESS_RATE = 0.60;

// Expected distribution WITH priority (calculated from base distribution + 60% success rate)
// Formula:
//   - no_stop: base_no_stop + (success_rate × base_slow_down) + (success_rate × base_stop)
//   - slow_down: (1 - success_rate) × base_slow_down
//   - stop: (1 - success_rate) × base_stop
export const TNO_PASSAGE_DISTRIBUTION_WITH_PRIORITY: Record<VehicleType, ScenarioDistribution> = {
  light: {
    // 39.4% + (60% × 46.0%) + (60% × 14.6%) = 75.76%
    no_stop: 0.394 + (PRIORITY_SUCCESS_RATE * 0.460) + (PRIORITY_SUCCESS_RATE * 0.146),  // 75.76%
    // 40% × 46.0% = 18.4%
    slow_down: (1 - PRIORITY_SUCCESS_RATE) * 0.460,  // 18.4%
    // 40% × 14.6% = 5.84%
    stop: (1 - PRIORITY_SUCCESS_RATE) * 0.146,       // 5.84%
  },
  heavy: {
    // 42.4% + (60% × 36.6%) + (60% × 21.0%) = 76.96%
    no_stop: 0.424 + (PRIORITY_SUCCESS_RATE * 0.366) + (PRIORITY_SUCCESS_RATE * 0.210),  // 76.96%
    // 40% × 36.6% = 14.64%
    slow_down: (1 - PRIORITY_SUCCESS_RATE) * 0.366,  // 14.64%
    // 40% × 21.0% = 8.4%
    stop: (1 - PRIORITY_SUCCESS_RATE) * 0.210,       // 8.4%
  },
};

// Calculate expected fuel consumption based on scenario probabilities
export function calculateExpectedFuelConsumption(
  vehicleType: VehicleType,
  distribution: ScenarioDistribution
): number {
  const fuel = TNO_FUEL_CONSUMPTION[vehicleType];
  return (
    distribution.no_stop * fuel.no_stop +
    distribution.slow_down * fuel.slow_down +
    distribution.stop * fuel.stop
  );
}

// Calculate fuel savings per passage with priority
export function calculateTNOFuelSavingsPerPassage(vehicleType: VehicleType): {
  withoutPriority: number;
  withPriority: number;
  savings: number;
  scenarioBreakdown: {
    scenario: PassageScenario;
    probabilityWithout: number;
    probabilityWith: number;
    fuelConsumption: number;
  }[];
} {
  const distWithout = TNO_PASSAGE_DISTRIBUTION[vehicleType];
  const distWith = TNO_PASSAGE_DISTRIBUTION_WITH_PRIORITY[vehicleType];
  const fuel = TNO_FUEL_CONSUMPTION[vehicleType];

  const withoutPriority = calculateExpectedFuelConsumption(vehicleType, distWithout);
  const withPriority = calculateExpectedFuelConsumption(vehicleType, distWith);

  return {
    withoutPriority,
    withPriority,
    savings: withoutPriority - withPriority,
    scenarioBreakdown: [
      {
        scenario: 'no_stop',
        probabilityWithout: distWithout.no_stop,
        probabilityWith: distWith.no_stop,
        fuelConsumption: fuel.no_stop,
      },
      {
        scenario: 'slow_down',
        probabilityWithout: distWithout.slow_down,
        probabilityWith: distWith.slow_down,
        fuelConsumption: fuel.slow_down,
      },
      {
        scenario: 'stop',
        probabilityWithout: distWithout.stop,
        probabilityWith: distWith.stop,
        fuelConsumption: fuel.stop,
      },
    ],
  };
}

// CO2 per liter diesel (kg)
export const CO2_PER_LITER_DIESEL = 2.64;

// NOx per liter diesel at idle (grams)
export const NOX_PER_LITER_DIESEL_IDLE = 85;

// Current monetary values (2024)
export const MONETARY_VALUES = {
  // Diesel price per liter (EUR)
  dieselPricePerLiter: 1.65,
  // CO2 price per tonne (EUR) - EU ETS 2024
  co2PricePerTonne: 65,
  // NOx damage cost per kg (EUR) - eco-costs 2024
  noxDamageCostPerKg: 6.12,
};

export interface RoutePoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface RouteAnalysis {
  origin: RoutePoint;
  destination: RoutePoint;
  vehicleType: VehicleType;
  // Route data from OpenRouteService
  routeGeometry: [number, number][]; // [lng, lat] pairs
  distanceKm: number;
  durationMinutes: number;
  // Traffic light analysis
  trafficLightsOnRoute: number;
  trafficLightsWithLogistics: number;
  // Savings calculations per source
  savingsBySource: Record<DataSource, RouteSavings>;
  // Min/max bandwidth
  savingsBandwidth: SavingsBandwidth;
}

export interface SavingsBandwidth {
  // Minimum values (conservative estimate)
  minFuelSavingsLiters: number;
  minCo2SavingsKg: number;
  minNoxSavingsGrams: number;
  minTotalSocietalSavings: number;
  minAnnualTotalSavings: number;
  // Maximum values (operator estimate)
  maxFuelSavingsLiters: number;
  maxCo2SavingsKg: number;
  maxNoxSavingsGrams: number;
  maxTotalSocietalSavings: number;
  maxAnnualTotalSavings: number;
}

export interface ScenarioBreakdownItem {
  scenario: PassageScenario;
  scenarioLabel: string;
  probabilityWithout: number;
  probabilityWith: number;
  fuelConsumption: number;
  passagesWithout: number;
  passagesWith: number;
}

export interface RouteSavings {
  dataSource: DataSource;
  // Per trip savings
  fuelSavingsLiters: number;
  co2SavingsKg: number;
  noxSavingsGrams: number;
  // Monetary savings per trip
  fuelCostSavings: number;
  co2SocietalSavings: number;
  noxSocietalSavings: number;
  totalSocietalSavings: number;
  // Annual projections (assuming 250 working days, 2 trips per day)
  annualTrips: number;
  annualFuelSavingsLiters: number;
  annualCo2SavingsKg: number;
  annualNoxSavingsGrams: number;
  annualTotalSavings: number;
  // Scenario breakdown (only for tno_scenario source)
  scenarioBreakdown?: ScenarioBreakdownItem[];
  expectedFuelWithout?: number;
  expectedFuelWith?: number;
}

export interface BulkAnalysisRow {
  origin: string;
  destination: string;
  // Optional: coordinates (if provided, skip geocoding)
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  // Optional: postal codes (can be used for geocoding fallback)
  originPostalCode?: string;
  destinationPostalCode?: string;
  vehicleType?: VehicleType;
  tripsPerDay?: number;
  // Optional: license plate for RDW lookup (from CBS XML)
  licenseNumber?: string;
  // Optional: timestamp for individual trips
  timestamp?: string;
}

// RDW vehicle details for display in results
export interface RDWVehicleDetails {
  licenseNumber: string;
  brand: string;                    // merk
  model?: string;                   // handelsbenaming
  vehicleType: string;              // voertuigsoort (e.g., "Bedrijfsauto")
  euCategory: string;               // europese_voertuigcategorie (N1, N2, N3, M1)
  emptyWeightKg?: number;           // massa_ledig_voertuig
  maxCombinationWeightKg?: number;  // maximum_massa_samenstelling
}

export interface BulkAnalysisResult {
  rowIndex: number;
  originName: string;
  destinationName: string;
  origin: RoutePoint;
  destination: RoutePoint;
  vehicleType: VehicleType;
  routeGeometry: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  trafficLightsOnRoute: number;
  trafficLightsWithLogistics: number;
  savingsBySource: Record<DataSource, RouteSavings>;
  savingsBandwidth: SavingsBandwidth;
  error?: string;
  // Optional: RDW vehicle details (from CBS XML with license plate lookup)
  rdwVehicleDetails?: RDWVehicleDetails;
}

// Example route: Zestienhoven Rotterdam to Bleiswijk via N209
export const EXAMPLE_ROUTE = {
  origin: {
    lat: 51.9569,
    lng: 4.4377,
    name: 'Rotterdam The Hague Airport', // Will be geocoded via PDOK
  },
  destination: {
    lat: 52.0167,
    lng: 4.5333,
    name: 'Bleiswijk', // Will be geocoded via PDOK
  },
  // Search strings for address inputs (optimized for PDOK)
  originSearch: 'Rotterdam The Hague Airport',
  destinationSearch: 'Bleiswijk centrum',
  description: 'Route via N209 - een typische logistieke corridor in de regio Rotterdam',
};

// ============================================================================
// Simple Mode - Two-value bandwidth calculation
// ============================================================================

// Simple mode uses two fixed values for quick estimates:
// - Conservative (Low): TNO rule of thumb 0.12 L/stop for heavy trucks
// - Liberal (High): Operator practical measurement 1 L/stop

export const SIMPLE_MODE_VALUES = {
  heavy: {
    conservative: 0.12, // TNO rule of thumb
    liberal: 1.0,       // Operator practical measurement (1L per stop)
  },
  light: {
    conservative: 0.16, // TNO conservative for light
    liberal: 0.5,       // Operator practical measurement
  },
};

// ============================================================================
// Advanced Mode - Per-traffic-light scenario calculation
// ============================================================================

// Scenario assigned to each traffic light in advanced mode
export type TrafficLightScenario = 'no_stop' | 'slow_down' | 'stop';

export interface TrafficLightWithScenario {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  hasLogistics: boolean;
  // Calculated scenario (probabilistic assignment based on TNO distribution)
  expectedScenarioWithout: TrafficLightScenario;
  expectedScenarioWith: TrafficLightScenario;
  // Expected fuel consumption at this specific traffic light
  fuelWithout: number;
  fuelWith: number;
  fuelSavings: number;
}

export interface SimpleModeResult {
  mode: 'simple';
  trafficLightsWithLogistics: number;
  // Conservative (low) estimate - TNO 0.12L rule of thumb
  conservative: {
    fuelSavingsLiters: number;
    co2SavingsKg: number;
    noxSavingsGrams: number;
    // Business benefits (what companies can capture)
    businessFuelCostSavings: number;      // Fuel cost savings
    annualBusinessSavings: number;        // Annual fuel cost savings
    // Societal benefits (externalities - CO2 and NOx damage costs)
    societalCo2Savings: number;           // CO2 damage cost savings
    societalNoxSavings: number;           // NOx damage cost savings
    totalSocietalSavings: number;         // Total externality savings (CO2 + NOx only)
    annualSocietalSavings: number;        // Annual externality savings
    // Combined totals (for backward compatibility)
    totalCombinedSavings: number;         // Business + Societal per trip
    annualTotalSavings: number;           // Annual combined savings
  };
  // Liberal (high) estimate - 1L per stop
  liberal: {
    fuelSavingsLiters: number;
    co2SavingsKg: number;
    noxSavingsGrams: number;
    // Business benefits (what companies can capture)
    businessFuelCostSavings: number;
    annualBusinessSavings: number;
    // Societal benefits (externalities)
    societalCo2Savings: number;
    societalNoxSavings: number;
    totalSocietalSavings: number;
    annualSocietalSavings: number;
    // Combined totals
    totalCombinedSavings: number;
    annualTotalSavings: number;
  };
}

export interface AdvancedModeResult {
  mode: 'advanced';
  trafficLightsWithLogistics: number;
  // Per-traffic-light breakdown with scenarios
  trafficLightScenarios: TrafficLightWithScenario[];
  // Aggregated savings
  totalFuelSavingsLiters: number;
  totalCo2SavingsKg: number;
  totalNoxSavingsGrams: number;
  // Business benefits (what companies can capture)
  businessFuelCostSavings: number;
  annualBusinessSavings: number;
  // Societal benefits (externalities - CO2 and NOx damage costs)
  societalCo2Savings: number;
  societalNoxSavings: number;
  totalSocietalSavings: number;
  annualSocietalSavings: number;
  // Combined totals
  totalCombinedSavings: number;
  annualTotalSavings: number;
  // Scenario counts
  scenarioCounts: {
    without: { no_stop: number; slow_down: number; stop: number };
    with: { no_stop: number; slow_down: number; stop: number };
  };
}

// ============================================================================
// CBS Wegvervoer XML Schema Types (Realised Trips)
// Source: https://www.cbs.nl/-/media/cbsvooruwbedrijf/xml-vanuit-transportmanagementsysteem/
// ============================================================================

// Location type from CBS schema
export interface CBSLocation {
  locationCategory?: string;  // enum: 1-10, ZZ
  locationCode?: string;
  postalCode?: string;
  countryCode?: string;
  locationName: string;       // 1-70 chars
  locationLatitude?: string;
  locationLongitude?: string;
}

// Shipment within a journey
export interface CBSShipment {
  grossWeight?: number;       // kg, up to 6 digits
  quantity?: number;
  shipmentDistance: number;   // km, up to 5 digits
  loadingLocation: CBSLocation;
  unloadingLocation: CBSLocation;
}

// Journey (trip) from CBS schema
export interface CBSJourney {
  typeOfTransport: string;    // enum: 1, 2, Z
  startDateTimeJourney: string;
  startJourney: CBSLocation;  // Origin
  endDateTimeJourney?: string;
  endJourney: CBSLocation;    // Destination
  journeyDistance: number;    // km, up to 5 digits
  shipments: CBSShipment[];
  loadedVolume?: number;
  loadedSurface?: number;
}

// Motor vehicle from CBS schema
export interface CBSMotorVehicle {
  licenseNumber: string;      // 1-12 chars (kenteken)
  countryCode?: string;
  vehicleActivity: string;    // enum: 0-5, Z
  emptyWeight?: number;       // kg (from trailer info)
  loadingCapacity?: number;   // kg (from trailer info)
  journeys: CBSJourney[];
}

// Parsed CBS trip for bulk analysis
export interface CBSTrip {
  licenseNumber: string;
  origin: string;
  destination: string;
  cargoWeightKg?: number;
  vehicleType: VehicleType;   // Determined from license plate pattern or cargo weight
  journeyDate?: string;
}

// Weight threshold for heavy vs light vehicle classification
// Based on Dutch vehicle classification: >3500 kg GVW = heavy
export const CBS_HEAVY_VEHICLE_THRESHOLD_KG = 3500;

// ============================================================================
// RDW (Dutch Vehicle Registration Authority) Open Data Types
// API: https://opendata.rdw.nl/resource/m9d7-ebf2.json
// ============================================================================

export interface RDWVehicleInfo {
  kenteken: string;                         // License plate (normalized, no dashes)
  merk: string;                             // Brand (e.g., "VOLVO", "DAF", "MAN")
  handelsbenaming?: string;                 // Commercial name/model
  voertuigsoort: string;                    // Vehicle type (e.g., "Bedrijfsauto", "Personenauto")
  europese_voertuigcategorie: string;       // EU category (N1, N2, N3 for trucks, M1 for cars)
  massa_ledig_voertuig?: number;            // Empty weight in kg
  maximum_massa_samenstelling?: number;     // Maximum combination weight in kg (truck + trailer)
  toegestane_maximum_massa_voertuig?: number; // GVW (Gross Vehicle Weight) in kg
  // Additional useful fields
  eerste_kleur?: string;                    // Color
  aantal_assen?: number;                    // Number of axles
  lengte?: number;                          // Length in cm
  inrichting?: string;                      // Body type (e.g., "gesloten opbouw")
}

// European vehicle categories for trucks/commercial vehicles
// N1: Light commercial <= 3.5t
// N2: Medium commercial 3.5t - 12t
// N3: Heavy commercial > 12t
export const EU_HEAVY_VEHICLE_CATEGORIES = ['N2', 'N3'];
export const EU_LIGHT_COMMERCIAL_CATEGORIES = ['N1'];

// Vehicle types that indicate commercial transport
export const COMMERCIAL_VEHICLE_TYPES = [
  'Bedrijfsauto',           // Commercial vehicle
  'Aanhangwagen',           // Trailer
  'Oplegger',               // Semi-trailer
  'Autonome aanhangwagen',  // Autonomous trailer
];

// Determine vehicle type based on RDW data
export function classifyVehicleFromRDW(rdwInfo: RDWVehicleInfo): VehicleType {
  // Check EU vehicle category first (most reliable)
  if (EU_HEAVY_VEHICLE_CATEGORIES.includes(rdwInfo.europese_voertuigcategorie)) {
    return 'heavy';
  }
  if (EU_LIGHT_COMMERCIAL_CATEGORIES.includes(rdwInfo.europese_voertuigcategorie)) {
    return 'light';
  }

  // Check maximum combination weight (for truck+trailer combinations)
  if (rdwInfo.maximum_massa_samenstelling && rdwInfo.maximum_massa_samenstelling > CBS_HEAVY_VEHICLE_THRESHOLD_KG) {
    return 'heavy';
  }

  // Check GVW
  if (rdwInfo.toegestane_maximum_massa_voertuig && rdwInfo.toegestane_maximum_massa_voertuig > CBS_HEAVY_VEHICLE_THRESHOLD_KG) {
    return 'heavy';
  }

  // Check empty weight (heavy trucks typically > 3000 kg empty)
  if (rdwInfo.massa_ledig_voertuig && rdwInfo.massa_ledig_voertuig > 3000) {
    return 'heavy';
  }

  // Default to light for N1 and M1 categories
  return 'light';
}

// Determine vehicle type based on license plate pattern and cargo weight (fallback)
export function classifyCBSVehicle(
  licenseNumber: string,
  cargoWeightKg?: number,
  loadingCapacityKg?: number
): VehicleType {
  // If we have cargo weight or loading capacity info, use that
  if (cargoWeightKg && cargoWeightKg > CBS_HEAVY_VEHICLE_THRESHOLD_KG) {
    return 'heavy';
  }
  if (loadingCapacityKg && loadingCapacityKg > CBS_HEAVY_VEHICLE_THRESHOLD_KG) {
    return 'heavy';
  }

  // Dutch license plate patterns for heavy vehicles:
  // Commercial vehicles (vrachtwagens) often have specific patterns
  // B-series plates (e.g., BX-XX-XX) are common for trucks
  // V-series plates for heavy commercial
  const licensePlateUpper = licenseNumber.toUpperCase().replace(/[-\s]/g, '');

  // Patterns indicating heavy vehicles (trucks, trailers)
  // Note: This is a heuristic, not definitive
  const heavyPatterns = [
    /^B[A-Z]{1,2}\d{2,4}[A-Z]{0,2}$/,  // B-series commercial
    /^V[A-Z]{1,2}\d{2,4}[A-Z]{0,2}$/,  // V-series
    /^\d{2}B[A-Z]{2,3}\d?$/,            // XX-BXX format
  ];

  for (const pattern of heavyPatterns) {
    if (pattern.test(licensePlateUpper)) {
      return 'heavy';
    }
  }

  // Default to heavy for road transport survey data (most are commercial vehicles)
  // The CBS Wegvervoer survey specifically targets commercial road transport
  return 'heavy';
}
