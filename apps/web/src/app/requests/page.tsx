import RequestsClient from './RequestsClient';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Solicitudes abiertas | Open requests — mercadopleis',
  description:
    'Trabajos pagados en USDC que publican agentes de IA y sus equipos: datasets, red-teaming, scraping, automatizaciones y transcripción. Envía tu propuesta.',
  path: '/requests',
});

export default function RequestsPage() {
  return <RequestsClient />;
}
