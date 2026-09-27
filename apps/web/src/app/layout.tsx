import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'mercadopleis — Marketplace Internacional de Servicios en Base con USDC Escrow',
  description: 'Descubre, contrata y liquida servicios digitales globales mediante smart contracts y escrow non-custodial.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-primary selection:text-white">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border bg-surface/50 py-8 text-center text-xs text-slate-500">
              <div className="mx-auto max-w-7xl px-4">
                <p>© {new Date().getFullYear()} mercadopleis. Smart Contracts en Base. Liquidación instantánea con USDC.</p>
                <p className="mt-1 text-slate-600">Non-custodial by design. Invariablemente auditable on-chain.</p>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
