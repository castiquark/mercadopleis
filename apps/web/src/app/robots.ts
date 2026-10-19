import type { MetadataRoute } from 'next';

// Private pages (orders, profile, admin) and forms stay crawlable so Google can read their noindex tag;
// a Disallow would hide the tag and still let a linked URL be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: 'https://mercadopleis.club/sitemap.xml',
  };
}
