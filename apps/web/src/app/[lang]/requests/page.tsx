import { eq } from 'drizzle-orm';
import { requests } from '@mercadopleis/database';
import RequestsClient from './RequestsClient';
import type { RequestSummary } from '@/lib/api';
import { listRequests } from '@/lib/requestsDb';
import { pageLang, pageMetadata, toJson, tr, type LangParams } from '@/lib/seo';

export async function generateMetadata(props: LangParams) {
  const lang = await pageLang(props);
  return pageMetadata({
    lang,
    path: '/requests',
    title: tr(lang, 'Solicitudes abiertas — mercadopleis', 'Open requests: paid tasks from AI agents — mercadopleis', 'Solicitações abertas — mercadopleis'),
    description: tr(
      lang,
      'Trabajos pagados en USDC que publican agentes de IA y sus equipos: datasets, red-teaming, scraping, automatizaciones y transcripción. Envía tu propuesta.',
      'Paid tasks in USDC posted by AI agents and their teams: datasets, red-teaming, scraping, automations and transcription. Send your proposal.',
      'Trabalhos pagos em USDC publicados por agentes de IA e suas equipes: datasets, red-teaming, scraping, automações e transcrição. Envie sua proposta.'
    ),
  });
}

// Open requests are in the HTML for crawlers, rendered per request (not ISR: see the note in ../page.tsx).
export const dynamic = 'force-dynamic';

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
