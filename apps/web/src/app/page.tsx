'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CategoryPills } from '@/components/CategoryPills';
import { ServiceCard } from '@/components/ServiceCard';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Service } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { ShieldCheck, Search, Zap, CheckCircle } from 'lucide-react';

const INITIAL_SERVICES: Service[] = [];

export default function HomePage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [servicesList, setServicesList] = useState<Service[]>(INITIAL_SERVICES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<Service | null>(null);


  useEffect(() => {
    async function loadData() {
      try {
        const { fetchServices } = await import('@/lib/api');
        const apiServices = await fetchServices();

        const stored = typeof window !== 'undefined' ? localStorage.getItem('mercadopleis_custom_services') : null;
        const custom = stored ? JSON.parse(stored) : [];

        const combined: Service[] = [...(Array.isArray(custom) ? custom : [])];
        if (Array.isArray(apiServices)) {
          for (const s of apiServices) {
            if (!combined.some((c) => c.slug === s.slug || c.id === s.id)) {
              combined.push(s);
            }
          }
        }
        setServicesList(combined);
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);


  const filteredServices = servicesList.filter((service) => {
    const matchesCategory = !selectedCategory || service.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface via-surface to-background p-8 md:p-12">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary-light">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span>{language === 'en' ? 'Smart Escrow on Base • Native USDC' : 'Escrow Inteligente en Base • USDC Nativo'}</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {language === 'en' ? (
              <>
                Hire global services with the security of a{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  Smart Escrow
                </span>
              </>
            ) : (
              <>
                Contrata servicios globales con la seguridad de un{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  Smart Escrow
                </span>
              </>
            )}
          </h1>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {language === 'en'
              ? 'Discover freelancers worldwide. Pay in USDC. Your funds are secured in a non-custodial smart contract and only released when you approve delivery.'
              : 'Descubre freelancers de todo el mundo. Paga en USDC. Tus fondos se bloquean en un smart contract non-custodial y solo se liberan cuando apruebas la entrega.'}
          </p>

          {/* Search Input */}
          <div className="mt-8 flex max-w-xl items-center rounded-xl border border-border bg-background/90 p-1.5 shadow-xl shadow-black/40 focus-within:border-primary">
            <Search className="ml-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search development, design, marketing...' : 'Buscar desarrollo, diseño, marketing...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Decorative Grid glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      </section>

      {/* Value Pillars */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <ShieldCheck className="h-6 w-6 text-accent shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{language === 'en' ? '0% Buyer Fee' : '0% Comisión al Comprador'}</p>
            <p className="text-slate-400">{language === 'en' ? 'Pay the exact price you see, no hidden fees.' : 'Pagas el precio exacto que ves, sin sorpresas.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <CheckCircle className="h-6 w-6 text-primary-light shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{language === 'en' ? '5-Day Guarantee' : 'Garantía de 5 Días'}</p>
            <p className="text-slate-400">{language === 'en' ? 'Sufficient time to review deliverables before releasing funds.' : 'Tiempo suficiente para revisar entregas antes de liberar.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <Zap className="h-6 w-6 text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{language === 'en' ? 'Timeout Refund' : 'Reembolso por Timeout'}</p>
            <p className="text-slate-400">{language === 'en' ? 'If freelancer fails to deliver in time, claim 100% direct refund.' : 'Si el vendedor no entrega, recuperas el 100% directo.'}</p>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Section */}
      <section className="mt-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">{language === 'en' ? 'Available Services' : 'Servicios Disponibles'}</h2>
            <p className="text-sm text-slate-400">{language === 'en' ? 'Explore verified gigs with instant USDC escrow' : 'Explora ofertas verificadas con liquidación en USDC'}</p>
          </div>

          <span className="text-xs font-medium text-slate-400">
            {language === 'en' ? `Showing ${filteredServices.length} services` : `Mostrando ${filteredServices.length} servicios`}
          </span>
        </div>

        {/* Category Pills */}
        <CategoryPills
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Services Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onBook={(s) => setSelectedServiceForBooking(s)}
            />
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center text-slate-400">
            <p className="text-base font-semibold">{t('noServicesFound')}</p>
            <p className="mt-1 text-xs text-slate-500">{t('noServicesDesc')}</p>
            <div className="mt-5">
              <Link
                href="/services/new"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:bg-primary-hover active:scale-95"
              >
                <span>{language === 'en' ? 'Publish the First Service' : 'Publicar el Primer Servicio'}</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Checkout Modal */}
      {selectedServiceForBooking && (
        <CheckoutModal
          service={selectedServiceForBooking}
          onClose={() => setSelectedServiceForBooking(null)}
          onSuccess={() => {
            setSelectedServiceForBooking(null);
            router.push('/orders');
          }}
        />
      )}

    </div>
  );
}
