import type { MetadataRoute } from 'next';

const BASE = 'https://mercadopleis.club';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/requests`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/services/new`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const { db, services } = await import('@mercadopleis/database');
    const { and, eq } = await import('drizzle-orm');
    const rows = await db.query.services.findMany({ where: and(eq(services.isActive, true), eq(services.isListed, true)), columns: { slug: true, updatedAt: true } });
    for (const s of rows) {
      entries.push({ url: `${BASE}/services/${s.slug}`, lastModified: s.updatedAt ?? undefined, changeFrequency: 'weekly', priority: 0.8 });
    }
  } catch {
    // Database unavailable: still serve the static entries.
  }
  return entries;
}
