'use client';

import { useMemo, useState } from 'react';
import {
  TrafficLightData,
  Filters,
  PRIORITY_INFO,
  PriorityCategory,
  DEFAULT_FILTERS
} from '@/types/traffic-lights';

interface FilterPanelProps {
  data: TrafficLightData | null;
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function FilterPanel({ data, filters, onChange }: FilterPanelProps) {
  const [showAllAuthorities, setShowAllAuthorities] = useState(false);

  const availableAuthorities = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.features.forEach(f => {
      const auth = f.properties.roadRegulatorName;
      counts[auth] = (counts[auth] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  const availableTlcOrgs = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    data.features.forEach(f => {
      const org = f.properties.tlc_organization;
      if (org) {
        counts[org] = (counts[org] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  const displayedAuthorities = showAllAuthorities
    ? availableAuthorities
    : availableAuthorities.slice(0, 10);

  const handlePriorityToggle = (priority: PriorityCategory) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: newPriorities });
  };

  const handleAuthorityToggle = (authority: string) => {
    const newAuthorities = filters.authorities.includes(authority)
      ? filters.authorities.filter(a => a !== authority)
      : [...filters.authorities, authority];
    onChange({ ...filters, authorities: newAuthorities });
  };

  const handleTlcOrgToggle = (org: string) => {
    const newOrgs = filters.tlcOrganizations.includes(org)
      ? filters.tlcOrganizations.filter(o => o !== org)
      : [...filters.tlcOrganizations, org];
    onChange({ ...filters, tlcOrganizations: newOrgs });
  };

  const handleReset = () => {
    onChange({
      ...DEFAULT_FILTERS,
      priorities: ['emergency', 'road_operator', 'public_transport', 'logistics', 'agriculture']
    });
  };

  const hasActiveFilters =
    filters.authorities.length > 0 ||
    filters.tlcOrganizations.length > 0 ||
    filters.priorities.length < 5 ||
    filters.showBoundaries;

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4 custom-scrollbar overflow-y-auto max-h-[calc(100vh-400px)]">
      {/* Header with reset button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Priority categories */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Prioriteitsklassen
        </h4>
        <div className="space-y-1">
          {(Object.entries(PRIORITY_INFO) as [PriorityCategory, typeof PRIORITY_INFO[PriorityCategory]][]).map(([key, info]) => (
            <label
              key={key}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.priorities.includes(key)}
                onChange={() => handlePriorityToggle(key)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-lg">{info.icon}</span>
              <span className="text-sm text-gray-700">{info.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Map layers */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Kaartlagen
        </h4>
        <div className="space-y-2">
          {/* Boundaries toggle */}
          <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showBoundaries}
              onChange={() => onChange({ ...filters, showBoundaries: !filters.showBoundaries })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Gemeentegrenzen</span>
          </label>

          {/* Simple markers toggle */}
          <label className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.useSimpleMarkers}
              onChange={() => onChange({ ...filters, useSimpleMarkers: !filters.useSimpleMarkers })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Snelle weergave (kleine punten)</span>
          </label>
        </div>
      </div>

      {/* TLC Organizations - with logo indication */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          TLC Leveranciers
          {filters.tlcOrganizations.length > 0 && (
            <span className="ml-2 text-blue-600">({filters.tlcOrganizations.length} geselecteerd)</span>
          )}
        </h4>
        <p className="text-[10px] text-gray-400 mb-2">
          Selecteer een leverancier om hun logo op de kaart te tonen
        </p>
        <div className="space-y-1">
          {availableTlcOrgs.map(({ name, count }) => (
            <label
              key={name}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.tlcOrganizations.includes(name)}
                onChange={() => handleTlcOrgToggle(name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-xs text-gray-400">{count}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Authorities */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Wegbeheerders
          {filters.authorities.length > 0 && (
            <span className="ml-2 text-blue-600">({filters.authorities.length} geselecteerd)</span>
          )}
        </h4>
        <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
          {displayedAuthorities.map(({ name, count }) => (
            <label
              key={name}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.authorities.includes(name)}
                onChange={() => handleAuthorityToggle(name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-xs text-gray-400">{count}</span>
            </label>
          ))}
        </div>
        {availableAuthorities.length > 10 && (
          <button
            onClick={() => setShowAllAuthorities(!showAllAuthorities)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            {showAllAuthorities
              ? 'Toon minder'
              : `Toon alle ${availableAuthorities.length} wegbeheerders`}
          </button>
        )}
      </div>
    </div>
  );
}
