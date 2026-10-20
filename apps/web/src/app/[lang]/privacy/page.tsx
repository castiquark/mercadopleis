import { LegalDocument } from '@/components/LegalDocument';
import { PRIVACY } from '@/lib/legalContent';
import { pageLang, pageMetadata, tr, type LangParams } from '@/lib/seo';

export async function generateMetadata(props: LangParams) {
  const lang = await pageLang(props);
  return pageMetadata({
    lang,
    path: '/privacy',
    title: `${tr(lang, 'Política de Privacidad', 'Privacy Policy', 'Política de Privacidade')} — mercadopleis`,
    description: tr(lang, 'Qué datos trata Mercadopleis, para qué y cómo ejercer tus derechos.', 'What data Mercadopleis processes, why, and how to exercise your rights.', 'Quais dados o Mercadopleis trata, para quê e como exercer seus direitos.'),
  });
}

export default function Page() {
  return <LegalDocument content={PRIVACY} />;
}
