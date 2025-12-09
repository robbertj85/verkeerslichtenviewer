'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function ApiDocsPage() {
  const redocContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load Redoc
    const script = document.createElement('script');
    script.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    script.async = true;
    script.onerror = () => {
      console.error('Failed to load Redoc');
    };
    script.onload = () => {
      // @ts-expect-error Redoc is loaded from CDN
      if (window.Redoc && redocContainerRef.current) {
        // Clear loading state first
        redocContainerRef.current.innerHTML = '';
        // @ts-expect-error Redoc is loaded from CDN
        window.Redoc.init('/openapi.json', {
          theme: {
            colors: {
              primary: {
                main: '#2563eb',
              },
            },
            typography: {
              fontSize: '15px',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              headings: {
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: '600',
              },
              code: {
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              },
            },
            sidebar: {
              width: '280px',
              backgroundColor: '#f8fafc',
            },
            rightPanel: {
              backgroundColor: '#1e293b',
            },
          },
          hideDownloadButton: false,
          hideHostname: false,
          expandResponses: '200',
          pathInMiddlePanel: true,
          sortPropsAlphabetically: false,
          nativeScrollbars: true,
        }, redocContainerRef.current);
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Custom header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Terug naar kaart</span>
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <span className="text-xl">🚦</span>
            <h1 className="text-lg font-semibold text-gray-900">Verkeerslichtenviewer API</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="/openapi.json"
              download
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              OpenAPI Spec
            </a>
          </div>
        </div>
      </header>

      {/* Redoc container */}
      <div ref={redocContainerRef} id="redoc-container">
        {/* Loading state */}
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">API documentatie laden...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
