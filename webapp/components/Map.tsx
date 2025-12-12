'use client';

import { useEffect, useMemo, useRef, useState, useCallback, useId } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import {
  TrafficLightData,
  TrafficLightProperties,
  TrafficLightFeature,
  Filters,
  PRIORITY_INFO,
  PriorityCategory
} from '@/types/traffic-lights';
import { getTlcLogo } from '@/utils/logos';
import { loadAllBoundaries, BoundaryData, BoundaryLoadProgress } from '@/utils/boundaryLoader';

interface MapProps {
  data: TrafficLightData | null;
  filters: Filters;
}

// Component to fit bounds when data changes
function FitBounds({ bounds }: { bounds: [number, number, number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      const [minx, miny, maxx, maxy] = bounds;
      map.fitBounds([
        [miny, minx],
        [maxy, maxx]
      ], { padding: [20, 20] });
    }
  }, [bounds, map]);

  return null;
}

// Get color based on highest priority
function getMarkerColor(props: TrafficLightProperties): string {
  if (props.has_emergency) return PRIORITY_INFO.emergency.color;
  if (props.has_public_transport) return PRIORITY_INFO.public_transport.color;
  if (props.has_logistics) return PRIORITY_INFO.logistics.color;
  if (props.has_road_operator) return PRIORITY_INFO.road_operator.color;
  if (props.has_agriculture) return PRIORITY_INFO.agriculture.color;
  return '#6b7280'; // gray-500 for no priorities
}

// Priority badge component
function PriorityBadge({ priority }: { priority: PriorityCategory }) {
  const info = PRIORITY_INFO[priority];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
      style={{ backgroundColor: info.color }}
    >
      {info.icon} {info.name}
    </span>
  );
}

// TLC Organization info with colors
const TLC_INFO: Record<string, { color: string }> = {
  'Vialis': { color: '#1e40af' },
  'Swarco': { color: '#047857' },
  'Swarco - Peek Traffic': { color: '#047857' },
  'Ko Hartog': { color: '#7c3aed' },
};

// Create a custom divIcon with TLC logo (only when TLC filter is active)
function createTlcLogoIcon(
  tlcOrg: string,
  priorityColor: string,
  size: number = 32,
  greyed: boolean = false
): L.DivIcon {
  const tlcLogo = getTlcLogo(tlcOrg);
  const bgColor = greyed ? '#9ca3af' : (TLC_INFO[tlcOrg]?.color || '#6b7280');
  const borderColor = greyed ? '#d1d5db' : priorityColor;
  const filterStyle = greyed ? 'filter: grayscale(100%) opacity(0.5);' : '';

  let content: string;

  if (tlcLogo) {
    content = `
      <div class="marker-logo-container" style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid ${borderColor};
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,${greyed ? '0.1' : '0.3'});
        overflow: hidden;
        ${filterStyle}
      ">
        <img
          src="${tlcLogo}"
          alt="${tlcOrg}"
          style="width: ${size - 10}px; height: ${size - 10}px; object-fit: contain;"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div style="
          display: none;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          background: ${bgColor};
          color: white;
          font-weight: bold;
          font-size: ${size / 3}px;
        ">${tlcOrg.substring(0, 2).toUpperCase()}</div>
      </div>
    `;
  } else {
    // Fallback to initials
    content = `
      <div class="marker-logo-container" style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid ${borderColor};
        background: ${bgColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,${greyed ? '0.1' : '0.3'});
        color: white;
        font-weight: bold;
        font-size: ${size / 3}px;
        ${filterStyle}
      ">${tlcOrg.substring(0, 2).toUpperCase()}</div>
    `;
  }

  return L.divIcon({
    html: content,
    className: 'custom-logo-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Popup content component
function PopupContent({
  props,
  lat,
  lng
}: {
  props: TrafficLightProperties;
  lat: number;
  lng: number;
}) {
  const tlcLogo = getTlcLogo(props.tlc_organization);

  return (
    <div className="min-w-[200px] max-w-[calc(100vw-60px)] sm:min-w-[280px]">
      {/* Header */}
      <div className="mb-2">
        <h3 className="font-semibold text-gray-900">{props.name}</h3>
        <p className="text-sm text-gray-600">{props.roadRegulatorName}</p>
      </div>

      {/* Priority badges */}
      {props.priorities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {props.priorities.map((p) => (
            <PriorityBadge key={p} priority={p} />
          ))}
        </div>
      )}

      {/* TLC Organization with logo */}
      {props.tlc_organization && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
          {tlcLogo && (
            <img
              src={tlcLogo}
              alt={props.tlc_organization}
              className="w-6 h-6 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="text-xs">
            <span className="text-gray-500">TLC Leverancier:</span>
            <span className="ml-1 font-medium text-gray-700">{props.tlc_organization}</span>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-2">
        <div className="flex justify-between">
          <span>ID:</span>
          <span className="font-mono">{props.identifier}</span>
        </div>
        {props.its_organization && (
          <div className="flex justify-between">
            <span>ITS:</span>
            <span>{props.its_organization}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Coordinaten:</span>
          <span className="font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Map({ data, filters }: MapProps) {
  const mapId = useId();
  const mapRef = useRef<L.Map | null>(null);
  const [boundaryData, setBoundaryData] = useState<BoundaryData | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryProgress, setBoundaryProgress] = useState<BoundaryLoadProgress | null>(null);

  // Load boundaries when showBoundaries is enabled
  useEffect(() => {
    if (filters.showBoundaries && !boundaryData && !boundaryLoading) {
      setBoundaryLoading(true);
      loadAllBoundaries((progress) => {
        setBoundaryProgress(progress);
      })
        .then((data) => {
          setBoundaryData(data);
          setBoundaryLoading(false);
          setBoundaryProgress(null);
        })
        .catch((error) => {
          console.error('Failed to load boundaries:', error);
          setBoundaryLoading(false);
          setBoundaryProgress(null);
        });
    }
  }, [filters.showBoundaries, boundaryData, boundaryLoading]);

  // Check if priority filter matches a feature
  const checkPriorityMatch = useCallback((props: TrafficLightProperties) => {
    if (filters.priorities.length === 0 || filters.priorities.length >= 5) {
      return true; // No filter active, all match
    }
    return filters.priorities.some(p => {
      switch (p) {
        case 'emergency': return props.has_emergency;
        case 'road_operator': return props.has_road_operator;
        case 'public_transport': return props.has_public_transport;
        case 'logistics': return props.has_logistics;
        case 'agriculture': return props.has_agriculture;
        default: return false;
      }
    });
  }, [filters.priorities]);

  // Filter traffic lights based on current filters (authority and TLC only)
  // Priority filter no longer hides, just marks for greying out
  const filteredFeatures = useMemo(() => {
    if (!data) return [];

    return data.features.filter((feature) => {
      const props = feature.properties as TrafficLightProperties;

      // Authority filter - still completely hides non-matching
      if (filters.authorities.length > 0 && !filters.authorities.includes(props.roadRegulatorName)) {
        return false;
      }

      // TLC Organization filter - still completely hides non-matching
      if (filters.tlcOrganizations.length > 0 && !filters.tlcOrganizations.includes(props.tlc_organization)) {
        return false;
      }

      return true;
    });
  }, [data, filters.authorities, filters.tlcOrganizations]);

  // Get bounds for initial view
  const bounds = useMemo(() => {
    if (!data) return null;
    return data.metadata.bounds;
  }, [data]);

  // Check if TLC filter is active (to show TLC logos)
  const hasTlcFilter = filters.tlcOrganizations.length > 0;

  // Netherlands default center
  const defaultCenter: [number, number] = [52.1326, 5.2913];
  const defaultZoom = 8;

  // Boundary style function
  const boundaryStyle = useCallback(() => ({
    color: '#6b7280',
    fillColor: '#6b7280',
    weight: 2,
    fillOpacity: 0.05,
    opacity: 0.6,
    dashArray: '5, 5',
  }), []);

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Kaart laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        key={mapId}
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <FitBounds bounds={bounds} />

        {/* Render boundaries when enabled */}
        {filters.showBoundaries && boundaryData && boundaryData.features.map((feature, idx) => (
          <GeoJSON
            key={`boundary-${idx}`}
            data={feature as any}
            style={boundaryStyle}
          />
        ))}

        {/* Render traffic light markers */}
        {filteredFeatures.map((feature) => {
          const props = feature.properties as TrafficLightProperties;
          const [lng, lat] = feature.geometry.coordinates;
          const matchesPriorityFilter = checkPriorityMatch(props);

          // Use actual color if matches, grey if not
          const color = matchesPriorityFilter ? getMarkerColor(props) : '#9ca3af';
          const fillOpacity = matchesPriorityFilter ? 0.9 : 0.3;
          const strokeOpacity = matchesPriorityFilter ? 1 : 0.4;

          // Show TLC logo only when TLC filter is active
          if (hasTlcFilter && props.tlc_organization) {
            const icon = createTlcLogoIcon(props.tlc_organization, color, 32, !matchesPriorityFilter);
            return (
              <Marker
                key={props.id}
                position={[lat, lng]}
                icon={icon}
                opacity={matchesPriorityFilter ? 1 : 0.4}
              >
                <Popup>
                  <PopupContent props={props} lat={lat} lng={lng} />
                </Popup>
              </Marker>
            );
          }

          // Default: colored circle markers (no road authority logos)
          return (
            <CircleMarker
              key={props.id}
              center={[lat, lng]}
              radius={7}
              pathOptions={{
                fillColor: color,
                fillOpacity: fillOpacity,
                color: '#fff',
                weight: 2,
                opacity: strokeOpacity,
              }}
            >
              <Popup>
                <PopupContent props={props} lat={lat} lng={lng} />
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Boundary loading indicator */}
      {boundaryLoading && boundaryProgress && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000]">
          <div className="bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">
              Grenzen laden: {boundaryProgress.loaded}/{boundaryProgress.total} ({boundaryProgress.percentage}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
