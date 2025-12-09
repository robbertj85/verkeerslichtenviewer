/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow serving GeoJSON files with correct MIME type
  async headers() {
    return [
      {
        source: '/data/:path*.geojson',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/geo+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
