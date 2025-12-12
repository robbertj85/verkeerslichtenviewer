'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Summary, PRIORITY_INFO, PriorityCategory } from '@/types/traffic-lights';

type ExportFormat = 'geojson' | 'json' | 'csv';

interface WeekStats {
  week: string;
  date: string;
  timestamp: string;
  stats: {
    total: number;
    by_authority: Record<string, number>;
    by_tlc_organization: Record<string, number>;
    by_priority: Record<string, number>;
  };
  changes: {
    total_change: number;
    is_first_week: boolean;
    authority_changes?: Record<string, { previous: number; current: number; change: number }>;
  };
}

interface StatsHistory {
  metadata: {
    created_at: string;
    last_updated: string;
    total_weeks: number;
  };
  weeks: WeekStats[];
}

export default function DataExportPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<StatsHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [activeTab, setActiveTab] = useState<'download' | 'statistics' | 'history'>('download');
  const [statsView, setStatsView] = useState<'authority' | 'tlc' | 'priority'>('authority');

  useEffect(() => {
    Promise.all([
      fetch('/data/summary.json').then((res) => res.json()),
      fetch('/data/stats_history.json').then((res) => res.json()).catch(() => null),
    ])
      .then(([summaryData, historyData]) => {
        setSummary(summaryData);
        setHistory(historyData);
      })
      .catch((err) => console.error('Error loading data:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (format: ExportFormat) => {
    setDownloading(format);
    try {
      const response = await fetch(`/api/v1/export?format=${format}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `udap-traffic-lights.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download mislukt. Probeer het later opnieuw.');
    } finally {
      setDownloading(null);
    }
  };

  const latestWeek = useMemo(() => {
    if (!history?.weeks?.length) return null;
    return history.weeks[history.weeks.length - 1];
  }, [history]);

  const sortedAuthorities = useMemo(() => {
    if (!summary?.by_authority) return [];
    return Object.entries(summary.by_authority)
      .sort((a, b) => b[1] - a[1]);
  }, [summary]);

  const sortedTlcOrgs = useMemo(() => {
    if (!summary?.by_tlc_organization) return [];
    return Object.entries(summary.by_tlc_organization)
      .sort((a, b) => b[1] - a[1]);
  }, [summary]);

  const sortedPriorities = useMemo(() => {
    if (!summary?.priority_stats) return [];
    return Object.entries(summary.priority_stats)
      .map(([key, count]) => {
        const info = PRIORITY_INFO[key as PriorityCategory];
        return {
          key,
          count,
          label: info?.name || key,
          color: info?.color || '#6b7280',
          svgPath: info?.svgPath || '',
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [summary]);

  // Get current stats view data
  const currentStatsData = useMemo(() => {
    if (statsView === 'authority') return sortedAuthorities;
    if (statsView === 'tlc') return sortedTlcOrgs;
    return [];
  }, [statsView, sortedAuthorities, sortedTlcOrgs]);

  const displayedItems = showAllItems
    ? currentStatsData
    : currentStatsData.slice(0, 15);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Data & Statistieken</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : summary?.total_traffic_lights?.toLocaleString('nl-NL') || '0'}
            </div>
            <div className="text-sm text-gray-500">Verkeerslichten</div>
            {latestWeek && !latestWeek.changes.is_first_week && (
              <div className={`text-xs mt-1 ${latestWeek.changes.total_change > 0 ? 'text-green-600' : latestWeek.changes.total_change < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {latestWeek.changes.total_change > 0 ? '+' : ''}{latestWeek.changes.total_change} deze week
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : Object.keys(summary?.by_authority || {}).length}
            </div>
            <div className="text-sm text-gray-500">Wegbeheerders</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : Object.keys(summary?.by_tlc_organization || {}).length}
            </div>
            <div className="text-sm text-gray-500">TLC Leveranciers</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : history?.metadata?.total_weeks || 1}
            </div>
            <div className="text-sm text-gray-500">Weken getrackt</div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('download')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'download'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Download
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'statistics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Statistieken per Wegbeheerder
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Geschiedenis
          </button>
        </div>

        {/* Download tab */}
        {activeTab === 'download' && (
          <>
            {/* Intro */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Download UDAP Verkeerslichten Data
              </h2>
              <p className="text-gray-600 mb-4">
                Download de complete dataset van alle intelligente verkeerslichten (iVRI&apos;s)
                in Nederland. De data wordt opgehaald van het UDAP platform en bevat
                locaties, prioriteitsklassen en organisatie-informatie.
              </p>
              {summary && (
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className="bg-gray-100 px-3 py-1 rounded-full">
                    Bijgewerkt: {new Date(summary.generated_at).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Download options */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {/* GeoJSON */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <div className="mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">GeoJSON</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Geografisch formaat voor GIS software, QGIS, mapbox, etc.
                </p>
                <button
                  onClick={() => handleDownload('geojson')}
                  disabled={downloading !== null}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {downloading === 'geojson' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Downloaden...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download .geojson
                    </>
                  )}
                </button>
              </div>

              {/* JSON */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <div className="mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">JSON</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Standaard JSON formaat voor web development en scripts.
                </p>
                <button
                  onClick={() => handleDownload('json')}
                  disabled={downloading !== null}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {downloading === 'json' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Downloaden...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download .json
                    </>
                  )}
                </button>
              </div>

              {/* CSV */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <div className="mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">CSV</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Komma-gescheiden waarden voor Excel, spreadsheets.
                </p>
                <button
                  onClick={() => handleDownload('csv')}
                  disabled={downloading !== null}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {downloading === 'csv' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Downloaden...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download .csv
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* API info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                API Toegang
              </h2>
              <p className="text-gray-600 mb-4">
                Wil je de data programmatisch ophalen? Gebruik onze REST API.
              </p>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                <code>
                  GET /api/v1/subjects<br />
                  GET /api/v1/stats<br />
                  GET /api/v1/export?format=geojson
                </code>
              </div>
              <Link
                href="/api/v1/docs"
                className="inline-flex items-center mt-4 text-blue-600 hover:text-blue-800 hover:underline"
              >
                Bekijk API documentatie
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </>
        )}

        {/* Statistics tab */}
        {activeTab === 'statistics' && (
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setStatsView('authority'); setShowAllItems(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statsView === 'authority'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Per Wegbeheerder ({sortedAuthorities.length})
              </button>
              <button
                onClick={() => { setStatsView('tlc'); setShowAllItems(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statsView === 'tlc'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Per TLC Leverancier ({sortedTlcOrgs.length})
              </button>
              <button
                onClick={() => { setStatsView('priority'); setShowAllItems(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statsView === 'priority'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Per Prioriteitsklasse (5)
              </button>
            </div>

            {/* Priority view */}
            {statsView === 'priority' && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    iVRI&apos;s per Prioriteitsklasse
                  </h2>
                  <p className="text-sm text-gray-500">
                    Aantal verkeerslichten met elke prioriteitsklasse ingeschakeld
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prioriteitsklasse
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aantal iVRI&apos;s
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          % van totaal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedPriorities.map((priority, index) => (
                        <tr key={priority.key} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5" style={{ color: priority.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={priority.svgPath} />
                              </svg>
                              <span className="text-sm font-medium text-gray-900">{priority.label}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right tabular-nums font-medium">
                            {priority.count.toLocaleString('nl-NL')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(priority.count / (summary?.total_traffic_lights || 1)) * 100}%`,
                                    backgroundColor: priority.color,
                                  }}
                                />
                              </div>
                              <span className="text-sm text-gray-500 tabular-nums w-12">
                                {((priority.count / (summary?.total_traffic_lights || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Let op: Een verkeerslicht kan meerdere prioriteitsklassen hebben.
                    De percentages tellen daarom op tot meer dan 100%.
                  </p>
                </div>
              </div>
            )}

            {/* Authority / TLC view */}
            {(statsView === 'authority' || statsView === 'tlc') && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {statsView === 'authority' ? 'Verkeerslichten per Wegbeheerder' : 'Verkeerslichten per TLC Leverancier'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {statsView === 'authority'
                      ? `Overzicht van alle ${sortedAuthorities.length} wegbeheerders met iVRI's`
                      : `Overzicht van alle ${sortedTlcOrgs.length} TLC leveranciers`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {statsView === 'authority' ? 'Wegbeheerder' : 'TLC Leverancier'}
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aantal
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Percentage
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedItems.map(([name, count], index) => (
                        <tr key={name} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {name}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right tabular-nums">
                            {count.toLocaleString('nl-NL')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(count / (summary?.total_traffic_lights || 1)) * 100}%`,
                                    backgroundColor: statsView === 'authority' ? '#3b82f6' : '#9333ea',
                                  }}
                                />
                              </div>
                              <span className="text-sm text-gray-500 tabular-nums w-12">
                                {((count / (summary?.total_traffic_lights || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4 text-sm font-bold text-gray-900">
                          Totaal
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right tabular-nums">
                          {summary?.total_traffic_lights?.toLocaleString('nl-NL') || 0}
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
                          100%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {currentStatsData.length > 15 && (
                  <div className="p-4 border-t border-gray-200">
                    <button
                      onClick={() => setShowAllItems(!showAllItems)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showAllItems
                        ? 'Toon minder'
                        : `Toon alle ${currentStatsData.length} ${statsView === 'authority' ? 'wegbeheerders' : 'leveranciers'}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Wekelijkse Statistieken Geschiedenis
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Elke week worden de verkeerslichten data automatisch bijgewerkt via GitHub Actions.
                Hier kun je de ontwikkeling over tijd volgen.
              </p>
              {history?.metadata && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    Tracking sinds: {new Date(history.metadata.created_at).toLocaleDateString('nl-NL')}
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    Laatst bijgewerkt: {new Date(history.metadata.last_updated).toLocaleDateString('nl-NL')}
                  </span>
                </div>
              )}
            </div>

            {history?.weeks && history.weeks.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Week
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Datum
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Totaal
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Verandering
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wegbeheerders
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...history.weeks].reverse().map((week) => (
                      <tr key={week.week} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {week.week}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(week.date).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right tabular-nums font-medium">
                          {week.stats.total.toLocaleString('nl-NL')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {week.changes.is_first_week ? (
                            <span className="text-sm text-gray-400">-</span>
                          ) : (
                            <span className={`text-sm font-medium ${
                              week.changes.total_change > 0
                                ? 'text-green-600'
                                : week.changes.total_change < 0
                                  ? 'text-red-600'
                                  : 'text-gray-400'
                            }`}>
                              {week.changes.total_change > 0 ? '+' : ''}
                              {week.changes.total_change}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right tabular-nums">
                          {Object.keys(week.stats.by_authority).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-gray-500">
                  Nog geen historische data beschikbaar. De eerste meting wordt opgeslagen na de volgende wekelijkse update.
                </p>
              </div>
            )}

            {/* TLC Organization stats */}
            {latestWeek && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    TLC Leveranciers
                  </h3>
                  <p className="text-sm text-gray-500">
                    Verdeling per Traffic Light Controller leverancier
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(latestWeek.stats.by_tlc_organization).map(([name, count]) => (
                    <div key={name} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {count.toLocaleString('nl-NL')}
                      </div>
                      <div className="text-sm text-gray-500 truncate" title={name}>
                        {name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {((count / latestWeek.stats.total) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Priority stats */}
            {latestWeek && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Prioriteitsklassen
                  </h3>
                  <p className="text-sm text-gray-500">
                    Aantal verkeerslichten per prioriteitsklasse
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                  {(['emergency', 'road_operator', 'public_transport', 'logistics', 'agriculture'] as PriorityCategory[]).map((key) => {
                    const info = PRIORITY_INFO[key];
                    return (
                      <div key={key} className="bg-gray-50 rounded-lg p-4">
                        <div className="w-6 h-6 mb-1" style={{ color: info.color }}>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={info.svgPath} />
                          </svg>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {(latestWeek.stats.by_priority[key] || 0).toLocaleString('nl-NL')}
                        </div>
                        <div className="text-sm text-gray-500">{info.name.split(' ')[0]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attribution */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Data afkomstig van{' '}
            <a
              href="https://map.udap.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              UDAP (Urban Data Access Platform)
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
