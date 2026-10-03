'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CategoryPills } from '@/components/CategoryPills';
import { ServiceCard } from '@/components/ServiceCard';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Service } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { ShieldCheck, Search, Zap, CheckCircle, MapPin, Globe, Compass, X, Filter } from 'lucide-react';

const INITIAL_SERVICES: Service[] = [];

export default function HomePage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [servicesList, setServicesList] = useState<Service[]>(INITIAL_SERVICES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'all' | 'digital' | 'in_person'>('all');
  const [locationQuery, setLocationQuery] = useState('');
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

  // Extract distinct localities/cities from the services list for quick filter pills
  const availableLocations = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of servicesList) {
      if (s.locality) set.add(s.locality);
      else if (s.city) set.add(s.city);
    }
    return Array.from(set).slice(0, 8);
  }, [servicesList]);

  const hasActiveFilters = !!(selectedCategory || selectedDeliveryType !== 'all' || locationQuery || searchQuery);

  const handleClearFilters = () => {
    setSelectedCategory(null);
    setSelectedDeliveryType('all');
    setLocationQuery('');
    setSearchQuery('');
  };

  const filteredServices = servicesList.filter((service) => {
    const matchesCategory = !selectedCategory || service.category === selectedCategory;

    const mode = service.deliveryType || 'digital';
    const matchesDeliveryType =
      selectedDeliveryType === 'all' ||
      (selectedDeliveryType === 'digital' && (mode === 'digital' || mode === 'both')) ||
      (selectedDeliveryType === 'in_person' && (mode === 'in_person' || mode === 'both'));

    const locLower = locationQuery.toLowerCase().trim();
    const matchesLocation =
      !locLower ||
      service.locality?.toLowerCase().includes(locLower) ||
      service.city?.toLowerCase().includes(locLower) ||
      service.country?.toLowerCase().includes(locLower) ||
      service.addressOrReference?.toLowerCase().includes(locLower);

    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      service.title.toLowerCase().includes(searchLower) ||
      service.description.toLowerCase().includes(searchLower) ||
      service.locality?.toLowerCase().includes(searchLower) ||
      service.city?.toLowerCase().includes(searchLower) ||
      service.country?.toLowerCase().includes(searchLower);

    return matchesCategory && matchesDeliveryType && matchesLocation && matchesSearch;
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
                Services for the{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  AI Economy
                </span>
              </>
            ) : (
              <>
                Servicios para la{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  Economía de IA
                </span>
              </>
            )}
          </h1>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {language === 'en'
              ? 'Hire people and technical services for AI models, automated workflows, and datasets. Pay in USDC. Your funds stay in a smart contract escrow until you approve the delivery or the review period ends.'
              : 'Contrata personas y servicios técnicos para modelos de IA, flujos automatizados y datasets. Paga en USDC. Tus fondos quedan en un smart contract escrow hasta que apruebas la entrega o termina el período de revisión.'}
          </p>

          {/* Search Input */}
          <div className="mt-8 flex max-w-xl items-center rounded-xl border border-border bg-background/90 p-1.5 shadow-xl shadow-black/40 focus-within:border-primary">
            <Search className="ml-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search transcription, datasets, agents, n8n, scraping, solidity...' : 'Buscar transcripción, datasets, agentes, n8n, scraping, solidity...'}
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
            <p className="font-semibold text-white">{language === 'en' ? '0% Buyer Fee • Keep 97%' : '0% Recargo Comprador • Cobras 97%'}</p>
            <p className="text-slate-400">{language === 'en' ? 'Fixed 3% fee, vs up to 20% on Web2 platforms.' : 'Comisión fija del 3%, frente a hasta 20% en plataformas Web2.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <CheckCircle className="h-6 w-6 text-primary-light shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{language === 'en' ? 'Non-Custodial Escrow' : 'Escrow No Custodial'}</p>
            <p className="text-slate-400">{language === 'en' ? 'USDC locked on Base. 5-day review window before release.' : 'USDC en Base. 5 días de revisión garantizada antes de liberar.'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <Zap className="h-6 w-6 text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{language === 'en' ? 'Human + Agent Services' : 'Servicios para Humanos y Agentes'}</p>
            <p className="text-slate-400">{language === 'en' ? 'Cryptographic SHA-256 deliverable proof onchain.' : 'Entrega con comprobante criptográfico SHA-256 en Base.'}</p>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Section */}
      <section className="mt-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">{language === 'en' ? 'Available Services' : 'Servicios Disponibles'}</h2>
            <p className="text-sm text-slate-400">{language === 'en' ? 'Explore gigs paid through USDC escrow' : 'Explora ofertas con pago protegido por escrow en USDC'}</p>
          </div>

          <span className="text-xs font-medium text-slate-400">
            {language === 'en' ? `Showing ${filteredServices.length} services` : `Mostrando ${filteredServices.length} servicios`}
          </span>
        </div>

        {/* Delivery Mode & Location Filter Bar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/80 p-3 sm:p-4 backdrop-blur-md">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Left: Mode Segmented Control */}
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/80 p-1 sm:flex sm:items-center">
              <button
                type="button"
                onClick={() => setSelectedDeliveryType('all')}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition sm:px-3 sm:py-1.5 ${
                  selectedDeliveryType === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{t('modeAll')}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDeliveryType('digital')}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition sm:px-3 sm:py-1.5 ${
                  selectedDeliveryType === 'digital'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="hidden h-3.5 w-3.5 text-primary-light xs:block" />
                <span>{t('modeDigital')}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDeliveryType('in_person')}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition sm:px-3 sm:py-1.5 ${
                  selectedDeliveryType === 'in_person'
                    ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <MapPin className="hidden h-3.5 w-3.5 text-cyan-400 xs:block" />
                <span>{t('modeInPerson')}</span>
              </button>
            </div>

            {/* Right: Location Filter Input */}
            <div className="relative flex-1 md:max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-cyan-400">
                <MapPin className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder={t('filterLocationPlaceholder')}
                className="w-full rounded-xl border border-border bg-background/90 py-2.5 pl-9 pr-9 text-base text-white placeholder-slate-500 placeholder:text-sm sm:placeholder:text-xs transition focus:border-cyan-400 focus:outline-none sm:py-2 sm:pr-8 sm:text-xs"
              />
              {locationQuery && (
                <button
                  type="button"
                  onClick={() => setLocationQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-white sm:px-0 sm:pr-2.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Location Pills & Active Filter Reset */}
          {(availableLocations.length > 0 || hasActiveFilters) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
                  <MapPin className="h-3 w-3 text-cyan-400" />
                  {language === 'en' ? 'Locations:' : 'Zonas:'}
                </span>
                {availableLocations.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocationQuery(locationQuery === loc ? '' : loc)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      locationQuery.toLowerCase() === loc.toLowerCase()
                        ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
                        : 'border border-border/80 bg-background/60 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                >
                  <X className="h-3 w-3" />
                  <span>{t('clearFilters')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category Pills */}
        <div className="mt-4">
          <CategoryPills
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

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
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface-elevated hover:text-white transition"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{t('clearFilters')}</span>
                </button>
              )}
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
