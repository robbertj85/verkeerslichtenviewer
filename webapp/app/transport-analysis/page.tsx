'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dynamic from 'next/dynamic';
import AddressInput from '@/components/AddressInput';
import {
  VehicleType,
  DataSource,
  CalculationMode,
  DATA_SOURCES,
  VEHICLE_PROFILES,
  MONETARY_VALUES,
  RoutePoint,
  RouteAnalysis,
  RouteSavings,
  SavingsBandwidth,
  BulkAnalysisRow,
  BulkAnalysisResult,
  EXAMPLE_ROUTE,
  getFuelSavingsPerStop,
  CO2_PER_LITER_DIESEL,
  NOX_PER_LITER_DIESEL_IDLE,
  TNO_PASSAGE_DISTRIBUTION,
  TNO_PASSAGE_DISTRIBUTION_WITH_PRIORITY,
  TNO_FUEL_CONSUMPTION,
  ScenarioBreakdownItem,
  SIMPLE_MODE_VALUES,
  SimpleModeResult,
  AdvancedModeResult,
  TrafficLightWithScenario,
  TrafficLightScenario,
  RDWVehicleInfo,
  RDWVehicleDetails,
  classifyVehicleFromRDW,
} from '@/types/transport-analysis';
import { TrafficLightData, TrafficLightFeature } from '@/types/traffic-lights';

// Scenario labels for display
const SCENARIO_LABELS: Record<TrafficLightScenario, string> = {
  no_stop: 'Geen stop',
  slow_down: 'Afremmen',
  stop: 'Stop',
};

// Dynamically import the route map to avoid SSR issues
const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Kaart laden...</p>
      </div>
    </div>
  ),
});

// Dynamically import the bulk route map
const BulkRouteMap = dynamic(() => import('@/components/BulkRouteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg" style={{ minHeight: '400px' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Kaart laden...</p>
      </div>
    </div>
  ),
});

// Helper: Calculate distance between two points (Haversine formula)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Point to line segment distance
function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx: number, yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

// Helper: Find closest point on a line segment to a given point
function closestPointOnSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return [x1, y1];
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return [x1 + t * dx, y1 + t * dy];
}

// Helper: Check if a point is within a distance of a route (using proper Haversine)
function isPointNearRoute(
  point: [number, number],
  route: [number, number][],
  thresholdKm: number
): boolean {
  const [lng, lat] = point;

  for (let i = 0; i < route.length - 1; i++) {
    const [lng1, lat1] = route[i];
    const [lng2, lat2] = route[i + 1];

    // Quick bounding box check (with margin based on threshold)
    const margin = thresholdKm / 111; // ~1 degree = 111 km
    const minLng = Math.min(lng1, lng2) - margin;
    const maxLng = Math.max(lng1, lng2) + margin;
    const minLat = Math.min(lat1, lat2) - margin;
    const maxLat = Math.max(lat1, lat2) + margin;

    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
      continue;
    }

    // Find closest point on segment
    const [closestLng, closestLat] = closestPointOnSegment(lng, lat, lng1, lat1, lng2, lat2);

    // Calculate actual distance using Haversine
    const distanceKm = haversineDistance(lat, lng, closestLat, closestLng);

    if (distanceKm < thresholdKm) {
      return true;
    }
  }

  return false;
}

// Calculate savings for a specific data source
function calculateSavingsForSource(
  trafficLightsWithLogistics: number,
  vehicleType: VehicleType,
  dataSource: DataSource,
  tripsPerDay: number = 2,
  workingDaysPerYear: number = 250
): RouteSavings {
  let fuelSavingsLiters: number;
  let scenarioBreakdown: ScenarioBreakdownItem[] | undefined;
  let expectedFuelWithout: number | undefined;
  let expectedFuelWith: number | undefined;

  if (dataSource === 'tno_scenario') {
    // Use probabilistic scenario model
    const distWithout = TNO_PASSAGE_DISTRIBUTION[vehicleType];
    const distWith = TNO_PASSAGE_DISTRIBUTION_WITH_PRIORITY[vehicleType];
    const fuel = TNO_FUEL_CONSUMPTION[vehicleType];

    // Calculate expected fuel consumption per passage (for all traffic lights with logistics)
    expectedFuelWithout = (
      distWithout.no_stop * fuel.no_stop +
      distWithout.slow_down * fuel.slow_down +
      distWithout.stop * fuel.stop
    );
    expectedFuelWith = (
      distWith.no_stop * fuel.no_stop +
      distWith.slow_down * fuel.slow_down +
      distWith.stop * fuel.stop
    );

    // Fuel savings per passage
    const savingsPerPassage = expectedFuelWithout - expectedFuelWith;
    fuelSavingsLiters = trafficLightsWithLogistics * savingsPerPassage;

    // Build scenario breakdown
    scenarioBreakdown = [
      {
        scenario: 'no_stop',
        scenarioLabel: SCENARIO_LABELS.no_stop,
        probabilityWithout: distWithout.no_stop,
        probabilityWith: distWith.no_stop,
        fuelConsumption: fuel.no_stop,
        passagesWithout: Math.round(trafficLightsWithLogistics * distWithout.no_stop),
        passagesWith: Math.round(trafficLightsWithLogistics * distWith.no_stop),
      },
      {
        scenario: 'slow_down',
        scenarioLabel: SCENARIO_LABELS.slow_down,
        probabilityWithout: distWithout.slow_down,
        probabilityWith: distWith.slow_down,
        fuelConsumption: fuel.slow_down,
        passagesWithout: Math.round(trafficLightsWithLogistics * distWithout.slow_down),
        passagesWith: Math.round(trafficLightsWithLogistics * distWith.slow_down),
      },
      {
        scenario: 'stop',
        scenarioLabel: SCENARIO_LABELS.stop,
        probabilityWithout: distWithout.stop,
        probabilityWith: distWith.stop,
        fuelConsumption: fuel.stop,
        passagesWithout: Math.round(trafficLightsWithLogistics * distWithout.stop),
        passagesWith: Math.round(trafficLightsWithLogistics * distWith.stop),
      },
    ];
  } else {
    // Use simple model (assuming priority reduces stops by ~70%)
    const stopsAvoided = trafficLightsWithLogistics * 0.7;
    const fuelSavingsPerStop = getFuelSavingsPerStop(vehicleType, dataSource);
    fuelSavingsLiters = stopsAvoided * fuelSavingsPerStop;
  }

  const co2SavingsKg = fuelSavingsLiters * CO2_PER_LITER_DIESEL;
  const noxSavingsGrams = fuelSavingsLiters * NOX_PER_LITER_DIESEL_IDLE;

  // Monetary savings per trip
  const fuelCostSavings = fuelSavingsLiters * MONETARY_VALUES.dieselPricePerLiter;
  const co2SocietalSavings = (co2SavingsKg / 1000) * MONETARY_VALUES.co2PricePerTonne;
  const noxSocietalSavings = (noxSavingsGrams / 1000) * MONETARY_VALUES.noxDamageCostPerKg;
  const totalSocietalSavings = fuelCostSavings + co2SocietalSavings + noxSocietalSavings;

  // Annual projections
  const annualTrips = tripsPerDay * workingDaysPerYear;

  return {
    dataSource,
    fuelSavingsLiters,
    co2SavingsKg,
    noxSavingsGrams,
    fuelCostSavings,
    co2SocietalSavings,
    noxSocietalSavings,
    totalSocietalSavings,
    annualTrips,
    annualFuelSavingsLiters: fuelSavingsLiters * annualTrips,
    annualCo2SavingsKg: co2SavingsKg * annualTrips,
    annualNoxSavingsGrams: noxSavingsGrams * annualTrips,
    annualTotalSavings: totalSocietalSavings * annualTrips,
    scenarioBreakdown,
    expectedFuelWithout,
    expectedFuelWith,
  };
}

// Calculate savings for all sources and compute bandwidth
function calculateAllSavings(
  trafficLightsWithLogistics: number,
  vehicleType: VehicleType,
  tripsPerDay: number = 2,
  workingDaysPerYear: number = 250
): { savingsBySource: Record<DataSource, RouteSavings>; bandwidth: SavingsBandwidth } {
  const sources: DataSource[] = ['tno_scenario', 'tno_conservative', 'operator'];
  const savingsBySource: Record<DataSource, RouteSavings> = {} as Record<DataSource, RouteSavings>;

  for (const source of sources) {
    savingsBySource[source] = calculateSavingsForSource(
      trafficLightsWithLogistics,
      vehicleType,
      source,
      tripsPerDay,
      workingDaysPerYear
    );
  }

  // Calculate bandwidth (min = scenario model, max = operator)
  const bandwidth: SavingsBandwidth = {
    minFuelSavingsLiters: savingsBySource.tno_scenario.fuelSavingsLiters,
    minCo2SavingsKg: savingsBySource.tno_scenario.co2SavingsKg,
    minNoxSavingsGrams: savingsBySource.tno_scenario.noxSavingsGrams,
    minTotalSocietalSavings: savingsBySource.tno_scenario.totalSocietalSavings,
    minAnnualTotalSavings: savingsBySource.tno_scenario.annualTotalSavings,
    maxFuelSavingsLiters: savingsBySource.operator.fuelSavingsLiters,
    maxCo2SavingsKg: savingsBySource.operator.co2SavingsKg,
    maxNoxSavingsGrams: savingsBySource.operator.noxSavingsGrams,
    maxTotalSocietalSavings: savingsBySource.operator.totalSocietalSavings,
    maxAnnualTotalSavings: savingsBySource.operator.annualTotalSavings,
  };

  return { savingsBySource, bandwidth };
}

// ============================================================================
// Simple Mode Calculation
// Uses two fixed values: TNO 0.12L (conservative) and 1L/stop (liberal)
// ============================================================================
function calculateSimpleModeSavings(
  trafficLightsWithLogistics: number,
  vehicleType: VehicleType,
  tripsPerDay: number = 2,
  workingDaysPerYear: number = 250
): SimpleModeResult {
  const values = SIMPLE_MODE_VALUES[vehicleType];
  const annualTrips = tripsPerDay * workingDaysPerYear;

  // Conservative estimate (TNO 0.12L rule of thumb)
  const conservativeFuel = trafficLightsWithLogistics * values.conservative;
  const conservativeCo2 = conservativeFuel * CO2_PER_LITER_DIESEL;
  const conservativeNox = conservativeFuel * NOX_PER_LITER_DIESEL_IDLE;
  const conservativeFuelCost = conservativeFuel * MONETARY_VALUES.dieselPricePerLiter;
  const conservativeCo2Cost = (conservativeCo2 / 1000) * MONETARY_VALUES.co2PricePerTonne;
  const conservativeNoxCost = (conservativeNox / 1000) * MONETARY_VALUES.noxDamageCostPerKg;
  const conservativeTotal = conservativeFuelCost + conservativeCo2Cost + conservativeNoxCost;

  // Liberal estimate (1L per stop)
  const liberalFuel = trafficLightsWithLogistics * values.liberal;
  const liberalCo2 = liberalFuel * CO2_PER_LITER_DIESEL;
  const liberalNox = liberalFuel * NOX_PER_LITER_DIESEL_IDLE;
  const liberalFuelCost = liberalFuel * MONETARY_VALUES.dieselPricePerLiter;
  const liberalCo2Cost = (liberalCo2 / 1000) * MONETARY_VALUES.co2PricePerTonne;
  const liberalNoxCost = (liberalNox / 1000) * MONETARY_VALUES.noxDamageCostPerKg;
  const liberalTotal = liberalFuelCost + liberalCo2Cost + liberalNoxCost;

  // Split: Business = fuel cost, Societal = CO2 + NOx externalities
  const conservativeSocietal = conservativeCo2Cost + conservativeNoxCost;
  const liberalSocietal = liberalCo2Cost + liberalNoxCost;

  return {
    mode: 'simple',
    trafficLightsWithLogistics,
    conservative: {
      fuelSavingsLiters: conservativeFuel,
      co2SavingsKg: conservativeCo2,
      noxSavingsGrams: conservativeNox,
      // Business benefits (what companies capture)
      businessFuelCostSavings: conservativeFuelCost,
      annualBusinessSavings: conservativeFuelCost * annualTrips,
      // Societal benefits (externalities)
      societalCo2Savings: conservativeCo2Cost,
      societalNoxSavings: conservativeNoxCost,
      totalSocietalSavings: conservativeSocietal,
      annualSocietalSavings: conservativeSocietal * annualTrips,
      // Combined totals
      totalCombinedSavings: conservativeTotal,
      annualTotalSavings: conservativeTotal * annualTrips,
    },
    liberal: {
      fuelSavingsLiters: liberalFuel,
      co2SavingsKg: liberalCo2,
      noxSavingsGrams: liberalNox,
      // Business benefits
      businessFuelCostSavings: liberalFuelCost,
      annualBusinessSavings: liberalFuelCost * annualTrips,
      // Societal benefits
      societalCo2Savings: liberalCo2Cost,
      societalNoxSavings: liberalNoxCost,
      totalSocietalSavings: liberalSocietal,
      annualSocietalSavings: liberalSocietal * annualTrips,
      // Combined totals
      totalCombinedSavings: liberalTotal,
      annualTotalSavings: liberalTotal * annualTrips,
    },
  };
}

// ============================================================================
// Advanced Mode Calculation
// Per-traffic-light scenario model with probabilistic assignment
// ============================================================================

// Seeded random for reproducible scenario assignment
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Assign scenario based on probability distribution
function assignScenario(
  distribution: { no_stop: number; slow_down: number; stop: number },
  seed: number
): TrafficLightScenario {
  const rand = seededRandom(seed);
  if (rand < distribution.no_stop) return 'no_stop';
  if (rand < distribution.no_stop + distribution.slow_down) return 'slow_down';
  return 'stop';
}

function calculateAdvancedModeSavings(
  trafficLightsOnRoute: TrafficLightFeature[],
  vehicleType: VehicleType,
  tripsPerDay: number = 2,
  workingDaysPerYear: number = 250
): AdvancedModeResult {
  const annualTrips = tripsPerDay * workingDaysPerYear;
  const distWithout = TNO_PASSAGE_DISTRIBUTION[vehicleType];
  const distWith = TNO_PASSAGE_DISTRIBUTION_WITH_PRIORITY[vehicleType];
  const fuelConsumption = TNO_FUEL_CONSUMPTION[vehicleType];

  const trafficLightScenarios: TrafficLightWithScenario[] = [];
  const scenarioCounts = {
    without: { no_stop: 0, slow_down: 0, stop: 0 },
    with: { no_stop: 0, slow_down: 0, stop: 0 },
  };

  let totalFuelSavings = 0;

  // Only process traffic lights with logistics priority
  const logisticsLights = trafficLightsOnRoute.filter(f => f.properties.has_logistics);

  for (let i = 0; i < logisticsLights.length; i++) {
    const feature = logisticsLights[i];
    const props = feature.properties;

    // Use traffic light ID as seed for reproducible results
    const seed = props.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i;

    // Assign scenarios based on TNO distribution
    const scenarioWithout = assignScenario(distWithout, seed);
    const scenarioWith = assignScenario(distWith, seed + 1000);

    // Get fuel consumption for each scenario
    const fuelWithout = fuelConsumption[scenarioWithout];
    const fuelWith = fuelConsumption[scenarioWith];
    const fuelSavings = fuelWithout - fuelWith;

    totalFuelSavings += fuelSavings;

    // Update scenario counts
    scenarioCounts.without[scenarioWithout]++;
    scenarioCounts.with[scenarioWith]++;

    trafficLightScenarios.push({
      id: props.id,
      name: props.name,
      coordinates: feature.geometry.coordinates as [number, number],
      hasLogistics: true,
      expectedScenarioWithout: scenarioWithout,
      expectedScenarioWith: scenarioWith,
      fuelWithout,
      fuelWith,
      fuelSavings,
    });
  }

  const totalCo2 = totalFuelSavings * CO2_PER_LITER_DIESEL;
  const totalNox = totalFuelSavings * NOX_PER_LITER_DIESEL_IDLE;
  const fuelCost = totalFuelSavings * MONETARY_VALUES.dieselPricePerLiter;
  const co2Cost = (totalCo2 / 1000) * MONETARY_VALUES.co2PricePerTonne;
  const noxCost = (totalNox / 1000) * MONETARY_VALUES.noxDamageCostPerKg;

  // Split: Business = fuel cost, Societal = CO2 + NOx externalities
  const societalTotal = co2Cost + noxCost;
  const combinedTotal = fuelCost + societalTotal;

  return {
    mode: 'advanced',
    trafficLightsWithLogistics: logisticsLights.length,
    trafficLightScenarios,
    totalFuelSavingsLiters: totalFuelSavings,
    totalCo2SavingsKg: totalCo2,
    totalNoxSavingsGrams: totalNox,
    // Business benefits (what companies capture)
    businessFuelCostSavings: fuelCost,
    annualBusinessSavings: fuelCost * annualTrips,
    // Societal benefits (externalities)
    societalCo2Savings: co2Cost,
    societalNoxSavings: noxCost,
    totalSocietalSavings: societalTotal,
    annualSocietalSavings: societalTotal * annualTrips,
    // Combined totals
    totalCombinedSavings: combinedTotal,
    annualTotalSavings: combinedTotal * annualTrips,
    scenarioCounts,
  };
}

// Geocode address using PDOK Locatieserver (best for Dutch addresses)
async function geocodeWithPDOK(address: string): Promise<RoutePoint | null> {
  try {
    const response = await fetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(address)}&rows=1&fq=type:(adres OR weg OR woonplaats OR gemeente)`
    );
    const data = await response.json();

    if (data.response?.docs?.length > 0) {
      const doc = data.response.docs[0];
      // PDOK returns centroide_ll in "POINT(lng lat)" format
      const match = doc.centroide_ll?.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (match) {
        return {
          lat: parseFloat(match[2]),
          lng: parseFloat(match[1]),
          name: doc.weergavenaam || doc.straatnaam || address,
        };
      }
    }
    return null;
  } catch (error) {
    console.error('PDOK geocoding error:', error);
    return null;
  }
}

// Fallback geocoding using Nominatim
async function geocodeWithNominatim(address: string): Promise<RoutePoint | null> {
  try {
    // Add "Nederland" to improve results for Dutch addresses
    const searchQuery = address.toLowerCase().includes('nederland') ? address : `${address}, Nederland`;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&countrycodes=nl&limit=1`,
      {
        headers: {
          'User-Agent': 'UDAP-Viewer-Transport-Analysis/1.0',
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        name: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Nominatim geocoding error:', error);
    return null;
  }
}

// Combined geocoding: try PDOK first, then Nominatim
async function geocodeAddress(address: string): Promise<RoutePoint | null> {
  // Try PDOK first (better for Dutch addresses)
  let result = await geocodeWithPDOK(address);
  if (result) return result;

  // Fallback to Nominatim
  result = await geocodeWithNominatim(address);
  return result;
}

// Decode polyline from OSRM (polyline6 format)
function decodePolyline(encoded: string, precision: number = 6): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

// Get route from OpenRouteService with fallback to OSRM
async function getRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  vehicleType: VehicleType = 'heavy'
): Promise<{ geometry: [number, number][]; distance: number; duration: number } | null> {
  const orsApiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;

  // Try OpenRouteService first (has proper truck profiles)
  if (orsApiKey && orsApiKey !== 'your_api_key_here') {
    try {
      // Always use driving-hgv (heavy goods vehicle) for all truck types
      const profile = 'driving-hgv';

      const orsResponse = await fetch(
        `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${orsApiKey}&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`
      );

      if (orsResponse.ok) {
        const data = await orsResponse.json();
        if (data.features && data.features.length > 0) {
          const route = data.features[0];
          const geometry = route.geometry.coordinates as [number, number][];
          const summary = route.properties.summary;
          return {
            geometry,
            distance: summary.distance / 1000, // Convert meters to km
            duration: summary.duration / 60, // Convert seconds to minutes
          };
        }
      } else {
        const errorData = await orsResponse.json().catch(() => ({}));
        console.warn('OpenRouteService error:', orsResponse.status, errorData);
      }
    } catch (error) {
      console.warn('OpenRouteService error, trying fallback...', error);
    }
  }

  // Fallback: Try OSRM demo server
  try {
    const osrmResponse = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline6`
    );

    if (osrmResponse.ok) {
      const data = await osrmResponse.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geometry = decodePolyline(route.geometry, 6);
        return {
          geometry,
          distance: route.distance / 1000,
          duration: route.duration / 60,
        };
      }
    }
    console.warn('OSRM unavailable, trying alternative server...');
  } catch (error) {
    console.warn('OSRM error, trying alternative server...', error);
  }

  // Fallback: Try OSRM routing.openstreetmap.de
  try {
    const fallbackResponse = await fetch(
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline6`
    );

    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geometry = decodePolyline(route.geometry, 6);
        return {
          geometry,
          distance: route.distance / 1000,
          duration: route.duration / 60,
        };
      }
    }
  } catch (error) {
    console.warn('All routing services failed, using straight-line route...', error);
  }

  // Final fallback: straight-line route
  return createFallbackRoute(origin, destination);
}

// Create fallback straight-line route when routing fails
function createFallbackRoute(
  origin: RoutePoint,
  destination: RoutePoint
): { geometry: [number, number][]; distance: number; duration: number } {
  const distance = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  // Create intermediate points for a smoother line
  const steps = 10;
  const geometry: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    geometry.push([
      origin.lng + t * (destination.lng - origin.lng),
      origin.lat + t * (destination.lat - origin.lat),
    ]);
  }

  return {
    geometry,
    distance,
    duration: distance * 1.2, // Rough estimate: 50 km/h average
  };
}

// Parse CSV/Excel content with smart column detection
function parseCSVContent(content: string): BulkAnalysisRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const rows: BulkAnalysisRow[] = [];

  // Parse header row to detect column indices
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(/[,;\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''));

  // Find column indices for various fields
  const findColumn = (...names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex(h =>
        h === name || h.includes(name) || name.includes(h)
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Detect column indices
  const originCol = findColumn('origin', 'herkomst', 'van', 'from', 'start');
  const originLatCol = findColumn('origin_lat', 'herkomst_lat', 'start_lat', 'van_lat');
  const originLngCol = findColumn('origin_lng', 'origin_lon', 'herkomst_lng', 'herkomst_lon', 'start_lng', 'van_lng');
  const originPostalCol = findColumn('origin_postal', 'herkomst_postcode', 'van_postcode', 'start_postcode', 'origin_zip');
  const destCol = findColumn('destination', 'bestemming', 'naar', 'to', 'end', 'eind');
  const destLatCol = findColumn('dest_lat', 'destination_lat', 'bestemming_lat', 'end_lat', 'naar_lat');
  const destLngCol = findColumn('dest_lng', 'dest_lon', 'destination_lng', 'destination_lon', 'bestemming_lng', 'bestemming_lon', 'end_lng', 'naar_lng');
  const destPostalCol = findColumn('dest_postal', 'destination_postal', 'bestemming_postcode', 'naar_postcode', 'end_postcode', 'dest_zip');
  const vehicleCol = findColumn('vehicle', 'voertuig', 'voertuigtype', 'vehicle_type', 'type');
  const tripsCol = findColumn('trips', 'ritten', 'trips_per_day', 'ritten_per_dag', 'aantal');
  const licenseCol = findColumn('license', 'kenteken', 'license_number', 'plate', 'nummerplaat');
  const timestampCol = findColumn('timestamp', 'datum', 'date', 'datetime', 'tijd');

  // If no header detected for origin/destination, assume simple format
  const useSimpleFormat = originCol === -1 && destCol === -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (useSimpleFormat) {
      // Simple format: origin, destination, [vehicleType], [tripsPerDay]
      if (cols.length >= 2) {
        const origin = cols[0];
        const dest = cols[1];

        // Check if first two columns look like coordinates (numbers)
        const originIsCoord = !isNaN(parseFloat(origin)) && !isNaN(parseFloat(dest));

        if (originIsCoord && cols.length >= 4) {
          // Format: originLat, originLng, destLat, destLng, ...
          rows.push({
            origin: `${cols[0]}, ${cols[1]}`,
            destination: `${cols[2]}, ${cols[3]}`,
            originLat: parseFloat(cols[0]),
            originLng: parseFloat(cols[1]),
            destinationLat: parseFloat(cols[2]),
            destinationLng: parseFloat(cols[3]),
            vehicleType: cols[4]?.toLowerCase() === 'light' ? 'light' : 'heavy',
            tripsPerDay: cols[5] ? parseInt(cols[5]) : 1,
          });
        } else {
          // Format: origin address, destination address, ...
          rows.push({
            origin,
            destination: dest,
            vehicleType: cols[2]?.toLowerCase() === 'light' ? 'light' : 'heavy',
            tripsPerDay: cols[3] ? parseInt(cols[3]) : 1,
          });
        }
      }
    } else {
      // Header-based format
      const getValue = (idx: number) => idx >= 0 && idx < cols.length ? cols[idx] : undefined;
      const getNumber = (idx: number) => {
        const val = getValue(idx);
        if (!val) return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      };

      const origin = getValue(originCol) || '';
      const destination = getValue(destCol) || '';
      const originLat = getNumber(originLatCol);
      const originLng = getNumber(originLngCol);
      const originPostalCode = getValue(originPostalCol);
      const destinationLat = getNumber(destLatCol);
      const destinationLng = getNumber(destLngCol);
      const destinationPostalCode = getValue(destPostalCol);

      // Need at least origin/destination (address, coords, or postal code)
      const hasOrigin = origin || originPostalCode || (originLat !== undefined && originLng !== undefined);
      const hasDest = destination || destinationPostalCode || (destinationLat !== undefined && destinationLng !== undefined);

      if (hasOrigin && hasDest) {
        // Build address string with postal code if available
        const buildAddress = (addr: string, postal: string | undefined, lat: number | undefined, lng: number | undefined) => {
          if (addr && postal) return `${addr}, ${postal}`;
          if (addr) return addr;
          if (postal) return postal;
          if (lat !== undefined && lng !== undefined) return `${lat}, ${lng}`;
          return '';
        };

        rows.push({
          origin: buildAddress(origin, originPostalCode, originLat, originLng),
          destination: buildAddress(destination, destinationPostalCode, destinationLat, destinationLng),
          originLat,
          originLng,
          destinationLat,
          destinationLng,
          originPostalCode,
          destinationPostalCode,
          vehicleType: getValue(vehicleCol)?.toLowerCase() === 'light' ? 'light' : 'heavy',
          tripsPerDay: getNumber(tripsCol) || 1,
          licenseNumber: getValue(licenseCol),
          timestamp: getValue(timestampCol),
        });
      }
    }
  }

  return rows;
}

// Helper: Get text content from an XML element
function getXmlText(element: Element, tagName: string): string | null {
  const child = element.getElementsByTagName(tagName)[0];
  return child?.textContent?.trim() || null;
}

// Helper: Get number from XML element
function getXmlNumber(element: Element, tagName: string): number | undefined {
  const text = getXmlText(element, tagName);
  if (!text) return undefined;
  const num = parseFloat(text);
  return isNaN(num) ? undefined : num;
}

// RDW Open Data API lookup cache to avoid duplicate requests
const rdwCache = new Map<string, RDWVehicleInfo | null>();

// Normalize license plate for RDW API (remove dashes, spaces, uppercase)
function normalizeLicensePlate(plate: string): string {
  return plate.toUpperCase().replace(/[-\s]/g, '');
}

// Lookup vehicle info from RDW Open Data API
// API: https://opendata.rdw.nl/resource/m9d7-ebf2.json
async function lookupRDWVehicle(licenseNumber: string): Promise<RDWVehicleInfo | null> {
  const normalized = normalizeLicensePlate(licenseNumber);

  // Check cache first
  if (rdwCache.has(normalized)) {
    return rdwCache.get(normalized) || null;
  }

  try {
    const response = await fetch(
      `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${normalized}`
    );

    if (!response.ok) {
      rdwCache.set(normalized, null);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      rdwCache.set(normalized, null);
      return null;
    }

    const vehicle = data[0];
    const rdwInfo: RDWVehicleInfo = {
      kenteken: vehicle.kenteken || normalized,
      merk: vehicle.merk || 'Onbekend',
      handelsbenaming: vehicle.handelsbenaming,
      voertuigsoort: vehicle.voertuigsoort || 'Onbekend',
      europese_voertuigcategorie: vehicle.europese_voertuigcategorie || '',
      massa_ledig_voertuig: vehicle.massa_ledig_voertuig
        ? parseInt(vehicle.massa_ledig_voertuig)
        : undefined,
      maximum_massa_samenstelling: vehicle.maximum_massa_samenstelling
        ? parseInt(vehicle.maximum_massa_samenstelling)
        : undefined,
      toegestane_maximum_massa_voertuig: vehicle.toegestane_maximum_massa_voertuig
        ? parseInt(vehicle.toegestane_maximum_massa_voertuig)
        : undefined,
      eerste_kleur: vehicle.eerste_kleur,
      aantal_assen: vehicle.aantal_assen ? parseInt(vehicle.aantal_assen) : undefined,
      lengte: vehicle.lengte ? parseInt(vehicle.lengte) : undefined,
      inrichting: vehicle.inrichting,
    };

    rdwCache.set(normalized, rdwInfo);
    return rdwInfo;
  } catch (error) {
    console.error(`RDW lookup failed for ${normalized}:`, error);
    rdwCache.set(normalized, null);
    return null;
  }
}

// Convert RDW API response to display-friendly details
function rdwInfoToDetails(rdwInfo: RDWVehicleInfo): RDWVehicleDetails {
  return {
    licenseNumber: rdwInfo.kenteken,
    brand: rdwInfo.merk,
    model: rdwInfo.handelsbenaming,
    vehicleType: rdwInfo.voertuigsoort,
    euCategory: rdwInfo.europese_voertuigcategorie,
    emptyWeightKg: rdwInfo.massa_ledig_voertuig,
    maxCombinationWeightKg: rdwInfo.maximum_massa_samenstelling,
  };
}

// Parse CBS Wegvervoer XML content (realised trips)
// Schema: https://www.cbs.nl/-/media/cbsvooruwbedrijf/xml-vanuit-transportmanagementsysteem/
function parseCBSXmlContent(content: string): BulkAnalysisRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');

  // Check for parsing errors
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('Ongeldig XML bestand: ' + parseError.textContent);
  }

  const rows: BulkAnalysisRow[] = [];

  // Find all motorVehicle elements
  const motorVehicles = doc.getElementsByTagName('motorVehicle');

  for (let i = 0; i < motorVehicles.length; i++) {
    const vehicle = motorVehicles[i];
    const licenseNumber = getXmlText(vehicle, 'licenseNumber') || '';

    // Get trailer info for weight classification (if available)
    const trailers = vehicle.getElementsByTagName('trailer');
    let maxLoadingCapacity = 0;
    for (let t = 0; t < trailers.length; t++) {
      const loadingCapacity = getXmlNumber(trailers[t], 'loadingCapacity');
      if (loadingCapacity && loadingCapacity > maxLoadingCapacity) {
        maxLoadingCapacity = loadingCapacity;
      }
    }

    // Find all journeys for this vehicle
    const journeys = vehicle.getElementsByTagName('journey');

    for (let j = 0; j < journeys.length; j++) {
      const journey = journeys[j];

      // Get origin (startJourney)
      const startJourney = journey.getElementsByTagName('startJourney')[0];
      const origin = startJourney ? getXmlText(startJourney, 'locationName') : null;
      const originPostalCode = startJourney ? getXmlText(startJourney, 'postalCode') : null;
      // Try both locationLatitude/locationLongitude and latitude/longitude
      const originLat = startJourney
        ? (getXmlNumber(startJourney, 'locationLatitude') || getXmlNumber(startJourney, 'latitude'))
        : null;
      const originLng = startJourney
        ? (getXmlNumber(startJourney, 'locationLongitude') || getXmlNumber(startJourney, 'longitude'))
        : null;

      // Get destination (endJourney)
      const endJourney = journey.getElementsByTagName('endJourney')[0];
      const destination = endJourney ? getXmlText(endJourney, 'locationName') : null;
      const destinationPostalCode = endJourney ? getXmlText(endJourney, 'postalCode') : null;
      // Try both locationLatitude/locationLongitude and latitude/longitude
      const destinationLat = endJourney
        ? (getXmlNumber(endJourney, 'locationLatitude') || getXmlNumber(endJourney, 'latitude'))
        : null;
      const destinationLng = endJourney
        ? (getXmlNumber(endJourney, 'locationLongitude') || getXmlNumber(endJourney, 'longitude'))
        : null;

      // Get journey timestamp if available
      const timestamp = getXmlText(journey, 'departureDateTime') || getXmlText(journey, 'arrivalDateTime');

      // Get total cargo weight from shipments
      let totalCargoWeight = 0;
      const shipments = journey.getElementsByTagName('shipment');
      for (let s = 0; s < shipments.length; s++) {
        const grossWeight = getXmlNumber(shipments[s], 'grossWeight');
        if (grossWeight) {
          totalCargoWeight += grossWeight;
        }
      }

      // Only add if we have origin and destination (coordinates OR location names OR postal codes)
      const hasOrigin = origin || originPostalCode || (originLat && originLng);
      const hasDestination = destination || destinationPostalCode || (destinationLat && destinationLng);

      if (hasOrigin && hasDestination) {
        // Build address string: prefer location name, then postal code, then coordinates
        const buildAddress = (name: string | null, postalCode: string | null, lat: number | null | undefined, lng: number | null | undefined) => {
          if (name && postalCode) return `${name}, ${postalCode}`;
          if (name) return name;
          if (postalCode) return postalCode;
          if (lat && lng) return `${lat}, ${lng}`;
          return '';
        };

        // Include license plate for RDW lookup during processing
        // Vehicle type will be determined later via RDW API
        rows.push({
          origin: buildAddress(origin, originPostalCode, originLat, originLng),
          destination: buildAddress(destination, destinationPostalCode, destinationLat, destinationLng),
          originLat: originLat || undefined,
          originLng: originLng || undefined,
          destinationLat: destinationLat || undefined,
          destinationLng: destinationLng || undefined,
          originPostalCode: originPostalCode || undefined,
          destinationPostalCode: destinationPostalCode || undefined,
          vehicleType: 'heavy', // Default, will be overridden by RDW data
          tripsPerDay: 1, // Each journey counts as one trip
          licenseNumber: licenseNumber || undefined,
          timestamp: timestamp || undefined,
        });
      }
    }
  }

  return rows;
}

// Detect file type and parse accordingly
function parseUploadedFile(content: string, fileName: string): BulkAnalysisRow[] {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith('.xml')) {
    return parseCBSXmlContent(content);
  } else {
    // CSV, TXT, or other text formats
    return parseCSVContent(content);
  }
}

export default function TransportAnalysisPage() {
  // Traffic light data
  const [trafficLightData, setTrafficLightData] = useState<TrafficLightData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Form state
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('heavy');
  const [tripsPerDay, setTripsPerDay] = useState(2);
  const [selectedSource, setSelectedSource] = useState<DataSource>('tno_scenario');
  const [calculationMode, setCalculationMode] = useState<CalculationMode>('simple');

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simple/Advanced mode results
  const [simpleModeResult, setSimpleModeResult] = useState<SimpleModeResult | null>(null);
  const [advancedModeResult, setAdvancedModeResult] = useState<AdvancedModeResult | null>(null);

  // Bulk analysis
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkAnalysisResult[]>([]);
  const [selectedBulkResultIndex, setSelectedBulkResultIndex] = useState<number | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkLimitError, setBulkLimitError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentTrip: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk analysis limits and pricing tiers
  const FREE_TIER_MAX_ROUTES = 10; // Free tier: up to 10 routes
  const PRICE_PER_TRIP = 0.05; // €0.05 per trip above free tier
  const MAX_ROUTES_PER_ANALYSIS = 1750; // Max supported per analysis
  const MAX_BULK_ANALYSES_PER_DAY = 3;
  const BULK_USAGE_STORAGE_KEY = 'bulk_analysis_usage';
  const PAID_SESSIONS_STORAGE_KEY = 'paid_analysis_sessions';

  // Payment-related state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingTripCount, setPendingTripCount] = useState(0);
  const [paymentSessionId, setPaymentSessionId] = useState<string>('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Get bulk usage from localStorage
  const getBulkUsage = useCallback((): { count: number; resetTime: number } => {
    if (typeof window === 'undefined') return { count: 0, resetTime: 0 };
    try {
      const stored = localStorage.getItem(BULK_USAGE_STORAGE_KEY);
      if (!stored) return { count: 0, resetTime: 0 };
      const data = JSON.parse(stored);
      // Reset if 24 hours have passed
      if (Date.now() > data.resetTime) {
        return { count: 0, resetTime: 0 };
      }
      return data;
    } catch {
      return { count: 0, resetTime: 0 };
    }
  }, []);

  // Increment bulk usage
  const incrementBulkUsage = useCallback(() => {
    if (typeof window === 'undefined') return;
    const current = getBulkUsage();
    const newData = {
      count: current.count + 1,
      resetTime: current.resetTime || Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
    };
    localStorage.setItem(BULK_USAGE_STORAGE_KEY, JSON.stringify(newData));
  }, [getBulkUsage]);

  // Check if bulk analysis is allowed
  const canUseBulkAnalysis = useCallback((): boolean => {
    const usage = getBulkUsage();
    return usage.count < MAX_BULK_ANALYSES_PER_DAY;
  }, [getBulkUsage]);

  // Get remaining bulk analyses
  const getRemainingBulkAnalyses = useCallback((): number => {
    const usage = getBulkUsage();
    return Math.max(0, MAX_BULK_ANALYSES_PER_DAY - usage.count);
  }, [getBulkUsage]);

  // State for remaining analyses display
  const [remainingAnalyses, setRemainingAnalyses] = useState(MAX_BULK_ANALYSES_PER_DAY);

  // Update remaining analyses on mount and after each analysis
  useEffect(() => {
    setRemainingAnalyses(getRemainingBulkAnalyses());
  }, [getRemainingBulkAnalyses, bulkResults]);

  // Manage paid sessions in localStorage
  const getPaidSessions = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(PAID_SESSIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const addPaidSession = useCallback((sessionId: string) => {
    if (typeof window === 'undefined') return;
    const sessions = getPaidSessions();
    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
      localStorage.setItem(PAID_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [getPaidSessions]);

  const isSessionPaid = useCallback((sessionId: string): boolean => {
    return getPaidSessions().includes(sessionId);
  }, [getPaidSessions]);

  // Generate unique session ID
  const generateSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get price for trip count (pay per use: €0.05 per trip above 10)
  const getPriceForTripCount = useCallback((tripCount: number): { price: number; paidTrips: number } | null => {
    if (tripCount <= FREE_TIER_MAX_ROUTES) return null; // Free
    if (tripCount > MAX_ROUTES_PER_ANALYSIS) return null; // Too many, needs contact
    const paidTrips = tripCount - FREE_TIER_MAX_ROUTES;
    const price = Math.round(paidTrips * PRICE_PER_TRIP * 100) / 100; // Round to 2 decimals
    return { price, paidTrips };
  }, []);

  // Create Mollie payment
  const createPayment = useCallback(async (tripCount: number, sessionId: string) => {
    setPaymentProcessing(true);
    try {
      const response = await fetch('/api/mollie/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripCount, sessionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      const data = await response.json();

      // Store parsed rows in sessionStorage before redirect (so we can process after payment)
      sessionStorage.setItem(`pending_analysis_${sessionId}`, JSON.stringify({
        rows: parsedRowsCache,
        tripCount,
      }));

      // Redirect to Mollie checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken betaling');
      setPaymentProcessing(false);
    }
  }, [pendingFiles]);

  // Excluded traffic lights (manually removed by user)
  const [excludedTrafficLightIds, setExcludedTrafficLightIds] = useState<Set<string>>(new Set());

  // Payment success message state
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  // Load traffic light data
  useEffect(() => {
    fetch('/data/traffic_lights.geojson')
      .then((res) => res.json())
      .then((data: TrafficLightData) => {
        // Filter to only include iVRIs (exclude iFBAs and other subject types)
        const filteredData = {
          ...data,
          features: data.features.filter(f =>
            !f.properties.subjectTypeName || f.properties.subjectTypeName === 'iVRI'
          ),
        };
        if (data.metadata) {
          filteredData.metadata = {
            ...data.metadata,
            total_traffic_lights: filteredData.features.length,
          };
        }
        setTrafficLightData(filteredData);
      })
      .catch((err) => console.error('Error loading data:', err))
      .finally(() => setDataLoading(false));
  }, []);

  // Count traffic lights along route (excluding manually removed ones)
  const countTrafficLightsOnRoute = useCallback(
    (routeGeometry: [number, number][], excludedIds: Set<string> = new Set()): { total: number; withLogistics: number } => {
      if (!trafficLightData) return { total: 0, withLogistics: 0 };

      let total = 0;
      let withLogistics = 0;
      const thresholdKm = 0.035; // 35 meters from route - inclusive, user can manually exclude false positives

      for (const feature of trafficLightData.features) {
        // Skip excluded traffic lights
        if (excludedIds.has(feature.properties.id)) {
          continue;
        }

        const [lng, lat] = feature.geometry.coordinates;

        if (isPointNearRoute([lng, lat], routeGeometry, thresholdKm)) {
          total++;
          if (feature.properties.has_logistics) {
            withLogistics++;
          }
        }
      }

      return { total, withLogistics };
    },
    [trafficLightData]
  );

  // Get traffic light features on route (for advanced mode)
  const getTrafficLightsOnRoute = useCallback(
    (routeGeometry: [number, number][], excludedIds: Set<string> = new Set()): TrafficLightFeature[] => {
      if (!trafficLightData) return [];

      const thresholdKm = 0.035; // 35 meters from route
      const result: TrafficLightFeature[] = [];

      for (const feature of trafficLightData.features) {
        if (excludedIds.has(feature.properties.id)) continue;
        const [lng, lat] = feature.geometry.coordinates;
        if (isPointNearRoute([lng, lat], routeGeometry, thresholdKm)) {
          result.push(feature);
        }
      }

      return result;
    },
    [trafficLightData]
  );

  // Handle excluding a traffic light and recalculate savings
  const handleExcludeTrafficLight = useCallback(
    (id: string) => {
      setExcludedTrafficLightIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(id);
        return newSet;
      });
    },
    []
  );

  // Reset excluded traffic lights
  const resetExcludedTrafficLights = useCallback(() => {
    setExcludedTrafficLightIds(new Set());
  }, []);

  // Recalculate analysis when excluded IDs change
  useEffect(() => {
    // Need to recalculate when exclusions change (but not when analysis itself changes)
    setAnalysis((prev) => {
      if (!prev) return prev;

      // Recalculate traffic light counts with exclusions
      const { total, withLogistics } = countTrafficLightsOnRoute(
        prev.routeGeometry,
        excludedTrafficLightIds
      );

      // Skip update if counts haven't changed (prevents unnecessary re-renders)
      if (total === prev.trafficLightsOnRoute && withLogistics === prev.trafficLightsWithLogistics) {
        return prev;
      }

      // Recalculate savings
      const { savingsBySource, bandwidth } = calculateAllSavings(
        withLogistics,
        prev.vehicleType,
        tripsPerDay
      );

      // Recalculate Simple Mode results
      const simpleResult = calculateSimpleModeSavings(withLogistics, prev.vehicleType, tripsPerDay);
      setSimpleModeResult(simpleResult);

      // Recalculate Advanced Mode results
      const trafficLightsOnRouteFeatures = getTrafficLightsOnRoute(prev.routeGeometry, excludedTrafficLightIds);
      const advancedResult = calculateAdvancedModeSavings(trafficLightsOnRouteFeatures, prev.vehicleType, tripsPerDay);
      setAdvancedModeResult(advancedResult);

      return {
        ...prev,
        trafficLightsOnRoute: total,
        trafficLightsWithLogistics: withLogistics,
        savingsBySource,
        savingsBandwidth: bandwidth,
      };
    });
  }, [excludedTrafficLightIds, countTrafficLightsOnRoute, getTrafficLightsOnRoute, tripsPerDay]);

  // Analyze route
  const analyzeRoute = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setSimpleModeResult(null);
    setAdvancedModeResult(null);
    setExcludedTrafficLightIds(new Set()); // Reset exclusions for new route

    try {
      // Geocode origin
      const origin = await geocodeAddress(originInput);
      if (!origin) {
        throw new Error(`Kon "${originInput}" niet vinden. Probeer een specifiekere locatie.`);
      }

      // Geocode destination
      const destination = await geocodeAddress(destinationInput);
      if (!destination) {
        throw new Error(`Kon "${destinationInput}" niet vinden. Probeer een specifiekere locatie.`);
      }

      // Get route (using vehicle type for proper routing profile)
      const route = await getRoute(origin, destination, vehicleType);
      if (!route) {
        throw new Error('Kon geen route berekenen. Probeer het later opnieuw.');
      }

      // Count traffic lights
      const { total, withLogistics } = countTrafficLightsOnRoute(route.geometry);

      // Get traffic light features for advanced mode
      const trafficLightsOnRouteFeatures = getTrafficLightsOnRoute(route.geometry);

      // Calculate savings for all sources (legacy - still used for some displays)
      const { savingsBySource, bandwidth } = calculateAllSavings(
        withLogistics,
        vehicleType,
        tripsPerDay
      );

      // Calculate Simple Mode results
      const simpleResult = calculateSimpleModeSavings(withLogistics, vehicleType, tripsPerDay);
      setSimpleModeResult(simpleResult);

      // Calculate Advanced Mode results
      const advancedResult = calculateAdvancedModeSavings(trafficLightsOnRouteFeatures, vehicleType, tripsPerDay);
      setAdvancedModeResult(advancedResult);

      setAnalysis({
        origin,
        destination,
        vehicleType,
        routeGeometry: route.geometry,
        distanceKm: route.distance,
        durationMinutes: route.duration,
        trafficLightsOnRoute: total,
        trafficLightsWithLogistics: withLogistics,
        savingsBySource,
        savingsBandwidth: bandwidth,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
    } finally {
      setAnalyzing(false);
    }
  }, [originInput, destinationInput, vehicleType, tripsPerDay, countTrafficLightsOnRoute, getTrafficLightsOnRoute]);

  // Load example route
  const loadExampleRoute = useCallback(() => {
    setOriginInput(EXAMPLE_ROUTE.originSearch || EXAMPLE_ROUTE.origin.name);
    setDestinationInput(EXAMPLE_ROUTE.destinationSearch || EXAMPLE_ROUTE.destination.name);
    setVehicleType('heavy');
    setAnalysis(null);
    setError(null);
  }, []);

  // Dropzone state
  const [isDragging, setIsDragging] = useState(false);

  // Run bulk analysis on parsed rows (the actual analysis work)
  const runBulkAnalysis = useCallback(
    async (rows: BulkAnalysisRow[], skipUsageCheck = false) => {
      if (!skipUsageCheck && !canUseBulkAnalysis()) {
        setBulkLimitError('daily_limit');
        return;
      }

      setBulkAnalyzing(true);
      setBulkResults([]);
      setBulkProgress(null);

      try {
        const results: BulkAnalysisResult[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];

          // Update progress
          setBulkProgress({
            current: i + 1,
            total: rows.length,
            currentTrip: `${row.origin} → ${row.destination}`,
          });

          try {
            // If license plate is present, do RDW lookup first
            let rdwDetails: RDWVehicleDetails | undefined;
            let vType = row.vehicleType || vehicleType;

            if (row.licenseNumber) {
              const rdwInfo = await lookupRDWVehicle(row.licenseNumber);
              if (rdwInfo) {
                // Use RDW data to classify vehicle
                vType = classifyVehicleFromRDW(rdwInfo);
                rdwDetails = rdwInfoToDetails(rdwInfo);
              }
            }

            // Use coordinates if available, otherwise try postal code, then full address
            let origin: { lat: number; lng: number };
            if (row.originLat !== undefined && row.originLng !== undefined) {
              origin = { lat: row.originLat, lng: row.originLng };
            } else {
              // Try postal code first (Dutch postal codes are very precise)
              let geocoded = row.originPostalCode
                ? await geocodeAddress(row.originPostalCode)
                : null;
              // Fall back to full address if postal code didn't work
              if (!geocoded) {
                geocoded = await geocodeAddress(row.origin);
              }
              if (!geocoded) throw new Error(`Locatie niet gevonden: ${row.origin}`);
              origin = geocoded;
            }

            let destination: { lat: number; lng: number };
            if (row.destinationLat !== undefined && row.destinationLng !== undefined) {
              destination = { lat: row.destinationLat, lng: row.destinationLng };
            } else {
              // Try postal code first (Dutch postal codes are very precise)
              let geocoded = row.destinationPostalCode
                ? await geocodeAddress(row.destinationPostalCode)
                : null;
              // Fall back to full address if postal code didn't work
              if (!geocoded) {
                geocoded = await geocodeAddress(row.destination);
              }
              if (!geocoded) throw new Error(`Locatie niet gevonden: ${row.destination}`);
              destination = geocoded;
            }

            const route = await getRoute(origin, destination, vType);
            if (!route) throw new Error('Kon route niet berekenen');

            const { total, withLogistics } = countTrafficLightsOnRoute(route.geometry);
            const { savingsBySource, bandwidth } = calculateAllSavings(
              withLogistics,
              vType,
              row.tripsPerDay || tripsPerDay
            );

            results.push({
              rowIndex: i,
              originName: row.origin,
              destinationName: row.destination,
              origin,
              destination,
              vehicleType: vType,
              routeGeometry: route.geometry,
              distanceKm: route.distance,
              durationMinutes: route.duration,
              trafficLightsOnRoute: total,
              trafficLightsWithLogistics: withLogistics,
              savingsBySource,
              savingsBandwidth: bandwidth,
              rdwVehicleDetails: rdwDetails,
            });
          } catch (err) {
            const { savingsBySource, bandwidth } = calculateAllSavings(0, vehicleType);
            results.push({
              rowIndex: i,
              originName: row.origin,
              destinationName: row.destination,
              origin: { lat: 0, lng: 0 },
              destination: { lat: 0, lng: 0 },
              vehicleType: row.vehicleType || vehicleType,
              routeGeometry: [],
              distanceKm: 0,
              durationMinutes: 0,
              trafficLightsOnRoute: 0,
              trafficLightsWithLogistics: 0,
              savingsBySource,
              savingsBandwidth: bandwidth,
              error: err instanceof Error ? err.message : 'Onbekende fout',
            });
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        setBulkResults(results);
        // Increment usage counter after successful analysis (only for free tier)
        if (!skipUsageCheck) {
          incrementBulkUsage();
          setRemainingAnalyses(getRemainingBulkAnalyses() - 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij verwerken bestand');
      } finally {
        setBulkAnalyzing(false);
        setBulkProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [countTrafficLightsOnRoute, vehicleType, tripsPerDay, canUseBulkAnalysis, incrementBulkUsage, getRemainingBulkAnalyses]
  );

  // Handle payment return from URL params (must be after runBulkAnalysis definition)
  // Also needs to wait for trafficLightData to be loaded
  const [pendingPaymentSession, setPendingPaymentSession] = useState<string | null>(null);

  // First effect: detect payment return and store session ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const sessionId = params.get('session');

    if (paymentStatus === 'success' && sessionId) {
      // Mark session as paid
      addPaidSession(sessionId);

      // Switch to bulk mode
      setBulkMode(true);

      // Clean up URL (remove payment params)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);

      // Store session ID for processing once data is loaded
      setPendingPaymentSession(sessionId);
    }
  }, [addPaidSession]);

  // Second effect: process pending payment once traffic light data is loaded
  useEffect(() => {
    if (!pendingPaymentSession || !trafficLightData) return;

    const storedData = sessionStorage.getItem(`pending_analysis_${pendingPaymentSession}`);
    if (storedData) {
      try {
        const { rows } = JSON.parse(storedData) as { rows: BulkAnalysisRow[]; tripCount: number };
        sessionStorage.removeItem(`pending_analysis_${pendingPaymentSession}`);

        // Show success message and start analysis
        setPaymentSuccessMessage('Betaling succesvol! Analyse wordt gestart...');

        // Start the analysis (skip usage check since it's paid)
        runBulkAnalysis(rows, true).then(() => {
          setPaymentSuccessMessage(null);
        });
      } catch (e) {
        console.error('Failed to parse stored analysis data:', e);
        setPaymentSuccessMessage('Betaling succesvol! Upload uw bestand opnieuw om de analyse te starten.');
        setTimeout(() => setPaymentSuccessMessage(null), 5000);
      }
    } else {
      setPaymentSuccessMessage('Betaling succesvol! Upload uw bestand opnieuw om de analyse te starten.');
      setTimeout(() => setPaymentSuccessMessage(null), 5000);
    }

    // Clear pending session
    setPendingPaymentSession(null);
  }, [pendingPaymentSession, trafficLightData, runBulkAnalysis]);

  // Store parsed rows for after payment
  const [parsedRowsCache, setParsedRowsCache] = useState<BulkAnalysisRow[]>([]);

  // Column mapping preview state
  const [showColumnPreview, setShowColumnPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<BulkAnalysisRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<{
    hasOriginAddress: boolean;
    hasDestinationAddress: boolean;
    hasOriginCoords: boolean;
    hasDestinationCoords: boolean;
    hasOriginPostalCode: boolean;
    hasDestinationPostalCode: boolean;
    hasLicensePlate: boolean;
    hasTripsPerDay: boolean;
    hasTimestamp: boolean;
    fileType: 'csv' | 'xml' | 'unknown';
  } | null>(null);

  // Handle file processing - show preview first
  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setBulkLimitError(null);
      setError(null);

      try {
        // Parse all files and combine rows
        const allRows: BulkAnalysisRow[] = [];
        let detectedFileType: 'csv' | 'xml' | 'unknown' = 'unknown';

        for (const file of fileArray) {
          const content = await file.text();
          const rows = parseUploadedFile(content, file.name);
          allRows.push(...rows);

          // Detect file type
          const ext = file.name.toLowerCase().split('.').pop();
          if (ext === 'xml') {
            detectedFileType = 'xml';
          } else if (['csv', 'txt', 'xlsx'].includes(ext || '')) {
            detectedFileType = detectedFileType === 'xml' ? 'xml' : 'csv';
          }
        }

        if (allRows.length === 0) {
          throw new Error('Geen geldige rijen gevonden in de bestanden');
        }

        // Detect what columns/data are available
        setDetectedColumns({
          hasOriginAddress: allRows.some(r => r.origin && r.origin.length > 0),
          hasDestinationAddress: allRows.some(r => r.destination && r.destination.length > 0),
          hasOriginCoords: allRows.some(r => r.originLat !== undefined && r.originLng !== undefined),
          hasDestinationCoords: allRows.some(r => r.destinationLat !== undefined && r.destinationLng !== undefined),
          hasOriginPostalCode: allRows.some(r => r.originPostalCode && r.originPostalCode.length > 0),
          hasDestinationPostalCode: allRows.some(r => r.destinationPostalCode && r.destinationPostalCode.length > 0),
          hasLicensePlate: allRows.some(r => r.licenseNumber && r.licenseNumber.length > 0),
          hasTripsPerDay: allRows.some(r => r.tripsPerDay !== undefined),
          hasTimestamp: allRows.some(r => r.timestamp !== undefined),
          fileType: detectedFileType,
        });

        // Store all rows and show preview
        setParsedRowsCache(allRows);
        setPreviewRows(allRows.slice(0, 5)); // Show first 5 rows
        setPendingTripCount(allRows.length);
        setPendingFiles(fileArray);
        setShowColumnPreview(true);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fout bij verwerken bestand');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    []
  );

  // Handle preview confirmation - check payment requirements and run analysis
  const handlePreviewConfirm = useCallback(async () => {
    setShowColumnPreview(false);
    const tripCount = parsedRowsCache.length;

    // Check if trip count exceeds maximum (needs contact)
    if (tripCount > MAX_ROUTES_PER_ANALYSIS) {
      setShowContactModal(true);
      return;
    }

    // Check if payment is required (> 10 trips)
    if (tripCount > FREE_TIER_MAX_ROUTES) {
      const sessionId = generateSessionId();
      setPaymentSessionId(sessionId);
      setShowPaymentModal(true);
      return;
    }

    // Free tier: check daily usage limit
    if (!canUseBulkAnalysis()) {
      setBulkLimitError('daily_limit');
      return;
    }

    // Process free tier analysis directly
    await runBulkAnalysis(parsedRowsCache);
  }, [parsedRowsCache, canUseBulkAnalysis, runBulkAnalysis, generateSessionId]);

  // Handle preview cancel
  const handlePreviewCancel = useCallback(() => {
    setShowColumnPreview(false);
    setParsedRowsCache([]);
    setPreviewRows([]);
    setDetectedColumns(null);
    setPendingTripCount(0);
    setPendingFiles([]);
  }, []);

  // Handle file input change
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the dropzone entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        // Filter for accepted file types
        const acceptedFiles = Array.from(files).filter((file) => {
          const ext = file.name.toLowerCase().split('.').pop();
          return ['csv', 'txt', 'xlsx', 'xml'].includes(ext || '');
        });
        if (acceptedFiles.length > 0) {
          processFiles(acceptedFiles);
        }
      }
    },
    [processFiles]
  );

  // Calculate bulk totals with bandwidth
  const bulkTotals = useMemo(() => {
    if (bulkResults.length === 0) return null;

    const validResults = bulkResults.filter((r) => !r.error);

    return {
      totalRoutes: bulkResults.length,
      validRoutes: validResults.length,
      totalDistance: validResults.reduce((sum, r) => sum + r.distanceKm, 0),
      totalTrafficLights: validResults.reduce((sum, r) => sum + r.trafficLightsOnRoute, 0),
      totalWithLogistics: validResults.reduce((sum, r) => sum + r.trafficLightsWithLogistics, 0),
      // Min bandwidth (conservative TNO)
      minAnnualFuelSavings: validResults.reduce((sum, r) => sum + r.savingsBandwidth.minFuelSavingsLiters * r.savingsBySource.tno_conservative.annualTrips, 0),
      minAnnualCo2Savings: validResults.reduce((sum, r) => sum + r.savingsBandwidth.minCo2SavingsKg * r.savingsBySource.tno_conservative.annualTrips, 0),
      minAnnualTotalSavings: validResults.reduce((sum, r) => sum + r.savingsBandwidth.minAnnualTotalSavings, 0),
      // Max bandwidth (operator)
      maxAnnualFuelSavings: validResults.reduce((sum, r) => sum + r.savingsBandwidth.maxFuelSavingsLiters * r.savingsBySource.operator.annualTrips, 0),
      maxAnnualCo2Savings: validResults.reduce((sum, r) => sum + r.savingsBandwidth.maxCo2SavingsKg * r.savingsBySource.operator.annualTrips, 0),
      maxAnnualTotalSavings: validResults.reduce((sum, r) => sum + r.savingsBandwidth.maxAnnualTotalSavings, 0),
      // Selected source totals
      annualFuelSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[selectedSource].annualFuelSavingsLiters, 0),
      annualCo2Savings: validResults.reduce((sum, r) => sum + r.savingsBySource[selectedSource].annualCo2SavingsKg, 0),
      annualNoxSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[selectedSource].annualNoxSavingsGrams, 0),
      annualTotalSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[selectedSource].annualTotalSavings, 0),
      // Business vs Societal split (for bulk analysis)
      annualBusinessSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[selectedSource].fuelCostSavings * r.savingsBySource[selectedSource].annualTrips, 0),
      annualSocietalSavings: validResults.reduce((sum, r) => sum + (r.savingsBySource[selectedSource].co2SocietalSavings + r.savingsBySource[selectedSource].noxSocietalSavings) * r.savingsBySource[selectedSource].annualTrips, 0),
    };
  }, [bulkResults, selectedSource]);

  // Export results to CSV
  const exportResultsCSV = useCallback(() => {
    if (bulkResults.length === 0) return;

    const headers = [
      'Herkomst',
      'Bestemming',
      'Voertuigtype',
      'Afstand (km)',
      'Verkeerslichten',
      'Met logistiek prioriteit',
      'Brandstof min (L/rit)',
      'Brandstof max (L/rit)',
      'CO2 min (kg/rit)',
      'CO2 max (kg/rit)',
      'Jaarlijks min (EUR)',
      'Jaarlijks max (EUR)',
      'Fout',
    ];

    const rows = bulkResults.map((r) => [
      r.originName,
      r.destinationName,
      r.vehicleType,
      r.distanceKm.toFixed(1),
      r.trafficLightsOnRoute,
      r.trafficLightsWithLogistics,
      r.savingsBandwidth.minFuelSavingsLiters.toFixed(3),
      r.savingsBandwidth.maxFuelSavingsLiters.toFixed(2),
      r.savingsBandwidth.minCo2SavingsKg.toFixed(3),
      r.savingsBandwidth.maxCo2SavingsKg.toFixed(2),
      r.savingsBandwidth.minAnnualTotalSavings.toFixed(0),
      r.savingsBandwidth.maxAnnualTotalSavings.toFixed(0),
      r.error || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transport-analyse-resultaten.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [bulkResults]);

  // Export results to PDF
  const exportResultsPDF = useCallback(() => {
    if (bulkResults.length === 0 || !bulkTotals) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const validResults = bulkResults.filter(r => !r.error);

    // Helper to calculate totals for a specific source
    const calcTotalsForSource = (source: DataSource) => {
      return {
        annualFuelSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[source].annualFuelSavingsLiters, 0),
        annualCo2Savings: validResults.reduce((sum, r) => sum + r.savingsBySource[source].annualCo2SavingsKg, 0),
        annualNoxSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[source].annualNoxSavingsGrams, 0),
        annualBusinessSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[source].fuelCostSavings * r.savingsBySource[source].annualTrips, 0),
        annualSocietalSavings: validResults.reduce((sum, r) => sum + (r.savingsBySource[source].co2SocietalSavings + r.savingsBySource[source].noxSocietalSavings) * r.savingsBySource[source].annualTrips, 0),
        annualTotalSavings: validResults.reduce((sum, r) => sum + r.savingsBySource[source].annualTotalSavings, 0),
      };
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Transport Analyse Rapport', pageWidth / 2, 20, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, 28, { align: 'center' });

    // Summary section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Samenvatting', 14, 42);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      ['Totaal aantal routes', `${bulkTotals.validRoutes} van ${bulkTotals.totalRoutes}`],
      ['Totale afstand', `${bulkTotals.totalDistance.toFixed(0)} km`],
      ['Verkeerslichten op routes', `${bulkTotals.totalTrafficLights}`],
      ['Met prioriteit voor logistiek', `${bulkTotals.totalWithLogistics}`],
    ];

    autoTable(doc, {
      startY: 46,
      head: [],
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 60 },
      },
    });

    // All three data sources
    const dataSources: DataSource[] = ['tno_conservative', 'tno_scenario', 'operator'];
    const sourceColors: Record<DataSource, [number, number, number]> = {
      tno_conservative: [59, 130, 246],   // Blue
      tno_scenario: [16, 185, 129],       // Green
      operator: [249, 115, 22],           // Orange
    };

    let currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    for (const source of dataSources) {
      const sourceTotals = calcTotalsForSource(source);
      const sourceInfo = DATA_SOURCES[source];

      // Check if we need a new page
      if (currentY > 220) {
        doc.addPage();
        currentY = 20;
      }

      // Section header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(sourceColors[source][0], sourceColors[source][1], sourceColors[source][2]);
      doc.text(`${sourceInfo.name}`, 14, currentY);
      doc.setTextColor(0);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(sourceInfo.description, 14, currentY + 5);

      const savingsData = [
        ['Brandstof/jaar', `${sourceTotals.annualFuelSavings.toFixed(0)} L`],
        ['CO2/jaar', `${(sourceTotals.annualCo2Savings / 1000).toFixed(1)} ton`],
        ['NOx/jaar', `${(sourceTotals.annualNoxSavings / 1000).toFixed(1)} kg`],
        ['Bedrijfsvoordeel/jaar', `EUR ${sourceTotals.annualBusinessSavings.toFixed(0)}`],
        ['Maatschappelijk/jaar', `EUR ${sourceTotals.annualSocietalSavings.toFixed(0)}`],
      ];

      autoTable(doc, {
        startY: currentY + 8,
        head: [],
        body: savingsData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45 },
          1: { cellWidth: 40 },
        },
        tableWidth: 90,
      });

      currentY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Route details - new page
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Route Details', 14, 20);

    const tableHeaders = [['#', 'Herkomst', 'Bestemming', 'km', 'VRI', 'Prio', 'TNO Cons.', 'TNO Scenario', 'Praktijk']];
    const tableData = validResults.map((r, i) => [
      (i + 1).toString(),
      r.originName.length > 15 ? r.originName.substring(0, 13) + '..' : r.originName,
      r.destinationName.length > 15 ? r.destinationName.substring(0, 13) + '..' : r.destinationName,
      r.distanceKm.toFixed(0),
      r.trafficLightsOnRoute.toString(),
      r.trafficLightsWithLogistics.toString(),
      `${r.savingsBySource.tno_conservative.fuelSavingsLiters.toFixed(2)}L`,
      `${r.savingsBySource.tno_scenario.fuelSavingsLiters.toFixed(2)}L`,
      `${r.savingsBySource.operator.fuelSavingsLiters.toFixed(2)}L`,
    ]);

    autoTable(doc, {
      startY: 26,
      head: tableHeaders,
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [75, 85, 99], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 28 },
        2: { cellWidth: 28 },
        3: { cellWidth: 12 },
        4: { cellWidth: 12 },
        5: { cellWidth: 12 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
        8: { cellWidth: 22 },
      },
    });

    // Footer with disclaimer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128);
      doc.text(
        'Disclaimer: De berekeningen in dit rapport zijn uitsluitend bedoeld ter indicatie. Gebruik is geheel op eigen risico.',
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        `Pagina ${i} van ${pageCount} | Transport Beat BV`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    doc.save('transport-analyse-rapport.pdf');
  }, [bulkResults, bulkTotals]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Transport Analyse</h1>
          <span className="text-sm text-gray-500 hidden sm:inline">
            Bereken brandstof- en emissiebesparing met iVRI prioriteit
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setBulkMode(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              !bulkMode
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Enkele route
          </button>
          <button
            onClick={() => setBulkMode(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              bulkMode
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Bulk analyse
          </button>
        </div>

        {!bulkMode ? (
          /* Single route analysis */
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left column: Form and results */}
            <div className="space-y-6">
              {/* Input form */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Route invoeren</h2>

                <div className="space-y-4">
                  <AddressInput
                    value={originInput}
                    onChange={setOriginInput}
                    label="Herkomst"
                    placeholder="Bijv. Rotterdam Centraal, Industrieweg 10"
                  />

                  <AddressInput
                    value={destinationInput}
                    onChange={setDestinationInput}
                    label="Bestemming"
                    placeholder="Bijv. Amsterdam Schiphol, Distributiecentrum"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Voertuigtype
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(VEHICLE_PROFILES).map((profile) => (
                        <button
                          key={profile.type}
                          onClick={() => setVehicleType(profile.type)}
                          className={`p-3 rounded-lg border text-left transition ${
                            vehicleType === profile.type
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{profile.name}</div>
                          <div className="text-xs text-gray-500">{profile.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ritten per dag
                    </label>
                    <input
                      type="number"
                      value={tripsPerDay}
                      onChange={(e) => setTripsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={20}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={analyzeRoute}
                      disabled={analyzing || !originInput || !destinationInput || dataLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {analyzing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                          Analyseren...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Analyseer route
                        </>
                      )}
                    </button>
                    <button
                      onClick={loadExampleRoute}
                      className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition"
                      title={`Voorbeeldroute: ${EXAMPLE_ROUTE.description}`}
                    >
                      Voorbeeld
                    </button>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  {error}
                </div>
              )}

              {/* Results */}
              {analysis && (
                <div className="space-y-4">
                  {/* Route info */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Route informatie</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Afstand</div>
                        <div className="text-xl font-bold text-gray-900">
                          {analysis.distanceKm.toFixed(1)} km
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Rijtijd</div>
                        <div className="text-xl font-bold text-gray-900">
                          {Math.round(analysis.durationMinutes)} min
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Verkeerslichten op route</div>
                        <div className="text-xl font-bold text-gray-900">
                          {analysis.trafficLightsOnRoute}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Met logistiek prioriteit</div>
                        <div className="text-xl font-bold text-green-600">
                          {analysis.trafficLightsWithLogistics}
                        </div>
                      </div>
                    </div>

                    {/* Excluded traffic lights info */}
                    {excludedTrafficLightIds.size > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-orange-600">{excludedTrafficLightIds.size}</span> verkeerslicht(en) handmatig uitgesloten
                          </div>
                          <button
                            onClick={resetExcludedTrafficLights}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            Reset uitsluitingen
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Klik op een verkeerslicht op de kaart om deze uit te sluiten
                        </p>
                      </div>
                    )}

                    {/* Hint when no exclusions */}
                    {excludedTrafficLightIds.size === 0 && analysis.trafficLightsOnRoute > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Tip: Klik op een verkeerslicht op de kaart en kies &quot;Uitsluiten&quot; om foutieve verkeerslichten te verwijderen
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Calculation Mode Toggle */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Berekeningswijze</h3>
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setCalculationMode('simple')}
                        className={`flex-1 p-3 rounded-lg border text-left transition ${
                          calculationMode === 'simple'
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">Simpel</div>
                        <div className="text-xs text-gray-500">Snelle schatting met TNO vuistregel (0.12L) en praktijkmeting (1L/stop)</div>
                      </button>
                      <button
                        onClick={() => setCalculationMode('advanced')}
                        className={`flex-1 p-3 rounded-lg border text-left transition ${
                          calculationMode === 'advanced'
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">Geavanceerd</div>
                        <div className="text-xs text-gray-500">Per-VRI scenario model met no-stop/afremmen/stop berekening</div>
                      </button>
                    </div>
                  </div>

                  {/* Simple Mode Results */}
                  {calculationMode === 'simple' && simpleModeResult && (
                    <>
                      {/* Simple Mode Bandwidth */}
                      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          Besparingsbereik per rit
                          <span className="text-sm font-normal text-gray-500 ml-2">(conservatief - liberaal)</span>
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-gray-600 text-sm font-medium mb-1">Brandstof</div>
                            <div className="text-lg font-bold text-gray-900">
                              {simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} - {simpleModeResult.liberal.fuelSavingsLiters.toFixed(2)} L
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 text-sm font-medium mb-1">CO2</div>
                            <div className="text-lg font-bold text-gray-900">
                              {simpleModeResult.conservative.co2SavingsKg.toFixed(2)} - {simpleModeResult.liberal.co2SavingsKg.toFixed(2)} kg
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 text-sm font-medium mb-1">Maatschappelijk</div>
                            <div className="text-lg font-bold text-gray-900">
                              EUR {simpleModeResult.conservative.totalSocietalSavings.toFixed(2)} - {simpleModeResult.liberal.totalSocietalSavings.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="text-gray-600 text-xs font-medium mb-1">Conservatief (TNO vuistregel)</div>
                            <div className="text-gray-800 text-sm">
                              {analysis.trafficLightsWithLogistics} VRI&apos;s x {SIMPLE_MODE_VALUES[vehicleType].conservative} L = <strong>{simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} L</strong>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="text-gray-600 text-xs font-medium mb-1">Liberaal (praktijkmeting)</div>
                            <div className="text-gray-800 text-sm">
                              {analysis.trafficLightsWithLogistics} VRI&apos;s x {SIMPLE_MODE_VALUES[vehicleType].liberal} L = <strong>{simpleModeResult.liberal.fuelSavingsLiters.toFixed(2)} L</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Simple Mode Savings per trip - Conservative */}
                      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          Besparing per rit
                          <span className="text-sm font-normal text-gray-500 ml-2">(conservatief scenario)</span>
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-600 text-sm font-medium">Brandstof</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} L
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-600 text-sm font-medium">CO2</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {simpleModeResult.conservative.co2SavingsKg.toFixed(2)} kg
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-600 text-sm font-medium">NOx</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {simpleModeResult.conservative.noxSavingsGrams.toFixed(0)} g
                            </div>
                          </div>
                        </div>
                        {/* Split: Business vs Societal benefits */}
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-gray-800 font-medium">Bedrijfsvoordeel</span>
                                <div className="text-xs text-gray-500">Directe brandstofkostenbesparing</div>
                              </div>
                              <span className="text-xl font-bold text-gray-900">
                                EUR {simpleModeResult.conservative.businessFuelCostSavings.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-gray-800 font-medium">Maatschappelijk voordeel</span>
                                <div className="text-xs text-gray-500">CO2 + NOx schadekosten (externe baten)</div>
                              </div>
                              <span className="text-xl font-bold text-gray-900">
                                EUR {simpleModeResult.conservative.totalSocietalSavings.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Explanation */}
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                            Hoe is dit berekend?
                          </summary>
                          <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                            <p className="text-gray-700 mb-3">
                              De besparing per rit wordt berekend op basis van het aantal VRI&apos;s met logistiek prioriteit op de route.
                            </p>

                            <div className="space-y-2 text-xs text-gray-600">
                              <div className="p-2 bg-white rounded border border-blue-200">
                                <strong>Brandstof:</strong> {analysis.trafficLightsWithLogistics} VRI&apos;s × {SIMPLE_MODE_VALUES[vehicleType].conservative} L = {simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} L
                              </div>
                              <div className="p-2 bg-white rounded border border-blue-200">
                                <strong>CO2:</strong> {simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} L × 2,64 kg/L = {simpleModeResult.conservative.co2SavingsKg.toFixed(2)} kg
                              </div>
                              <div className="p-2 bg-white rounded border border-blue-200">
                                <strong>NOx:</strong> {simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} L × 85 g/L = {simpleModeResult.conservative.noxSavingsGrams.toFixed(0)} g
                              </div>
                            </div>

                            <div className="mt-3 space-y-2 text-xs">
                              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                <strong className="text-gray-800">Bedrijfsvoordeel (directe besparing):</strong>
                                <div className="mt-1 text-gray-600">
                                  Brandstofkosten: {simpleModeResult.conservative.fuelSavingsLiters.toFixed(2)} L × €1,65/L = <strong>EUR {simpleModeResult.conservative.businessFuelCostSavings.toFixed(2)}</strong>
                                </div>
                              </div>
                              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                <strong className="text-gray-800">Maatschappelijk voordeel (externe baten):</strong>
                                <ul className="mt-1 space-y-1 text-gray-600">
                                  <li>CO2 schadekosten: {simpleModeResult.conservative.co2SavingsKg.toFixed(2)} kg × €0,065/kg = EUR {simpleModeResult.conservative.societalCo2Savings.toFixed(2)}</li>
                                  <li>NOx schadekosten: {(simpleModeResult.conservative.noxSavingsGrams / 1000).toFixed(3)} kg × €6,12/kg = EUR {simpleModeResult.conservative.societalNoxSavings.toFixed(2)}</li>
                                </ul>
                              </div>
                            </div>

                            <p className="mt-3 text-xs text-gray-500">
                              <strong>Bron:</strong> TNO vuistregel 0,12 L per vermeden stop (conservatief)
                            </p>
                          </div>
                        </details>
                      </div>

                      {/* Simple Mode Annual Projection */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Jaarlijkse projectie
                          <span className="text-sm font-normal text-gray-500 ml-2">
                            ({tripsPerDay * 250} ritten/jaar)
                          </span>
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Conservative scenario */}
                          <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                            <div className="text-gray-500 text-sm mb-2">Conservatief scenario</div>
                            <div className="text-gray-500 text-xs mb-3 space-y-1">
                              <div>{(simpleModeResult.conservative.fuelSavingsLiters * tripsPerDay * 250).toFixed(0)} L brandstof/jaar</div>
                              <div>{((simpleModeResult.conservative.co2SavingsKg * tripsPerDay * 250) / 1000).toFixed(2)} ton CO2/jaar</div>
                              <div>{((simpleModeResult.conservative.noxSavingsGrams * tripsPerDay * 250) / 1000).toFixed(1)} kg NOx/jaar</div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Bedrijfsvoordeel:</span>
                                <span className="font-bold text-gray-900">EUR {simpleModeResult.conservative.annualBusinessSavings.toFixed(0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Maatschappelijk:</span>
                                <span className="font-bold text-gray-900">EUR {simpleModeResult.conservative.annualSocietalSavings.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                          {/* Liberal scenario */}
                          <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                            <div className="text-gray-500 text-sm mb-2">Liberaal scenario</div>
                            <div className="text-gray-500 text-xs mb-3 space-y-1">
                              <div>{(simpleModeResult.liberal.fuelSavingsLiters * tripsPerDay * 250).toFixed(0)} L brandstof/jaar</div>
                              <div>{((simpleModeResult.liberal.co2SavingsKg * tripsPerDay * 250) / 1000).toFixed(2)} ton CO2/jaar</div>
                              <div>{((simpleModeResult.liberal.noxSavingsGrams * tripsPerDay * 250) / 1000).toFixed(1)} kg NOx/jaar</div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Bedrijfsvoordeel:</span>
                                <span className="font-bold text-gray-900">EUR {simpleModeResult.liberal.annualBusinessSavings.toFixed(0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Maatschappelijk:</span>
                                <span className="font-bold text-gray-900">EUR {simpleModeResult.liberal.annualSocietalSavings.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Explanation */}
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-blue-700 hover:text-blue-900">
                            Hoe is dit berekend?
                          </summary>
                          <div className="mt-3 p-4 bg-white rounded-lg border border-blue-200 text-sm">
                            <p className="text-gray-700 mb-3">
                              De jaarlijkse projectie is gebaseerd op het aantal ritten per jaar en de besparing per rit.
                            </p>

                            <div className="space-y-3 text-xs">
                              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                <div className="font-medium text-gray-700 mb-2">Aannames:</div>
                                <ul className="space-y-1 text-gray-600">
                                  <li>• {tripsPerDay} rit(ten) per dag</li>
                                  <li>• 250 werkdagen per jaar</li>
                                  <li>• Totaal: {tripsPerDay * 250} ritten per jaar</li>
                                </ul>
                              </div>

                              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                <div className="font-medium text-gray-800 mb-2">Bedrijfsvoordeel (directe kostenbesparing):</div>
                                <div className="text-gray-600">
                                  Brandstofkosten die het bedrijf direct bespaart door minder te tanken.
                                </div>
                                <div className="text-gray-600 mt-1">
                                  Conservatief: EUR {simpleModeResult.conservative.businessFuelCostSavings.toFixed(2)}/rit × {tripsPerDay * 250} = <strong>EUR {simpleModeResult.conservative.annualBusinessSavings.toFixed(0)}/jaar</strong>
                                </div>
                              </div>

                              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                                <div className="font-medium text-gray-800 mb-2">Maatschappelijk voordeel (externe baten):</div>
                                <div className="text-gray-600">
                                  CO2 en NOx schadekosten die de maatschappij bespaart, maar die bedrijven niet direct kunnen verzilveren.
                                </div>
                                <div className="text-gray-600 mt-1">
                                  Conservatief: EUR {simpleModeResult.conservative.totalSocietalSavings.toFixed(2)}/rit × {tripsPerDay * 250} = <strong>EUR {simpleModeResult.conservative.annualSocietalSavings.toFixed(0)}/jaar</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>
                    </>
                  )}

                  {/* Advanced Mode Results */}
                  {calculationMode === 'advanced' && advancedModeResult && (
                    <>
                      {/* Advanced Mode Scenario Summary */}
                      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          Scenario verdeling
                          <span className="text-sm font-normal text-gray-500 ml-2">(per VRI berekend)</span>
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Elk verkeerslicht krijgt een scenario toegewezen op basis van TNO kansverdelingen.
                          Op de kaart kun je per VRI het berekende scenario zien.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-2 pr-4">Scenario</th>
                                <th className="text-right py-2 px-2 text-gray-600">Zonder prioriteit</th>
                                <th className="text-right py-2 px-2 text-gray-600">Met prioriteit</th>
                                <th className="text-right py-2 px-2">Verschuiving</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 pr-4 font-medium flex items-center gap-2">
                                  <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                                  Geen stop
                                </td>
                                <td className="py-2 px-2 text-right text-gray-600">{advancedModeResult.scenarioCounts.without.no_stop}</td>
                                <td className="py-2 px-2 text-right text-green-600 font-medium">{advancedModeResult.scenarioCounts.with.no_stop}</td>
                                <td className="py-2 px-2 text-right">
                                  <span className={advancedModeResult.scenarioCounts.with.no_stop > advancedModeResult.scenarioCounts.without.no_stop ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                    {advancedModeResult.scenarioCounts.with.no_stop > advancedModeResult.scenarioCounts.without.no_stop ? '+' : ''}
                                    {advancedModeResult.scenarioCounts.with.no_stop - advancedModeResult.scenarioCounts.without.no_stop}
                                  </span>
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 pr-4 font-medium flex items-center gap-2">
                                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>
                                  Afremmen
                                </td>
                                <td className="py-2 px-2 text-right text-gray-600">{advancedModeResult.scenarioCounts.without.slow_down}</td>
                                <td className="py-2 px-2 text-right text-yellow-600 font-medium">{advancedModeResult.scenarioCounts.with.slow_down}</td>
                                <td className="py-2 px-2 text-right">
                                  <span className={advancedModeResult.scenarioCounts.with.slow_down < advancedModeResult.scenarioCounts.without.slow_down ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                    {advancedModeResult.scenarioCounts.with.slow_down - advancedModeResult.scenarioCounts.without.slow_down}
                                  </span>
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 pr-4 font-medium flex items-center gap-2">
                                  <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                                  Stop
                                </td>
                                <td className="py-2 px-2 text-right text-gray-600">{advancedModeResult.scenarioCounts.without.stop}</td>
                                <td className="py-2 px-2 text-right text-red-600 font-medium">{advancedModeResult.scenarioCounts.with.stop}</td>
                                <td className="py-2 px-2 text-right">
                                  <span className={advancedModeResult.scenarioCounts.with.stop < advancedModeResult.scenarioCounts.without.stop ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                    {advancedModeResult.scenarioCounts.with.stop - advancedModeResult.scenarioCounts.without.stop}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm border border-gray-200">
                          <div className="font-medium text-gray-700 mb-1">Totale besparing:</div>
                          <div className="text-gray-600">
                            Som van alle VRI-specifieke besparingen = <strong className="text-gray-900">{advancedModeResult.totalFuelSavingsLiters.toFixed(3)} L per rit</strong>
                          </div>
                        </div>

                        {/* Model explanation */}
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                            Hoe werkt deze berekening?
                          </summary>
                          <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                            <p className="text-gray-700 mb-3">
                              De berekening is gebaseerd op TNO-onderzoek (Catalyst Heavy Duty Transport Living Lab)
                              met gemeten kansverdelingen en brandstofverbruik per scenario, aangevuld met
                              praktijkervaring van een marktleidende FMS-partij.
                            </p>

                            <div className="mb-4">
                              <div className="font-medium text-gray-800 mb-2">Kansverdeling per scenario (zwaar vrachtverkeer)</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-blue-200">
                                    <th className="text-left py-1">Scenario</th>
                                    <th className="text-right py-1">Zonder prioriteit</th>
                                    <th className="text-right py-1">Met prioriteit (60%)</th>
                                  </tr>
                                </thead>
                                <tbody className="text-gray-600">
                                  <tr>
                                    <td className="py-1 flex items-center gap-1">
                                      <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span> Geen stop
                                    </td>
                                    <td className="text-right">42,4%</td>
                                    <td className="text-right text-green-700 font-medium">77,0%</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1 flex items-center gap-1">
                                      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span> Afremmen
                                    </td>
                                    <td className="text-right">36,6%</td>
                                    <td className="text-right text-yellow-700 font-medium">14,6%</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1 flex items-center gap-1">
                                      <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span> Stop
                                    </td>
                                    <td className="text-right">21,0%</td>
                                    <td className="text-right text-red-700 font-medium">8,4%</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div className="mb-4">
                              <div className="font-medium text-gray-800 mb-2">Brandstofverbruik per scenario (per 2km passage)</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-blue-200">
                                    <th className="text-left py-1">Scenario</th>
                                    <th className="text-right py-1">Verbruik</th>
                                  </tr>
                                </thead>
                                <tbody className="text-gray-600">
                                  <tr>
                                    <td className="py-1">Geen stop</td>
                                    <td className="text-right">0,57 L</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1">Afremmen</td>
                                    <td className="text-right">0,68 L</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1">Stop</td>
                                    <td className="text-right">0,85 L</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div className="p-3 bg-white rounded border border-blue-200">
                              <div className="font-medium text-gray-800 mb-2">Berekening verwacht verbruik</div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div><strong>Zonder prioriteit:</strong> (42,4% × 0,57) + (36,6% × 0,68) + (21,0% × 0,85) = <strong>0,669 L</strong></div>
                                <div><strong>Met prioriteit:</strong> (77,0% × 0,57) + (14,6% × 0,68) + (8,4% × 0,85) = <strong>0,609 L</strong></div>
                                <div className="pt-1 border-t border-blue-100 mt-1">
                                  <strong className="text-green-700">Besparing per VRI: 0,060 L</strong> (≈ 50% van TNO vuistregel 0,12 L)
                                </div>
                              </div>
                            </div>

                            <p className="mt-3 text-xs text-gray-500">
                              <strong>Prioriteit success rate: 60%</strong> — Van alle prioriteitsverzoeken wordt 60% gehonoreerd.
                              Vrachtwagens die al groen zouden krijgen (geen stop) hebben geen baat bij prioriteit.
                              De besparing komt van vrachtwagens die anders zouden afremmen of stoppen.
                            </p>

                            <p className="mt-2 text-xs text-gray-500">
                              <strong>Bron:</strong> TNO 2020 P11453 - Catalyst Heavy Duty Transport Living Lab
                            </p>
                          </div>
                        </details>
                      </div>

                      {/* Advanced Mode Savings */}
                      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Besparing per rit (geavanceerd)</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-600 text-sm font-medium">Brandstof</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {advancedModeResult.totalFuelSavingsLiters.toFixed(2)} L
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-600 text-sm font-medium">CO2</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {advancedModeResult.totalCo2SavingsKg.toFixed(2)} kg
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-600 text-sm font-medium">NOx</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {advancedModeResult.totalNoxSavingsGrams.toFixed(0)} g
                            </div>
                          </div>
                        </div>
                        {/* Split: Business vs Societal benefits */}
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-gray-800 font-medium">Bedrijfsvoordeel</span>
                                <div className="text-xs text-gray-500">Directe brandstofkostenbesparing</div>
                              </div>
                              <span className="text-xl font-bold text-gray-900">
                                EUR {advancedModeResult.businessFuelCostSavings.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-gray-800 font-medium">Maatschappelijk voordeel</span>
                                <div className="text-xs text-gray-500">CO2 + NOx schadekosten (externe baten)</div>
                              </div>
                              <span className="text-xl font-bold text-gray-900">
                                EUR {advancedModeResult.totalSocietalSavings.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Advanced Mode Annual Projection */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-sm p-6 border border-green-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Jaarlijkse projectie (geavanceerd)
                          <span className="text-sm font-normal text-gray-500 ml-2">
                            ({tripsPerDay * 250} ritten/jaar)
                          </span>
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                            <div className="text-gray-500 text-sm">Brandstof</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {(advancedModeResult.totalFuelSavingsLiters * tripsPerDay * 250).toFixed(0)} L
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                            <div className="text-gray-500 text-sm">CO2</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {((advancedModeResult.totalCo2SavingsKg * tripsPerDay * 250) / 1000).toFixed(2)} ton
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                            <div className="text-gray-500 text-sm">NOx</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {((advancedModeResult.totalNoxSavingsGrams * tripsPerDay * 250) / 1000).toFixed(1)} kg
                            </div>
                          </div>
                        </div>
                        {/* Split: Business vs Societal annual savings */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <div className="text-gray-700 text-sm font-medium">Bedrijfsvoordeel</div>
                            <div className="text-2xl font-bold text-gray-900">
                              EUR {advancedModeResult.annualBusinessSavings.toFixed(0)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Directe kostenbesparing</div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <div className="text-gray-700 text-sm font-medium">Maatschappelijk voordeel</div>
                            <div className="text-2xl font-bold text-gray-900">
                              EUR {advancedModeResult.annualSocietalSavings.toFixed(0)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">CO2 + NOx externe baten</div>
                          </div>
                        </div>
                      </div>

                      {/* Per-Traffic Light Breakdown (Advanced Mode) */}
                      {advancedModeResult.trafficLightScenarios.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Per-VRI details
                            <span className="text-sm font-normal text-gray-500 ml-2">({advancedModeResult.trafficLightScenarios.length} VRI&apos;s met logistiek)</span>
                          </h3>
                          <div className="overflow-x-auto max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-white">
                                <tr className="border-b-2 border-gray-200">
                                  <th className="text-left py-2 pr-4">VRI</th>
                                  <th className="text-center py-2 px-2">Zonder</th>
                                  <th className="text-center py-2 px-2">Met</th>
                                  <th className="text-right py-2 px-2">Besparing</th>
                                </tr>
                              </thead>
                              <tbody>
                                {advancedModeResult.trafficLightScenarios.map((tl) => (
                                  <tr key={tl.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2 pr-4 font-medium text-gray-900">{tl.name}</td>
                                    <td className="py-2 px-2 text-center">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                        tl.expectedScenarioWithout === 'no_stop' ? 'bg-green-100 text-green-700' :
                                        tl.expectedScenarioWithout === 'slow_down' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        <span className={`w-2 h-2 rounded-full ${
                                          tl.expectedScenarioWithout === 'no_stop' ? 'bg-green-500' :
                                          tl.expectedScenarioWithout === 'slow_down' ? 'bg-yellow-500' :
                                          'bg-red-500'
                                        }`}></span>
                                        {SCENARIO_LABELS[tl.expectedScenarioWithout]}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                        tl.expectedScenarioWith === 'no_stop' ? 'bg-green-100 text-green-700' :
                                        tl.expectedScenarioWith === 'slow_down' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        <span className={`w-2 h-2 rounded-full ${
                                          tl.expectedScenarioWith === 'no_stop' ? 'bg-green-500' :
                                          tl.expectedScenarioWith === 'slow_down' ? 'bg-yellow-500' :
                                          'bg-red-500'
                                        }`}></span>
                                        {SCENARIO_LABELS[tl.expectedScenarioWith]}
                                      </span>
                                    </td>
                                    <td className={`py-2 px-2 text-right font-medium ${tl.fuelSavings > 0 ? 'text-green-600' : tl.fuelSavings < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                      {tl.fuelSavings > 0 ? '+' : ''}{tl.fuelSavings.toFixed(3)} L
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}
            </div>

            {/* Right column: Map */}
            <div className="lg:sticky lg:top-4 h-[500px] lg:h-[calc(100vh-8rem)]">
              <div className="bg-white rounded-lg shadow-sm p-2 h-full">
                <RouteMap
                  analysis={analysis}
                  trafficLightData={trafficLightData}
                  excludedTrafficLightIds={excludedTrafficLightIds}
                  onExcludeTrafficLight={handleExcludeTrafficLight}
                  calculationMode={calculationMode}
                  advancedModeResult={advancedModeResult}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Bulk analysis mode */
          <div className="space-y-6">
            {/* Payment success message */}
            {paymentSuccessMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-800">{paymentSuccessMessage}</span>
                <button
                  onClick={() => setPaymentSuccessMessage(null)}
                  className="ml-auto text-green-600 hover:text-green-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Upload section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Bulk analyse uploaden
              </h2>
              <p className="text-gray-600 mb-4">
                Upload een CSV bestand of CBS Wegvervoer XML bestand met gerealiseerde ritten.
                Lukt het niet? <a href="https://calendly.com/robbertjanssen" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Neem contact op</a>
              </p>

              {/* Format tabs */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Ondersteunde formaten:</div>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* CSV Format */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium text-gray-900">CSV / Excel</span>
                    </div>
                    <div className="font-mono text-xs text-gray-600 space-y-1">
                      <div className="text-gray-500">Kolommen:</div>
                      <div>herkomst;bestemming;voertuigtype;ritten_per_dag</div>
                      <div className="text-gray-400 mt-1">Voorbeeld:</div>
                      <div>Rotterdam;Amsterdam;heavy;2</div>
                    </div>
                  </div>

                  {/* CBS XML Format */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0V5.625c0-.621-.504-1.125-1.125-1.125H5.25c-.621 0-1.125.504-1.125 1.125v12m10.125-12h2.25c.621 0 1.152.416 1.32 1.007l1.68 5.93m0 0H14.25m2.25-6.937V9" />
                      </svg>
                      <span className="font-medium text-gray-900">CBS Wegvervoer XML</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="text-gray-500">Gerealiseerde ritten uit TMS</div>
                      <div>Gebruikt herkomst/bestemming locaties</div>
                      <div>Voertuigtype bepaald op basis van:</div>
                      <ul className="list-disc list-inside text-gray-500 ml-2">
                        <li>Kenteken patroon</li>
                        <li>Laadvermogen trailer</li>
                        <li>Brutogewicht lading</li>
                      </ul>
                    </div>
                    <a
                      href="https://www.cbs.nl/nl-nl/deelnemers-enquetes/deelnemers-enquetes/bedrijven/onderzoek/wegvervoer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                    >
                      CBS Wegvervoer info →
                    </a>
                  </div>
                </div>
              </div>

              {/* Dropzone */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !bulkAnalyzing && !dataLoading && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                } ${bulkAnalyzing || dataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xml"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {bulkAnalyzing ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span className="text-blue-600 font-medium">Analyseren...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div>
                      <span className="text-blue-600 font-medium">Klik om bestanden te selecteren</span>
                      <span className="text-gray-500"> of sleep ze hierheen</span>
                    </div>
                    <p className="text-xs text-gray-400">CSV, TXT, XLSX of XML (meerdere bestanden mogelijk)</p>
                  </div>
                )}
              </div>

              {/* Export buttons */}
              {bulkResults.length > 0 && (
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={exportResultsPDF}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    PDF Rapport
                  </button>
                  <button
                    onClick={exportResultsCSV}
                    className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    CSV Export
                  </button>
                </div>
              )}

              {/* Progress indicator */}
              {bulkProgress && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span className="font-medium text-blue-900">
                      Verwerken: {bulkProgress.current} van {bulkProgress.total} routes
                    </span>
                  </div>
                  <div className="text-sm text-blue-700 truncate">
                    {bulkProgress.currentTrip}
                  </div>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Usage info */}
              <div className="mt-3 text-sm text-gray-500">
                Gratis: tot {FREE_TIER_MAX_ROUTES} ritten | Daarboven: &euro;0,05 per rit (max {MAX_ROUTES_PER_ANALYSIS.toLocaleString('nl-NL')} ritten)
              </div>

              {/* Limit error messages */}
              {bulkLimitError === 'daily_limit' && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-red-800">Dagelijks limiet bereikt</h4>
                      <p className="text-red-700 mt-1">
                        U heeft het maximum van {MAX_BULK_ANALYSES_PER_DAY} gratis bulk analyses per 24 uur bereikt.
                      </p>
                      <p className="text-red-700 mt-2">
                        Voor onbeperkte bulk analyses met professionele PTV routering kunt u contact opnemen:
                      </p>
                      <a
                        href="https://calendly.com/robbertjanssen"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Plan een gesprek
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Source selection for bulk */}
            {bulkResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Databron selectie</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.values(DATA_SOURCES).map((source) => (
                    <button
                      key={source.id}
                      onClick={() => setSelectedSource(source.id)}
                      className={`p-3 rounded-lg border text-left transition ${
                        selectedSource === source.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900 text-sm">{source.name}</div>
                      <div className="text-xs text-gray-500">{source.description}</div>
                      <div className="text-xs text-blue-600 mt-1">{source.heavyFuelSavingsPerStop} L/stop (zwaar)</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bulk totals with bandwidth */}
            {bulkTotals && (
              <div className="space-y-4">
                {/* Bandwidth summary */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Besparingsbereik (alle routes)
                    <span className="text-sm font-normal text-gray-500 ml-2">(min - max)</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-gray-600 text-sm font-medium mb-1">Brandstof/jaar</div>
                      <div className="text-lg font-bold text-gray-900">
                        {bulkTotals.minAnnualFuelSavings.toFixed(0)} - {bulkTotals.maxAnnualFuelSavings.toFixed(0)} L
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm font-medium mb-1">CO2/jaar</div>
                      <div className="text-lg font-bold text-gray-900">
                        {(bulkTotals.minAnnualCo2Savings / 1000).toFixed(1)} - {(bulkTotals.maxAnnualCo2Savings / 1000).toFixed(1)} ton
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm font-medium mb-1">Maatschappelijk/jaar</div>
                      <div className="text-lg font-bold text-gray-900">
                        EUR {bulkTotals.minAnnualTotalSavings.toFixed(0)} - {bulkTotals.maxAnnualTotalSavings.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected source totals */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-sm p-6 border border-green-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Totale jaarlijkse besparing ({DATA_SOURCES[selectedSource].name})
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({bulkTotals.validRoutes} van {bulkTotals.totalRoutes} routes)
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                      <div className="text-gray-500 text-sm">Totale afstand</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {bulkTotals.totalDistance.toFixed(0)} km
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                      <div className="text-gray-500 text-sm">Brandstof</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {bulkTotals.annualFuelSavings.toFixed(0)} L
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                      <div className="text-gray-500 text-sm">CO2</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {(bulkTotals.annualCo2Savings / 1000).toFixed(1)} ton
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                      <div className="text-gray-500 text-sm">NOx</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {(bulkTotals.annualNoxSavings / 1000).toFixed(1)} kg
                      </div>
                    </div>
                  </div>
                  {/* Business vs Societal split */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="text-gray-700 text-sm font-medium">Bedrijfsvoordeel</div>
                      <div className="text-2xl font-bold text-gray-900">
                        EUR {bulkTotals.annualBusinessSavings.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Directe brandstofkostenbesparing</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="text-gray-700 text-sm font-medium">Maatschappelijk voordeel</div>
                      <div className="text-2xl font-bold text-gray-900">
                        EUR {bulkTotals.annualSocietalSavings.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">CO2 + NOx externe baten</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Map with all routes */}
            {bulkResults.length > 0 && bulkResults.some(r => r.routeGeometry.length > 0) && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Routes overzicht</h3>
                <div className="h-[400px] rounded-lg overflow-hidden">
                  <BulkRouteMap
                    results={bulkResults}
                    trafficLightData={trafficLightData}
                    selectedIndex={selectedBulkResultIndex}
                    onSelectRoute={setSelectedBulkResultIndex}
                  />
                </div>
              </div>
            )}

            {/* Results table */}
            {bulkResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Route</th>
                        {/* Show vehicle column if any result has RDW data */}
                        {bulkResults.some(r => r.rdwVehicleDetails) && (
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Voertuig (RDW)</th>
                        )}
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Afstand</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">VRI&apos;s</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Met prioriteit</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Brandstof/rit (bereik)</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Jaarlijks (bereik)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkResults.map((result, index) => (
                        <tr
                          key={index}
                          onClick={() => setSelectedBulkResultIndex(selectedBulkResultIndex === index ? null : index)}
                          className={`cursor-pointer transition-colors ${
                            result.error
                              ? 'bg-red-50 hover:bg-red-100'
                              : selectedBulkResultIndex === index
                                ? 'bg-blue-50 ring-2 ring-inset ring-blue-500'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-4 text-sm text-gray-400">{index + 1}</td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">
                              {result.originName}
                            </div>
                            <div className="text-sm text-gray-500">
                              naar {result.destinationName}
                            </div>
                            {result.error && (
                              <div className="text-xs text-red-600">{result.error}</div>
                            )}
                          </td>
                          {/* RDW Vehicle details column */}
                          {bulkResults.some(r => r.rdwVehicleDetails) && (
                            <td className="py-3 px-4">
                              {result.rdwVehicleDetails ? (
                                <div className="text-xs">
                                  <div className="font-medium text-gray-900">
                                    {result.rdwVehicleDetails.brand} {result.rdwVehicleDetails.model || ''}
                                  </div>
                                  <div className="text-gray-500">
                                    {result.rdwVehicleDetails.licenseNumber}
                                  </div>
                                  <div className="text-gray-400">
                                    {result.rdwVehicleDetails.vehicleType} ({result.rdwVehicleDetails.euCategory})
                                  </div>
                                  {(result.rdwVehicleDetails.emptyWeightKg || result.rdwVehicleDetails.maxCombinationWeightKg) && (
                                    <div className="text-gray-400">
                                      {result.rdwVehicleDetails.emptyWeightKg && `${result.rdwVehicleDetails.emptyWeightKg} kg leeg`}
                                      {result.rdwVehicleDetails.emptyWeightKg && result.rdwVehicleDetails.maxCombinationWeightKg && ' / '}
                                      {result.rdwVehicleDetails.maxCombinationWeightKg && `${result.rdwVehicleDetails.maxCombinationWeightKg} kg max`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  {result.vehicleType === 'heavy' ? 'Zwaar' : 'Licht'}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">
                            {result.distanceKm.toFixed(1)} km
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">
                            {result.trafficLightsOnRoute}
                          </td>
                          <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                            {result.trafficLightsWithLogistics}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">
                            <span className="text-gray-400">{result.savingsBandwidth.minFuelSavingsLiters.toFixed(2)}</span>
                            {' - '}
                            <span className="font-medium">{result.savingsBandwidth.maxFuelSavingsLiters.toFixed(2)} L</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            <span className="text-gray-400">EUR {result.savingsBandwidth.minAnnualTotalSavings.toFixed(0)}</span>
                            {' - '}
                            <span className="font-medium text-blue-600">EUR {result.savingsBandwidth.maxAnnualTotalSavings.toFixed(0)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Methodology */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Methodologie</h2>
          <div className="text-sm text-gray-600 space-y-3">
            <p>
              Gebaseerd op TNO onderzoek en praktijkmetingen. Bandbreedte: TNO scenario model (conservatief) tot praktijkmetingen transportbedrijven (optimistisch).
            </p>

            {/* Combined table */}
            <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1.5">Bron</th>
                    <th className="text-right py-1.5">Zwaar (&gt;30t)</th>
                    <th className="text-right py-1.5">Licht (&lt;30t)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-1.5">TNO conservatief</td>
                    <td className="text-right">{DATA_SOURCES.tno_conservative.heavyFuelSavingsPerStop} L/stop</td>
                    <td className="text-right">{DATA_SOURCES.tno_conservative.lightFuelSavingsPerStop} L/stop</td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1.5">Praktijk (transportbedrijven)</td>
                    <td className="text-right">{DATA_SOURCES.operator.heavyFuelSavingsPerStop} L/stop</td>
                    <td className="text-right">{DATA_SOURCES.operator.lightFuelSavingsPerStop} L/stop</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Assumptions in compact grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
              <div>CO2: {CO2_PER_LITER_DIESEL} kg/L diesel</div>
              <div>NOx: {NOX_PER_LITER_DIESEL_IDLE} g/L diesel</div>
              <div>Diesel: EUR {MONETARY_VALUES.dieselPricePerLiter.toFixed(2)}/L</div>
              <div>CO2: EUR {MONETARY_VALUES.co2PricePerTonne}/ton</div>
            </div>

            {/* Sources inline */}
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-200">
              Bronnen:{' '}
              <a href="https://publications.tno.nl/publication/34637725/OD9P2q/TNO-2020-P11453.pdf"
                 target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                TNO 2020
              </a>
              {' | '}
              <a href="https://www.talking-traffic.com/nl/nieuws/brandstofbesparing-bij-ivri-s-voor-vrachtwagens-de-eerste-cijfers"
                 target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                Talking Traffic
              </a>
              {' | '}
              <a href="https://www.ecocostsvalue.com/ecocosts/eco-costs-emissions/"
                 target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                Eco-costs 2024
              </a>
            </div>
          </div>
        </div>

        {/* Attribution */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Verkeerslichten:{' '}
            <a
              href="https://map.udap.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              UDAP
            </a>
            {' | '}
            Geocoding:{' '}
            <a
              href="https://www.pdok.nl/geo-services/-/staticmap/service/locatieserver"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              PDOK Locatieserver
            </a>
            {' | '}
            Routing:{' '}
            <a
              href="https://openrouteservice.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              OpenRouteService
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            <strong>Disclaimer:</strong> De berekeningen en schattingen in deze tool zijn uitsluitend bedoeld ter indicatie en zijn gebaseerd op openbaar beschikbaar onderzoek. Gebruik is geheel op eigen risico.
          </p>
        </div>
      </main>

      {/* Column Mapping Preview Modal */}
      {showColumnPreview && detectedColumns && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bestand preview</h3>
              <button
                onClick={handlePreviewCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-blue-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">{pendingTripCount} ritten gevonden</span>
                <span className="text-sm text-blue-700">({detectedColumns.fileType.toUpperCase()} bestand)</span>
              </div>
            </div>

            {/* Detected Columns */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Gedetecteerde kolommen:</h4>
              <div className="flex flex-wrap gap-2">
                {detectedColumns.hasOriginAddress && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Herkomst adres
                  </span>
                )}
                {detectedColumns.hasDestinationAddress && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Bestemming adres
                  </span>
                )}
                {detectedColumns.hasOriginCoords && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Herkomst coördinaten
                  </span>
                )}
                {detectedColumns.hasDestinationCoords && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Bestemming coördinaten
                  </span>
                )}
                {detectedColumns.hasLicensePlate && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Kenteken
                  </span>
                )}
                {detectedColumns.hasTripsPerDay && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Ritten per dag
                  </span>
                )}
                {detectedColumns.hasTimestamp && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Datum/tijd
                  </span>
                )}
                {(detectedColumns.hasOriginPostalCode || detectedColumns.hasDestinationPostalCode) && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Postcodes
                  </span>
                )}
              </div>

              {/* Warning for missing coordinates */}
              {!detectedColumns.hasOriginCoords && !detectedColumns.hasDestinationCoords && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-yellow-800">
                      <strong>Let op:</strong> Geen coördinaten gevonden. Adressen worden omgezet via geocoding, wat minder nauwkeurig kan zijn.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Table */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (eerste {previewRows.length} rijen):</h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">#</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Herkomst</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">Bestemming</th>
                      {detectedColumns.hasOriginCoords && (
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Coord. herkomst</th>
                      )}
                      {detectedColumns.hasDestinationCoords && (
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Coord. bestemming</th>
                      )}
                      {detectedColumns.hasLicensePlate && (
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Kenteken</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate" title={row.origin}>{row.origin}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate" title={row.destination}>{row.destination}</td>
                        {detectedColumns.hasOriginCoords && (
                          <td className="px-3 py-2 text-gray-500 font-mono">
                            {row.originLat !== undefined ? `${row.originLat.toFixed(4)}, ${row.originLng?.toFixed(4)}` : '-'}
                          </td>
                        )}
                        {detectedColumns.hasDestinationCoords && (
                          <td className="px-3 py-2 text-gray-500 font-mono">
                            {row.destinationLat !== undefined ? `${row.destinationLat.toFixed(4)}, ${row.destinationLng?.toFixed(4)}` : '-'}
                          </td>
                        )}
                        {detectedColumns.hasLicensePlate && (
                          <td className="px-3 py-2 text-gray-700 font-mono">{row.licenseNumber || '-'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRowsCache.length > 5 && (
                <p className="text-xs text-gray-500 mt-2">... en {parsedRowsCache.length - 5} meer rijen</p>
              )}
            </div>

            {/* Pricing info */}
            {pendingTripCount > FREE_TIER_MAX_ROUTES && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Totaal ritten:</span>
                  <span className="text-gray-900">{pendingTripCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gratis ritten:</span>
                  <span className="text-gray-900">-{FREE_TIER_MAX_ROUTES}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-600">Betaalde ritten:</span>
                  <span className="text-gray-900">{pendingTripCount - FREE_TIER_MAX_ROUTES} x €0,05</span>
                </div>
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200">
                  <span className="text-gray-900">Te betalen:</span>
                  <span className="text-blue-600">€{((pendingTripCount - FREE_TIER_MAX_ROUTES) * PRICE_PER_TRIP).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            )}

            {pendingTripCount <= FREE_TIER_MAX_ROUTES && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-green-800 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Gratis analyse (max {FREE_TIER_MAX_ROUTES} ritten)
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handlePreviewCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Annuleren
              </button>
              <button
                onClick={handlePreviewConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {pendingTripCount > FREE_TIER_MAX_ROUTES ? 'Doorgaan naar betaling' : 'Start analyse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Betaling vereist</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPendingFiles([]);
                  setPendingTripCount(0);
                  setParsedRowsCache([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">
                Uw bestand bevat <strong>{pendingTripCount} ritten</strong>. De eerste {FREE_TIER_MAX_ROUTES} ritten zijn gratis.
              </p>

              {getPriceForTripCount(pendingTripCount) && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Totaal ritten:</span>
                    <span className="text-gray-900">{pendingTripCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gratis ritten:</span>
                    <span className="text-gray-900">-{FREE_TIER_MAX_ROUTES}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="text-gray-600">Betaalde ritten:</span>
                    <span className="text-gray-900">{getPriceForTripCount(pendingTripCount)?.paidTrips} x &euro;0,05</span>
                  </div>
                </div>
              )}

              {getPriceForTripCount(pendingTripCount) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-900">Te betalen:</span>
                    <span className="text-2xl font-bold text-blue-900">
                      &euro;{getPriceForTripCount(pendingTripCount)?.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPendingFiles([]);
                    setPendingTripCount(0);
                    setParsedRowsCache([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => createPayment(pendingTripCount, paymentSessionId)}
                  disabled={paymentProcessing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition flex items-center justify-center gap-2"
                >
                  {paymentProcessing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Verwerken...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Betalen via iDEAL
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Veilig betalen via Mollie. U wordt doorgestuurd naar uw bank.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal (for > 1950 trips) */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Enterprise analyse</h3>
              <button
                onClick={() => {
                  setShowContactModal(false);
                  setPendingTripCount(0);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-amber-800 font-medium">
                      Uw bestand bevat {pendingTripCount.toLocaleString('nl-NL')} ritten
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      Voor analyses met meer dan 1.750 ritten bieden wij enterprise oplossingen met professionele PTV routering.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-gray-600">
                Plan een vrijblijvend gesprek om uw analyse requirements te bespreken:
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    setPendingTripCount(0);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Sluiten
                </button>
                <a
                  href="https://calendly.com/robbertjanssen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Plan gesprek
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
