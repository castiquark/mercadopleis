import type { Service } from '@mercadopleis/types';
import HomeClient from './HomeClient';
import { listPublicServices } from '@/lib/servicesDb';
import { pageLang, toJson, type LangParams } from '@/lib/seo';
import { languageAlternates } from '@/lib/i18nRoutes';
import { JsonLd, organizationLd, websiteLd } from '@/lib/jsonLd';

// Title, description and social cards come from the layout (per language); the home page adds its canonical.
export async function generateMetadata(props: LangParams) {
  return { alternates: languageAlternates('/', await pageLang(props)) };
}

// The catalog is in the HTML for crawlers and slow connections, rendered per request. Not ISR: on Netlify the
// background regeneration of the rewritten root (/ -> /en) cached the 404 page at the edge (20 Oct 2026).
export const dynamic = 'force-dynamic';

/** null when the catalog cannot be read: the client then loads it itself, instead of showing an empty catalog. */
async function initialServices(): Promise<Service[] | null> {
  try {
    return toJson(await listPublicServices()) as unknown as Service[];
  } catch (err: any) {
    console.warn('Home catalog database notice:', err?.message);
    return null;
  }
}

export default async function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      <HomeClient initialServices={await initialServices()} />
    </>
  );
}
