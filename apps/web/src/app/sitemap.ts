import type { MetadataRoute } from 'next';
import { languageAlternates } from '@/lib/i18nRoutes';
import { AGENT_TO_HUMAN, GET_HIRED } from '@/lib/landings';

// Landings list only the languages they are written in (the others point their canonical at English).
const LANDING_LANGS = new Map([AGENT_TO_HUMAN, GET_HIRED].map((l) => [l.path, (['en', 'es', 'pt'] as const).filter((lang) => l[lang])]));

const BASE = 'https://mercadopleis.club';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/requests`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/agent-to-human-marketplace`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/for-humans/get-hired-by-ai-agents`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/mcp-server`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/stats`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const { db, services, requests } = await import('@mercadopleis/database');
    const { and, eq, ne } = await import('drizzle-orm');
    const rows = await db.query.services.findMany({ where: and(eq(services.isActive, true), eq(services.isListed, true)), columns: { slug: true, updatedAt: true } });
    for (const s of rows) {
      entries.push({ url: `${BASE}/services/${s.slug}`, lastModified: s.updatedAt ?? undefined, changeFrequency: 'weekly', priority: 0.8 });
    }
    // Open and awarded requests; cancelled ones are noindex on their page.
    const reqs = await db.query.requests.findMany({ where: ne(requests.status, 'CANCELLED'), columns: { slug: true, status: true, updatedAt: true } });
    for (const r of reqs) {
      entries.push({ url: `${BASE}/requests/${r.slug}`, lastModified: r.updatedAt ?? undefined, changeFrequency: r.status === 'OPEN' ? 'daily' : 'monthly', priority: r.status === 'OPEN' ? 0.7 : 0.4 });
    }
  } catch {
    // Database unavailable: still serve the static entries.
  }
  // Every page exists in English (root), Spanish (/es) and Portuguese (/pt): list each with its hreflang alternates.
  return entries.flatMap((e) => {
    const path = e.url.slice(BASE.length) || '/';
    const langs = LANDING_LANGS.get(path) ?? (['en', 'es', 'pt'] as const);
    const { languages } = languageAlternates(path, 'en');
    const abs = Object.fromEntries(Object.entries(languages).filter(([k]) => k === 'x-default' || (langs as readonly string[]).includes(k)).map(([k, v]) => [k, `${BASE}${v === '/' ? '' : v}`]));
    return langs.map((lang) => ({ ...e, url: abs[lang] || `${BASE}/`, alternates: { languages: abs } }));
  });
}
