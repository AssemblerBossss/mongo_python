import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from picking a parent folder as the workspace root when
  // another package-lock.json exists above this project directory.
  turbopack: {
    root: __dirname,
  },

  output: 'standalone',

  poweredByHeader:             false,
  productionBrowserSourceMaps: false,
  compress:                    true,

  typescript: { ignoreBuildErrors: false },

  // Proxies UI fetch("/api/...") calls to the Python backend, so pages
  // ported from mongo-gui-main keep working once the backend implements
  // matching routes. See ../filters-api-contract.md / unimplemented-endpoints
  // list for the gap between what the UI expects and what backend/ exposes today.
  async rewrites() {
    const backendOrigin = process.env.BACKEND_API_ORIGIN || 'http://127.0.0.1:8000';
    return [{ source: '/api/:path*', destination: `${backendOrigin}/api/:path*` }];
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
        ],
      },
    ];
  },
};

export default nextConfig;
