'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { RouteAnalysis, AdvancedModeResult, TrafficLightScenario, CalculationMode } from '@/types/transport-analysis';
import { TrafficLightData, PRIORITY_INFO } from '@/types/traffic-lights';

interface RouteMapProps {
  analysis: RouteAnalysis | null;
  trafficLightData: TrafficLightData | null;
  excludedTrafficLightIds?: Set<string>;
  onExcludeTrafficLight?: (id: string) => void;
  calculationMode?: CalculationMode;
  advancedModeResult?: AdvancedModeResult | null;
}

// Scenario colors for traffic lights
const SCENARIO_COLORS: Record<TrafficLightScenario, string> = {
  no_stop: '#22c55e',   // green
  slow_down: '#eab308', // yellow
  stop: '#ef4444',      // red
};

const SCENARIO_LABELS: Record<TrafficLightScenario, string> = {
  no_stop: 'Geen stop',
  slow_down: 'Afremmen',
  stop: 'Stop',
};

// Custom marker icons
const createCustomIcon = (color: string, size: number = 25) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Traffic light icon - SVG based
const createTrafficLightIcon = (hasLogistics: boolean, size: number = 28) => {
  const bgColor = hasLogistics ? '#16a34a' : '#6b7280';
  const glowColor = hasLogistics ? '#22c55e' : '#9ca3af';

  return L.divIcon({
    className: 'traffic-light-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size * 1.4}px;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <svg viewBox="0 0 24 34" width="${size}" height="${size * 1.4}" xmlns="http://www.w3.org/2000/svg">
          <!-- Pole -->
          <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
          <!-- Housing -->
          <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3" stroke="#374151" stroke-width="1"/>
          <!-- Top light (red) -->
          <circle cx="12" cy="8" r="4" fill="${hasLogistics ? '#374151' : '#ef4444'}" opacity="${hasLogistics ? '0.3' : '1'}"/>
          <!-- Middle light (yellow) -->
          <circle cx="12" cy="16" r="4" fill="#374151" opacity="0.3"/>
          <!-- Bottom light (green) -->
          <circle cx="12" cy="24" r="4" fill="${hasLogistics ? '#22c55e' : '#374151'}" opacity="${hasLogistics ? '1' : '0.3'}"/>
          ${hasLogistics ? `<circle cx="12" cy="24" r="6" fill="${glowColor}" opacity="0.3"/>` : ''}
        </svg>
      </div>
    `,
    iconSize: [size, size * 1.4],
    iconAnchor: [size / 2, size * 1.4],
    popupAnchor: [0, -size * 1.2],
  });
};

// Traffic light icon with scenario coloring (for advanced mode)
const createScenarioTrafficLightIcon = (scenario: TrafficLightScenario, size: number = 28) => {
  const isGreen = scenario === 'no_stop';
  const isYellow = scenario === 'slow_down';
  const isRed = scenario === 'stop';
  const activeColor = SCENARIO_COLORS[scenario];

  return L.divIcon({
    className: 'traffic-light-marker-scenario',
    html: `
      <div style="
        width: ${size}px;
        height: ${size * 1.4}px;
        position: relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <svg viewBox="0 0 24 34" width="${size}" height="${size * 1.4}" xmlns="http://www.w3.org/2000/svg">
          <!-- Pole -->
          <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
          <!-- Housing -->
          <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3" stroke="#374151" stroke-width="1"/>
          <!-- Top light (red) -->
          <circle cx="12" cy="8" r="4" fill="${isRed ? '#ef4444' : '#374151'}" opacity="${isRed ? '1' : '0.3'}"/>
          ${isRed ? '<circle cx="12" cy="8" r="6" fill="#ef4444" opacity="0.3"/>' : ''}
          <!-- Middle light (yellow) -->
          <circle cx="12" cy="16" r="4" fill="${isYellow ? '#eab308' : '#374151'}" opacity="${isYellow ? '1' : '0.3'}"/>
          ${isYellow ? '<circle cx="12" cy="16" r="6" fill="#eab308" opacity="0.3"/>' : ''}
          <!-- Bottom light (green) -->
          <circle cx="12" cy="24" r="4" fill="${isGreen ? '#22c55e' : '#374151'}" opacity="${isGreen ? '1' : '0.3'}"/>
          ${isGreen ? '<circle cx="12" cy="24" r="6" fill="#22c55e" opacity="0.3"/>' : ''}
        </svg>
      </div>
    `,
    iconSize: [size, size * 1.4],
    iconAnchor: [size / 2, size * 1.4],
    popupAnchor: [0, -size * 1.2],
  });
};

const trafficLightWithLogistics = createTrafficLightIcon(true, 24);
const trafficLightWithoutLogistics = createTrafficLightIcon(false, 20);

const originIcon = createCustomIcon('#22c55e', 30);
const destinationIcon = createCustomIcon('#ef4444', 30);

// Component to fit bounds when route changes
function FitBounds({ analysis }: { analysis: RouteAnalysis | null }) {
  const map = useMap();

  useEffect(() => {
    if (analysis && analysis.routeGeometry.length > 0) {
      const bounds = L.latLngBounds(
        analysis.routeGeometry.map(([lng, lat]) => [lat, lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [analysis, map]);

  return null;
}

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

// Check if a point is near a route (using proper Haversine distance)
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

export default function RouteMap({
  analysis,
  trafficLightData,
  excludedTrafficLightIds = new Set(),
  onExcludeTrafficLight,
  calculationMode = 'simple',
  advancedModeResult = null
}: RouteMapProps) {
  // Netherlands default center
  const defaultCenter: [number, number] = [52.1326, 5.2913];
  const defaultZoom = 8;

  // Create a map of traffic light IDs to their scenarios (for advanced mode)
  const scenarioMap = useMemo(() => {
    const map = new Map<string, { scenarioWithout: TrafficLightScenario; scenarioWith: TrafficLightScenario; fuelSavings: number }>();
    if (advancedModeResult) {
      for (const tl of advancedModeResult.trafficLightScenarios) {
        map.set(tl.id, {
          scenarioWithout: tl.expectedScenarioWithout,
          scenarioWith: tl.expectedScenarioWith,
          fuelSavings: tl.fuelSavings
        });
      }
    }
    return map;
  }, [advancedModeResult]);

  // Find traffic lights on route (excluding manually excluded ones)
  const trafficLightsOnRoute = useMemo(() => {
    if (!analysis || !trafficLightData || analysis.routeGeometry.length === 0) {
      return [];
    }

    const thresholdKm = 0.035; // 35 meters - inclusive, user can manually exclude false positives

    return trafficLightData.features.filter((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      // Skip if manually excluded
      if (excludedTrafficLightIds.has(feature.properties.id)) {
        return false;
      }
      return isPointNearRoute([lng, lat], analysis.routeGeometry, thresholdKm);
    });
  }, [analysis, trafficLightData, excludedTrafficLightIds]);

  // Convert route geometry to LatLng format for Polyline
  const routeLatLngs = useMemo(() => {
    if (!analysis) return [];
    return analysis.routeGeometry.map(([lng, lat]) => [lat, lng] as [number, number]);
  }, [analysis]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {analysis && <FitBounds analysis={analysis} />}

        {/* Route polyline */}
        {routeLatLngs.length > 0 && (
          <Polyline
            positions={routeLatLngs}
            pathOptions={{
              color: '#3b82f6',
              weight: 5,
              opacity: 0.8,
            }}
          />
        )}

        {/* Traffic lights on route */}
        {trafficLightsOnRoute.map((feature) => {
          const props = feature.properties;
          const [lng, lat] = feature.geometry.coordinates;
          const hasLogistics = props.has_logistics;
          const scenarioInfo = scenarioMap.get(props.id);

          // Determine icon based on mode
          let icon;
          if (calculationMode === 'advanced' && scenarioInfo && hasLogistics) {
            // In advanced mode, show scenario-based icon for logistics lights
            icon = createScenarioTrafficLightIcon(scenarioInfo.scenarioWith, 24);
          } else {
            icon = hasLogistics ? trafficLightWithLogistics : trafficLightWithoutLogistics;
          }

          return (
            <Marker
              key={props.id}
              position={[lat, lng]}
              icon={icon}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-semibold text-gray-900">{props.name}</h3>
                  <p className="text-sm text-gray-600">{props.roadRegulatorName}</p>

                  <div className="mt-2">
                    {hasLogistics ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Logistiek prioriteit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                        Geen logistiek prioriteit
                      </span>
                    )}
                  </div>

                  {/* Advanced mode scenario info */}
                  {calculationMode === 'advanced' && scenarioInfo && hasLogistics && (
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                      <div className="text-xs font-medium text-blue-800 mb-1">Scenario analyse</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Zonder prioriteit:</span>
                          <div className={`font-medium ${
                            scenarioInfo.scenarioWithout === 'no_stop' ? 'text-green-600' :
                            scenarioInfo.scenarioWithout === 'slow_down' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {SCENARIO_LABELS[scenarioInfo.scenarioWithout]}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Met prioriteit:</span>
                          <div className={`font-medium ${
                            scenarioInfo.scenarioWith === 'no_stop' ? 'text-green-600' :
                            scenarioInfo.scenarioWith === 'slow_down' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {SCENARIO_LABELS[scenarioInfo.scenarioWith]}
                          </div>
                        </div>
                      </div>
                      <div className={`mt-1 text-xs font-medium ${scenarioInfo.fuelSavings > 0 ? 'text-green-600' : scenarioInfo.fuelSavings < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        Besparing: {scenarioInfo.fuelSavings > 0 ? '+' : ''}{scenarioInfo.fuelSavings.toFixed(3)} L
                      </div>
                    </div>
                  )}

                  {props.priorities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {props.priorities.map((priority) => (
                        <span
                          key={priority}
                          className="px-2 py-0.5 rounded-full text-xs text-white"
                          style={{ backgroundColor: PRIORITY_INFO[priority].color }}
                        >
                          {PRIORITY_INFO[priority].icon} {PRIORITY_INFO[priority].name}
                        </span>
                      ))}
                    </div>
                  )}

                  {onExcludeTrafficLight && (
                    <button
                      onClick={() => onExcludeTrafficLight(props.id)}
                      className="mt-3 w-full px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors"
                    >
                      Uitsluiten van route
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Origin marker */}
        {analysis && (
          <Marker position={[analysis.origin.lat, analysis.origin.lng]} icon={originIcon}>
            <Popup>
              <div>
                <div className="font-semibold text-green-700">Herkomst</div>
                <div className="text-sm text-gray-600">
                  {analysis.origin.name || `${analysis.origin.lat.toFixed(4)}, ${analysis.origin.lng.toFixed(4)}`}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination marker */}
        {analysis && (
          <Marker position={[analysis.destination.lat, analysis.destination.lng]} icon={destinationIcon}>
            <Popup>
              <div>
                <div className="font-semibold text-red-700">Bestemming</div>
                <div className="text-sm text-gray-600">
                  {analysis.destination.name || `${analysis.destination.lat.toFixed(4)}, ${analysis.destination.lng.toFixed(4)}`}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs font-medium text-gray-700 mb-2">Legenda</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-white shadow"></div>
            <span className="text-xs text-gray-600">Herkomst</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow"></div>
            <span className="text-xs text-gray-600">Bestemming</span>
          </div>

          {/* Simple mode legend */}
          {calculationMode === 'simple' && (
            <>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 34" width="16" height="22" className="flex-shrink-0">
                  <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
                  <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3"/>
                  <circle cx="12" cy="8" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="16" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="24" r="4" fill="#22c55e"/>
                </svg>
                <span className="text-xs text-gray-600">VRI met prioriteit voor logistiek</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 34" width="14" height="20" className="flex-shrink-0">
                  <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
                  <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3"/>
                  <circle cx="12" cy="8" r="4" fill="#ef4444"/>
                  <circle cx="12" cy="16" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="24" r="4" fill="#374151" opacity="0.3"/>
                </svg>
                <span className="text-xs text-gray-600">VRI zonder prioriteit voor logistiek</span>
              </div>
            </>
          )}

          {/* Advanced mode legend - scenario colors */}
          {calculationMode === 'advanced' && (
            <>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="text-xs font-medium text-blue-700 mb-1">Scenario (met prioriteit)</div>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 34" width="16" height="22" className="flex-shrink-0">
                  <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
                  <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3"/>
                  <circle cx="12" cy="8" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="16" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="24" r="4" fill="#22c55e"/>
                </svg>
                <span className="text-xs text-gray-600">Geen stop</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 34" width="16" height="22" className="flex-shrink-0">
                  <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
                  <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3"/>
                  <circle cx="12" cy="8" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="16" r="4" fill="#eab308"/>
                  <circle cx="12" cy="24" r="4" fill="#374151" opacity="0.3"/>
                </svg>
                <span className="text-xs text-gray-600">Afremmen</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 34" width="16" height="22" className="flex-shrink-0">
                  <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
                  <rect x="3" y="2" width="18" height="26" fill="#1f2937" rx="3"/>
                  <circle cx="12" cy="8" r="4" fill="#ef4444"/>
                  <circle cx="12" cy="16" r="4" fill="#374151" opacity="0.3"/>
                  <circle cx="12" cy="24" r="4" fill="#374151" opacity="0.3"/>
                </svg>
                <span className="text-xs text-gray-600">Stop</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 34" width="14" height="20" className="flex-shrink-0">
                  <rect x="10" y="28" width="4" height="6" fill="#4b5563" rx="1"/>
                  <rect x="3" y="2" width="18" height="26" fill="#6b7280" rx="3"/>
                  <circle cx="12" cy="8" r="4" fill="#9ca3af" opacity="0.3"/>
                  <circle cx="12" cy="16" r="4" fill="#9ca3af" opacity="0.3"/>
                  <circle cx="12" cy="24" r="4" fill="#9ca3af" opacity="0.3"/>
                </svg>
                <span className="text-xs text-gray-600">Geen logistiek</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* No route message */}
      {!analysis && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-[500]">
          <div className="text-center p-4">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-gray-500">Voer een route in om te analyseren</p>
          </div>
        </div>
      )}
    </div>
  );
}
