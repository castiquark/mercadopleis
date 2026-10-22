import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import { SERVICE_SLUG_RENAMES } from './src/lib/serviceSlugs';

const nextConfig: NextConfig = {
  transpilePackages: ['@mercadopleis/types', '@mercadopleis/contracts-abi', '@mercadopleis/database'],
  // The MCP server reads its own package.json at runtime (createRequire), which bundling would break.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', '@mercadopleis/mcp-server'],
  // Per-language URLs: English pages live at the root and are served from app/[lang] with lang=en; /es and /pt
  // map straight to the segment. API routes, /mcp, /.well-known, Next internals and public files never get a prefix.
  async rewrites() {
    return {
      // The root goes first: on Netlify an afterFiles rewrite of / was served the prerendered 404 (20 Oct 2026).
      beforeFiles: [{ source: '/', destination: '/en' }],
      afterFiles: [
        {
          source: '/:path((?!api(?:/|$)|mcp(?:/|$)|_next/|\.well-known/|es(?:/|$)|pt(?:/|$)|en(?:/|$)).*)',
          destination: '/en/:path',
        },
      ],
    };
  },
  // The home and /requests render per request (no ISR: on 20 Oct 2026 Netlify's background regeneration of the
  // rewritten / cached the 404 at the edge). The CDN caches the rendered page for 60 s instead, to save function
  // calls; it only ever stores a response a visitor actually got, not a background regeneration.
  async headers() {
    const cdn = { key: 'Netlify-CDN-Cache-Control', value: 'public, durable, s-maxage=60, stale-while-revalidate=300' };
    return ['/', '/es', '/pt', '/requests', '/es/requests', '/pt/requests'].map((source) => ({ source, headers: [cdn] }));
  },
  // /en is the root: one URL per page.
  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
      // English slugs for the operator's services (22 Oct 2026): 301 from the old Spanish slugs, in every language.
      ...Object.entries(SERVICE_SLUG_RENAMES).flatMap(([oldSlug, newSlug]) =>
        ['', '/es', '/pt'].map((prefix) => ({ source: `${prefix}/services/${oldSlug}`, destination: `${prefix}/services/${newSlug}`, statusCode: 301 as const }))
      ),
    ];
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@x402/evm/exact/client': false,
      '@x402/core/client': false,
      '@x402/svm/exact/client': false,
      '@x402/evm': false,
      '@x402/core': false,
      '@react-native-async-storage/async-storage': false,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

// Sentry (errors only). Source maps are uploaded at build time only when SENTRY_AUTH_TOKEN, SENTRY_ORG and
// SENTRY_PROJECT are set (Netlify production); without them the build skips the upload and still succeeds.
const sentryUpload = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { disable: !sentryUpload, deleteSourcemapsAfterUpload: true },
  // Errors only: drop the SDK's tracing and debug code from the client bundle.
  webpack: { treeshake: { removeTracing: true, removeDebugLogging: true } },
});
