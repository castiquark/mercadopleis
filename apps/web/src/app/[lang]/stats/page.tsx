import { StatsView } from '@/components/StatsView';
import { getPublicStats, type PublicStats } from '@/lib/publicStats';
import { pageLang, pageMetadata, tr, type LangParams } from '@/lib/seo';

// The numbers are in the server HTML (crawlers, screen recordings, no JS); the page animates on top of them.
// Rendered per request and cached at the CDN for 60 s (next.config.ts headers), not ISR behind the rewrite.
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: LangParams) {
  const lang = await pageLang(props);
  return pageMetadata({
    lang,
    path: '/stats',
    title: tr(lang, 'Operación 100 — mercadopleis', 'Operation 100 — mercadopleis', 'Operação 100 — mercadopleis'),
    description: tr(
      lang,
      'Tracción pública y verificable de Mercadopleis: órdenes completadas, volumen y vendedores en Base Mainnet.',
      'Public, verifiable traction of Mercadopleis: completed orders, volume and sellers on Base Mainnet.',
      'Tração pública e verificável do Mercadopleis: pedidos concluídos, volume e vendedores na Base Mainnet.'
    ),
  });
}

export default async function StatsPage() {
  let stats: PublicStats | null = null;
  try {
    stats = await getPublicStats();
  } catch (err) {
    console.error('Stats page:', err);
  }
  return <StatsView stats={stats} />;
}
