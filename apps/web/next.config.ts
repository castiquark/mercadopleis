import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mercadopleis/types', '@mercadopleis/contracts-abi', '@mercadopleis/database'],
  // The MCP server reads its own package.json at runtime (createRequire), which bundling would break.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', '@mercadopleis/mcp-server'],
  // Per-language URLs: English pages live at the root and are served from app/[lang] with lang=en; /es and /pt
  // map straight to the segment. API routes, /mcp, /.well-known, Next internals and public files never get a prefix.
  async rewrites() {
    return {
      afterFiles: [
        { source: '/', destination: '/en' },
        {
          source: '/:path((?!api(?:/|$)|mcp(?:/|$)|_next/|\.well-known/|es(?:/|$)|pt(?:/|$)|en(?:/|$)).*)',
          destination: '/en/:path',
        },
      ],
    };
  },
  // /en is the root: one URL per page.
  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
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

export default nextConfig;
