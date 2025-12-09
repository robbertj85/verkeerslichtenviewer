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

  const handlePrioritySelect = (priority: PriorityCategory | 'all') => {
    if (priority === 'all') {
      // Show all - set all priorities
      onChange({ ...filters, priorities: ['emergency', 'road_operator', 'public_transport', 'logistics', 'agriculture'] });
    } else {
      // Single priority filter
      onChange({ ...filters, priorities: [priority] });
    }
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
    (filters.priorities.length > 0 && filters.priorities.length < 5) ||
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

      {/* Priority categories - single select */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Prioriteitsklassen
        </h4>
        <div className="space-y-0.5">
          {/* All option */}
          <button
            onClick={() => handlePrioritySelect('all')}
            className={`w-full flex items-center gap-2 p-1.5 rounded text-left transition ${
              filters.priorities.length === 5
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              filters.priorities.length === 5 ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
            }`}>
              {filters.priorities.length === 5 && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-xs font-medium">Alle verkeerslichten</span>
          </button>

          {/* Individual priorities */}
          {(Object.entries(PRIORITY_INFO) as [PriorityCategory, typeof PRIORITY_INFO[PriorityCategory]][]).map(([key, info]) => {
            const isSelected = filters.priorities.length === 1 && filters.priorities[0] === key;
            return (
              <button
                key={key}
                onClick={() => handlePrioritySelect(key)}
                className={`w-full flex items-center gap-2 p-1.5 rounded text-left transition ${
                  isSelected
                    ? 'bg-gray-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-gray-600 bg-gray-600' : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke={info.color}
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={info.svgPath} />
                </svg>
                <span className="text-xs text-gray-700">{info.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map layers */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Kaartlagen
        </h4>
        <div className="space-y-0.5">
          {/* Boundaries toggle */}
          <label className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showBoundaries}
              onChange={() => onChange({ ...filters, showBoundaries: !filters.showBoundaries })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-gray-700">Gemeentegrenzen</span>
          </label>

          {/* Simple markers toggle */}
          <label className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.useSimpleMarkers}
              onChange={() => onChange({ ...filters, useSimpleMarkers: !filters.useSimpleMarkers })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-gray-700">Snelle weergave</span>
          </label>
        </div>
      </div>

      {/* TLC Organizations - with logo indication */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          TLC Leveranciers
          {filters.tlcOrganizations.length > 0 && (
            <span className="ml-1 text-blue-600 normal-case">({filters.tlcOrganizations.length})</span>
          )}
        </h4>
        <div className="space-y-0.5">
          {availableTlcOrgs.map(({ name, count }) => (
            <label
              key={name}
              className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.tlcOrganizations.includes(name)}
                onChange={() => handleTlcOrgToggle(name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-[10px] text-gray-400">{count}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Authorities */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Wegbeheerders
          {filters.authorities.length > 0 && (
            <span className="ml-1 text-blue-600 normal-case">({filters.authorities.length})</span>
          )}
        </h4>
        <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
          {displayedAuthorities.map(({ name, count }) => (
            <label
              key={name}
              className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.authorities.includes(name)}
                onChange={() => handleAuthorityToggle(name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-[10px] text-gray-400">{count}</span>
            </label>
          ))}
        </div>
        {availableAuthorities.length > 10 && (
          <button
            onClick={() => setShowAllAuthorities(!showAllAuthorities)}
            className="mt-1.5 text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
          >
            {showAllAuthorities
              ? 'Minder'
              : `Alle ${availableAuthorities.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
