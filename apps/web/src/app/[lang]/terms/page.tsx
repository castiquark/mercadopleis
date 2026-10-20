import { LegalDocument } from '@/components/LegalDocument';
import { TERMS } from '@/lib/legalContent';
import { pageLang, pageMetadata, tr, type LangParams } from '@/lib/seo';

export async function generateMetadata(props: LangParams) {
  const lang = await pageLang(props);
  return pageMetadata({
    lang,
    path: '/terms',
    title: `${tr(lang, 'Términos del Servicio', 'Terms of Service', 'Termos de Serviço')} — mercadopleis`,
    description: tr(lang, 'Condiciones de uso de Mercadopleis: escrow sin custodia en USDC sobre Base, comisión fija del 3%, entregas, reembolsos y disputas.', 'Terms of use of Mercadopleis: non-custodial USDC escrow on Base, fixed 3% fee, deliveries, refunds and disputes.', 'Condições de uso do Mercadopleis: escrow sem custódia em USDC na Base, taxa fixa de 3%, entregas, reembolsos e disputas.'),
  });
}

export default function Page() {
  return <LegalDocument content={TERMS} />;
}
