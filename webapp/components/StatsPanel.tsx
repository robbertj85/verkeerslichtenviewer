'use client';

import { useMemo } from 'react';
import {
  TrafficLightData,
  TrafficLightProperties,
  Filters,
  PRIORITY_INFO,
  PriorityCategory
} from '@/types/traffic-lights';

interface StatsPanelProps {
  data: TrafficLightData | null;
  filters: Filters;
}

export default function StatsPanel({ data, filters }: StatsPanelProps) {
  const stats = useMemo(() => {
    if (!data) return null;

    const trafficLights = data.features.filter(f => f.properties.type === 'traffic_light');

    // Apply filters
    const filtered = trafficLights.filter((feature) => {
      const props = feature.properties as TrafficLightProperties;

      // Authority filter
      if (filters.authorities.length > 0 && !filters.authorities.includes(props.roadRegulatorName)) {
        return false;
      }

      // TLC Organization filter
      if (filters.tlcOrganizations.length > 0 && !filters.tlcOrganizations.includes(props.tlc_organization)) {
        return false;
      }

      // Priority filter - show if ANY of the selected priorities match
      if (filters.priorities.length > 0) {
        const hasPriority = filters.priorities.some(p => props.priorities.includes(p));
        if (!hasPriority && props.priorities.length > 0) {
          return false;
        }
      }

      return true;
    });

    // Calculate priority counts
    const priorityCounts: Record<PriorityCategory, number> = {
      emergency: 0,
      road_operator: 0,
      public_transport: 0,
      logistics: 0,
      agriculture: 0
    };

    filtered.forEach(f => {
      const props = f.properties as TrafficLightProperties;
      if (props.has_emergency) priorityCounts.emergency++;
      if (props.has_road_operator) priorityCounts.road_operator++;
      if (props.has_public_transport) priorityCounts.public_transport++;
      if (props.has_logistics) priorityCounts.logistics++;
      if (props.has_agriculture) priorityCounts.agriculture++;
    });

    // Count by authority (top 5)
    const authorityCounts: Record<string, number> = {};
    filtered.forEach(f => {
      const auth = (f.properties as TrafficLightProperties).roadRegulatorName;
      authorityCounts[auth] = (authorityCounts[auth] || 0) + 1;
    });
    const topAuthorities = Object.entries(authorityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total: data.metadata.total_traffic_lights,
      filtered: filtered.length,
      priorityCounts,
      topAuthorities,
      uniqueAuthorities: Object.keys(authorityCounts).length
    };
  }, [data, filters]);

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      {/* Main stats */}
      <div className="stats-gradient rounded-lg p-4 text-white">
        <h2 className="text-sm font-medium opacity-80">Verkeerslichten</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{stats.filtered.toLocaleString('nl-NL')}</span>
          {stats.filtered !== stats.total && (
            <span className="text-sm opacity-70">/ {stats.total.toLocaleString('nl-NL')}</span>
          )}
        </div>
        <p className="text-xs opacity-70 mt-1">
          {stats.uniqueAuthorities} wegbeheerders
        </p>
      </div>

      {/* Priority breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Prioriteitsklassen</h3>
        <div className="space-y-2">
          {(Object.entries(PRIORITY_INFO) as [PriorityCategory, typeof PRIORITY_INFO[PriorityCategory]][]).map(([key, info]) => {
            const count = stats.priorityCounts[key];
            const percentage = stats.filtered > 0 ? (count / stats.filtered) * 100 : 0;

            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-lg" title={info.name}>{info.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600 truncate">{info.name}</span>
                    <span className="text-gray-900 font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: info.color
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top authorities */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Wegbeheerders</h3>
        <div className="space-y-1">
          {stats.topAuthorities.map(([name, count]) => (
            <div key={name} className="flex justify-between text-sm">
              <span className="text-gray-600 truncate">{name}</span>
              <span className="text-gray-900 font-medium ml-2">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data source */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Bron:{' '}
          <a
            href="https://map.udap.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            UDAP
          </a>
        </p>
      </div>
    </div>
  );
}
