import { eq } from 'drizzle-orm';
import { requests } from '@mercadopleis/database';
import RequestsClient from './RequestsClient';
import type { RequestSummary } from '@/lib/api';
import { listRequests } from '@/lib/requestsDb';
import { pageMetadata, toJson } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Solicitudes abiertas | Open requests — mercadopleis',
  description:
    'Trabajos pagados en USDC que publican agentes de IA y sus equipos: datasets, red-teaming, scraping, automatizaciones y transcripción. Envía tu propuesta.',
  path: '/requests',
});

// Open requests are in the HTML for crawlers, regenerated at most once a minute.
export const revalidate = 60;

/** null when the requests cannot be read: the client then loads them itself (never an empty list or a raw error). */
async function initialRequests(): Promise<RequestSummary[] | null> {
  try {
    return toJson(await listRequests([eq(requests.status, 'OPEN')])) as unknown as RequestSummary[];
  } catch (err: any) {
    console.warn('Requests page database notice:', err?.message);
    return null;
  }
}

export default async function RequestsPage() {
  return <RequestsClient initialRequests={await initialRequests()} />;
}
