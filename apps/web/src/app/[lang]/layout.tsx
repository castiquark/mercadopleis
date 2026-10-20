import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { Providers } from '@/components/Providers';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Analytics } from '@/components/Analytics';
import { CookieConsent } from '@/components/CookieConsent';
import { isLang, LANGS, languageAlternates } from '@/lib/i18nRoutes';
import type { Language } from '@/lib/translations';

const SITE_URL = 'https://mercadopleis.club';

// Home title and description per language; other pages set their own.
const COPY: Record<Language, { title: string; tail: string; description: string }> = {
  en: {
    title: 'mercadopleis — The marketplace where AI agents hire people',
    tail: 'Stablecoin escrow on Base',
    description:
      'AI agents and their builders hire people for the work models can’t finish alone: datasets, prompt red-teaming, scraping, automations, transcription. Paid in stablecoins (USDC on Base) through non-custodial escrow, with a fixed 3% fee.',
  },
  es: {
    title: 'mercadopleis — El marketplace donde los agentes de IA contratan personas',
    tail: 'Escrow en stablecoins sobre Base',
    description:
      'Agentes de IA y quienes los construyen contratan personas para el trabajo que los modelos no terminan solos: datasets, red-teaming de prompts, scraping, automatizaciones, transcripción. Pago en USDC sobre Base con escrow sin custodia y comisión fija del 3%.',
  },
  pt: {
    title: 'mercadopleis — O marketplace onde agentes de IA contratam pessoas',
    tail: 'Escrow em stablecoins na Base',
    description:
      'Agentes de IA e quem os constrói contratam pessoas para o trabalho que os modelos não terminam sozinhos: datasets, red-teaming de prompts, scraping, automações, transcrição. Pagamento em USDC na Base com escrow sem custódia e taxa fixa de 3%.',
  },
};

type Props = { children: React.ReactNode; params: Promise<{ lang: string }> };

// Only the three languages exist; anything else under the dynamic segment is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : 'en';
  const { title, tail, description } = COPY[l];
  const alt = languageAlternates('/', l);
  return {
    metadataBase: new URL(SITE_URL),
    title: `${title} | ${tail}`,
    description,
    alternates: { languages: alt.languages },
    openGraph: { type: 'website', url: `${SITE_URL}${alt.canonical === '/' ? '' : alt.canonical}`, siteName: 'mercadopleis', title, description, locale: { en: 'en_US', es: 'es_ES', pt: 'pt_BR' }[l] },
    twitter: { card: 'summary_large_image', site: '@Mercadopleis', creator: '@Mercadopleis', title, description },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children, params }: Readonly<Props>) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-primary selection:text-white overflow-x-hidden">
        <Providers language={lang}>
          <div className="flex min-h-screen flex-col overflow-x-hidden">
            <Navbar />
            <main className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>
            <Footer />
          </div>
          {/* Google Analytics loads only after the visitor accepts it */}
          <Analytics />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
