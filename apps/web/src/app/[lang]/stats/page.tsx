import { StatsView } from '@/components/StatsView';
import { pageLang, pageMetadata, tr, type LangParams } from '@/lib/seo';

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

export default function StatsPage() {
  return <StatsView />;
}
