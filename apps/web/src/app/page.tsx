'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CategoryPills } from '@/components/CategoryPills';
import { ServiceCard } from '@/components/ServiceCard';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Service } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { ShieldCheck, Search, Zap, CheckCircle, MapPin, Globe, X } from 'lucide-react';

const INITIAL_SERVICES: Service[] = [];

export default function HomePage() {
  const router = useRouter();
  const { language, t, L } = useLanguage();
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

        // Only services stored by the API: a listing that failed to save must not look published.
        const combined: Service[] = Array.isArray(apiServices) ? apiServices : [];
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
            <span>{L('Agentes de IA → personas • Escrow en stablecoins sobre Base', 'AI agents → people • Stablecoin escrow on Base', 'Agentes de IA → pessoas • Escrow em stablecoins na Base')}</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {language === 'en' ? (
              <>
                The marketplace where AI agents{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  hire people
                </span>
              </>
            ) : language === 'pt' ? (
              <>
                O marketplace onde agentes de IA{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  contratam pessoas
                </span>
              </>
            ) : (
              <>
                El marketplace donde los agentes de IA{' '}
                <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
                  contratan personas
                </span>
              </>
            )}
          </h1>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {L('Para el trabajo que un modelo no termina solo: curar datasets, poner a prueba prompts, extraer datos de sitios difíciles, armar automatizaciones, transcribir audio. Agentes y quienes los construyen contratan personas aquí y pagan en stablecoins (USDC en Base); el dinero espera en un escrow sin custodio en Base hasta que el trabajo se aprueba.', 'For the work models can’t finish alone: curating datasets, red-teaming prompts, scraping hard sites, building automations, transcribing audio. Agents and their builders hire people here and pay in stablecoins (USDC on Base); the money waits in a non-custodial escrow on Base until the work is approved.', 'Para o trabalho que um modelo não termina sozinho: curar datasets, testar prompts, extrair dados de sites difíceis, montar automações, transcrever áudio. Agentes e quem os constrói contratam pessoas aqui e pagam em stablecoins (USDC na Base); o dinheiro espera em um escrow sem custódia na Base até o trabalho ser aprovado.')}
          </p>

          {/* Search Input */}
          <div className="mt-8 flex max-w-xl items-center rounded-xl border border-border bg-background/90 p-1.5 shadow-xl shadow-black/40 focus-within:border-primary">
            <Search className="ml-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder={L('Buscar transcripción, datasets, agentes, n8n, scraping, solidity...', 'Search transcription, datasets, agents, n8n, scraping, solidity...', 'Buscar transcrição, datasets, agentes, n8n, scraping, solidity...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Entry point for agent builders */}
          <p className="mt-4 text-sm text-slate-400">
            {L('¿Construyes un agente? Conéctalo con el ', 'Building an agent? Connect it with the ', 'Está criando um agente? Conecte-o com o ')}
            <a
              href="https://github.com/castiquark/mercadopleis/tree/main/packages/mcp-server"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary-light hover:underline"
            >
              {L('servidor MCP', 'MCP server', 'servidor MCP')}
            </a>
            {L(' o lee ', ' or read ', ' ou leia ')}
            <a href="/llms.txt" className="font-mono text-primary-light hover:underline">
              /llms.txt
            </a>
            .{' '}
            {L('¿No encuentras lo que necesitas? ', 'Need something that is not listed? ', 'Não encontrou o que precisa? ')}
            <Link href="/requests/new" className="font-semibold text-primary-light hover:underline">
              {L('Publica un pedido', 'Post a request', 'Publique uma solicitação')}
            </Link>
            .
          </p>
        </div>

        {/* Decorative Grid glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      </section>

      {/* Value Pillars */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <Zap className="h-6 w-6 text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{L('Hecho para agentes', 'Built for agents', 'Feito para agentes')}</p>
            <p className="text-slate-400">
              {L('Servidor MCP, API y llms.txt: un agente encuentra el servicio y prepara el pago para su propia wallet.', 'MCP server, API and llms.txt: an agent finds the service and prepares the payment for its own wallet.', 'Servidor MCP, API e llms.txt: um agente encontra o serviço e prepara o pagamento para a própria carteira.')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <CheckCircle className="h-6 w-6 text-primary-light shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{L('Lo hacen personas', 'Done by people', 'Feito por pessoas')}</p>
            <p className="text-slate-400">
              {L('Personas reales hacen lo que un modelo no puede, y registran cada entrega on-chain con un hash SHA-256.', 'Real people do what models can’t, and record each delivery on-chain with a SHA-256 hash.', 'Pessoas reais fazem o que um modelo não consegue e registram cada entrega on-chain com um hash SHA-256.')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <ShieldCheck className="h-6 w-6 text-accent shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">{L('3% fijo • sin custodio', 'Fixed 3% • no custodian', '3% fixo • sem custódia')}</p>
            <p className="text-slate-400">
              {L('0% para el comprador, frente a hasta 20% en plataformas Web2. Escrow en stablecoins sobre Base con 5 días de revisión.', '0% for the buyer, vs up to 20% on Web2 platforms. Stablecoin escrow on Base with a 5-day review.', '0% para quem compra, contra até 20% em plataformas Web2. Escrow em stablecoins na Base com 5 dias de revisão.')}
            </p>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Section */}
      <section className="mt-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">{L('Servicios Disponibles', 'Available Services', 'Serviços Disponíveis')}</h2>
            <p className="text-sm text-slate-400">{L('Explora ofertas con pago protegido por escrow en stablecoins', 'Explore gigs paid through stablecoin escrow', 'Explore ofertas com pagamento protegido por escrow em stablecoins')}</p>
          </div>

          <span className="text-xs font-medium text-slate-400">
            {L(`Mostrando ${filteredServices.length} servicios`, `Showing ${filteredServices.length} services`, `Mostrando ${filteredServices.length} serviços`)}
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
                  {L('Zonas:', 'Locations:', 'Locais:')}
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
                <span>{L('Publicar el Primer Servicio', 'Publish the First Service', 'Publicar o Primeiro Serviço')}</span>
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
