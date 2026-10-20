import type { Metadata } from 'next';
import type { Service } from '@mercadopleis/types';
import HomeClient from './HomeClient';
import { listPublicServices } from '@/lib/servicesDb';
import { toJson } from '@/lib/seo';
import { JsonLd, organizationLd, websiteLd } from '@/lib/jsonLd';

// Title, description and social cards come from the root layout; only the canonical is set here,
// so that pages without their own canonical do not point at the home page.
export const metadata: Metadata = { alternates: { canonical: '/' } };

// The catalog is in the HTML for crawlers and slow connections, regenerated at most once a minute;
// visitors get the cached page without waiting on a cold function or database.
export const revalidate = 60;

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
