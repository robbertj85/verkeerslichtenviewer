'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import { BulkAnalysisResult } from '@/types/transport-analysis';
import { TrafficLightData, TrafficLightFeature } from '@/types/traffic-lights';

interface BulkRouteMapProps {
  results: BulkAnalysisResult[];
  trafficLightData: TrafficLightData | null;
  selectedIndex?: number | null;
  onSelectRoute?: (index: number) => void;
}

// Generate distinct colors for routes
const ROUTE_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
];

function getRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

// Traffic light icon - SVG based
const createTrafficLightIcon = (hasLogistics: boolean, size: number = 24) => {
  const bgColor = hasLogistics ? '#16a34a' : '#6b7280';

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
          ${hasLogistics ? '<circle cx="12" cy="24" r="6" fill="#22c55e" opacity="0.3"/>' : ''}
        </svg>
      </div>
    `,
    iconSize: [size, size * 1.4],
    iconAnchor: [size / 2, size * 1.4],
    popupAnchor: [0, -size * 1.2],
  });
};

const trafficLightWithLogistics = createTrafficLightIcon(true, 22);
const trafficLightWithoutLogistics = createTrafficLightIcon(false, 18);

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

// Check if a point is near a route
function isPointNearRoute(
  point: [number, number],
  route: [number, number][],
  thresholdKm: number
): boolean {
  const [lng, lat] = point;

  for (let i = 0; i < route.length - 1; i++) {
    const [lng1, lat1] = route[i];
    const [lng2, lat2] = route[i + 1];

    const margin = thresholdKm / 111;
    const minLng = Math.min(lng1, lng2) - margin;
    const maxLng = Math.max(lng1, lng2) + margin;
    const minLat = Math.min(lat1, lat2) - margin;
    const maxLat = Math.max(lat1, lat2) + margin;

    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
      continue;
    }

    const [closestLng, closestLat] = closestPointOnSegment(lng, lat, lng1, lat1, lng2, lat2);
    const distanceKm = haversineDistance(lat, lng, closestLat, closestLng);

    if (distanceKm < thresholdKm) {
      return true;
    }
  }

  return false;
}

// Component to fit bounds to all routes
function FitBounds({ results }: { results: BulkAnalysisResult[] }) {
  const map = useMap();

  useEffect(() => {
    const validResults = results.filter(r => r.routeGeometry.length > 0);
    if (validResults.length === 0) return;

    const allPoints: [number, number][] = [];
    validResults.forEach(result => {
      result.routeGeometry.forEach(([lng, lat]) => {
        allPoints.push([lat, lng]);
      });
    });

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [results, map]);

  return null;
}

export default function BulkRouteMap({
  results,
  trafficLightData,
  selectedIndex = null,
  onSelectRoute,
}: BulkRouteMapProps) {
  // Netherlands default center
  const defaultCenter: [number, number] = [52.1326, 5.2913];
  const defaultZoom = 8;

  // Filter valid results with route geometry
  const validResults = useMemo(() =>
    results.filter(r => r.routeGeometry.length > 0),
    [results]
  );

  // Find all traffic lights near any of the routes
  const trafficLightsOnRoutes = useMemo(() => {
    if (!trafficLightData) return [];

    const thresholdKm = 0.035; // 35 meters
    const seenIds = new Set<string>();
    const trafficLights: TrafficLightFeature[] = [];

    for (const result of validResults) {
      if (result.routeGeometry.length === 0) continue;

      for (const feature of trafficLightData.features) {
        if (seenIds.has(feature.properties.id)) continue;

        const [lng, lat] = feature.geometry.coordinates;
        if (isPointNearRoute([lng, lat], result.routeGeometry, thresholdKm)) {
          seenIds.add(feature.properties.id);
          trafficLights.push(feature);
        }
      }
    }

    return trafficLights;
  }, [validResults, trafficLightData]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds results={validResults} />

      {/* Traffic lights on routes */}
      {trafficLightsOnRoutes.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const hasLogistics = feature.properties.has_logistics;

        return (
          <Marker
            key={feature.properties.id}
            position={[lat, lng]}
            icon={hasLogistics ? trafficLightWithLogistics : trafficLightWithoutLogistics}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-gray-900">{feature.properties.name}</div>
                <div className="text-gray-500">{feature.properties.roadRegulatorName}</div>
                {hasLogistics ? (
                  <div className="mt-1 text-xs text-green-600 font-medium">Logistiek prioriteit</div>
                ) : (
                  <div className="mt-1 text-xs text-gray-400">Geen logistiek prioriteit</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Routes */}
      {validResults.map((result, index) => {
        const color = getRouteColor(index);
        const isSelected = selectedIndex === index;
        const routeLatLngs = result.routeGeometry.map(([lng, lat]) => [lat, lng] as [number, number]);

        return (
          <div key={index}>
            {/* Route polyline */}
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: color,
                weight: isSelected ? 5 : 3,
                opacity: isSelected ? 1 : 0.7,
              }}
              eventHandlers={{
                click: () => onSelectRoute?.(index),
              }}
            />

            {/* Origin marker */}
            <CircleMarker
              center={[result.origin.lat, result.origin.lng]}
              radius={isSelected ? 10 : 7}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: color,
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => onSelectRoute?.(index),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">
                    {index + 1}. {result.originName}
                  </div>
                  <div className="text-gray-500">naar {result.destinationName}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {result.distanceKm.toFixed(1)} km | {result.trafficLightsWithLogistics} iVRI&apos;s met prioriteit
                  </div>
                </div>
              </Popup>
            </CircleMarker>

            {/* Destination marker */}
            <CircleMarker
              center={[result.destination.lat, result.destination.lng]}
              radius={isSelected ? 10 : 7}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: color,
                fillOpacity: 1,
              }}
              eventHandlers={{
                click: () => onSelectRoute?.(index),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">
                    {index + 1}. {result.destinationName}
                  </div>
                  <div className="text-gray-500">van {result.originName}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {result.distanceKm.toFixed(1)} km | {result.trafficLightsWithLogistics} iVRI&apos;s met prioriteit
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        );
      })}
    </MapContainer>
  );
}
