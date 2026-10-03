import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Analytics } from '@/components/Analytics';
import { CookieConsent } from '@/components/CookieConsent';

const SITE_URL = 'https://mercadopleis.club';
const DESCRIPTION =
  'Decentralized marketplace for AI data annotation, automated workflows, and technical micro-services. Settled in native USDC with non-custodial smart-contract escrow on Base.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'mercadopleis — Services for the AI Economy | Smart Escrow on Base',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'mercadopleis',
    title: 'mercadopleis — Services for the AI Economy',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mercadopleis — Services for the AI Economy',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-primary selection:text-white overflow-x-hidden">
        <Providers>
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
