import type { MetadataRoute } from 'next';

// Lets the site be installed (Add to Home Screen). On iPhone, browser notifications only work for installed sites.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mercadopleis',
    short_name: 'Mercadopleis',
    description: 'Hire people for work AI agents cannot finish alone, with stablecoin escrow on Base.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#090d16',
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
