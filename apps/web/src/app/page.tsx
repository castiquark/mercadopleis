'use client';

import React, { useState, useEffect } from 'react';
import { CategoryPills } from '@/components/CategoryPills';
import { ServiceCard } from '@/components/ServiceCard';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Service } from '@mercadopleis/types';
import { ShieldCheck, Search, Zap, CheckCircle, ArrowRight } from 'lucide-react';

const INITIAL_SERVICES: Service[] = [
  {
    id: 's-1',
    sellerId: 'user-1',
    title: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
    slug: 'desarrollo-smart-contract-escrow-solidity',
    description: 'Desarrollo integral con Foundry, OpenZeppelin, pruebas unitarias exhaustivas y cobertura de invariantes/fuzzing.',
    category: 'development',
    priceUsdc: 250,
    deliveryDays: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's-2',
    sellerId: 'user-2',
    title: 'Diseño UI/UX de Landing Page Web3 en Figma',
    slug: 'diseno-ui-ux-landing-page-web3-figma',
    description: 'Prototipo interactivo en Figma de alta fidelidad, sistema de diseño con componentes reutilizables y paleta dark mode premium.',
    category: 'design',
    priceUsdc: 180,
    deliveryDays: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's-3',
    sellerId: 'user-3',
    title: 'Redacción de Documentación Técnica & Whitepaper Cripto',
    slug: 'redaccion-documentacion-tecnica-whitepaper',
    description: 'Especificación detallada de arquitectura, flujo de smart contracts, tokenomics y modelo de negocio en inglés y español.',
    category: 'marketing',
    priceUsdc: 150,
    deliveryDays: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's-4',
    sellerId: 'user-4',
    title: 'Consultoría y Auditoría de Seguridad Preliminar de Contratos',
    slug: 'consultoria-auditoria-seguridad-contratos',
    description: 'Revisión técnica de vectores de reentrancy, control de acceso, Slither analysis y recomendaciones de optimización de gas.',
    category: 'consulting',
    priceUsdc: 300,
    deliveryDays: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's-5',
    sellerId: 'user-5',
    title: 'Desarrollo Frontend DApp con Next.js, Wagmi & RainbowKit',
    slug: 'desarrollo-frontend-dapp-nextjs-wagmi',
    description: 'Integración completa de wallet, llamadas a smart contracts con Viem, manejo de transacciones pendientes y UI responsive.',
    category: 'development',
    priceUsdc: 350,
    deliveryDays: 6,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 's-6',
    sellerId: 'user-6',
    title: 'Diseño de Marca e Identidad Visual para Proyectos Web3',
    slug: 'diseno-marca-identidad-visual-web3',
    description: 'Logo vectorial, manual de marca, tipografías, kits para redes sociales y banners para comunidades cripto.',
    category: 'design',
    priceUsdc: 200,
    deliveryDays: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function HomePage() {
  const [servicesList, setServicesList] = useState<Service[]>(INITIAL_SERVICES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<Service | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { fetchServices } = await import('@/lib/api');
        const apiServices = await fetchServices();
        if (apiServices && apiServices.length > 0) {
          setServicesList(apiServices);
          return;
        }

        const stored = localStorage.getItem('mercadopleis_custom_services');
        if (stored) {
          const custom = JSON.parse(stored);
          if (Array.isArray(custom) && custom.length > 0) {
            setServicesList([...custom, ...INITIAL_SERVICES]);
          }
        }
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
            <span>Escrow Inteligente en Base • USDC Nativo</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Contrata servicios globales con la seguridad de un{' '}
            <span className="bg-gradient-to-r from-primary-light via-blue-400 to-accent bg-clip-text text-transparent">
              Smart Escrow
            </span>
          </h1>

          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            Descubre freelancers de todo el mundo. Paga en USDC. Tus fondos se bloquean en un smart contract non-custodial y solo se liberan cuando apruebas la entrega.
          </p>

          {/* Search Input */}
          <div className="mt-8 flex max-w-xl items-center rounded-xl border border-border bg-background/90 p-1.5 shadow-xl shadow-black/40 focus-within:border-primary">
            <Search className="ml-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar desarrollo, diseño, marketing..."
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
            <p className="font-semibold text-white">0% Comisión al Comprador</p>
            <p className="text-slate-400">Pagas el precio exacto que ves, sin sorpresas.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <CheckCircle className="h-6 w-6 text-primary-light shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">Garantía de 5 Días</p>
            <p className="text-slate-400">Tiempo suficiente para revisar entregas antes de liberar.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-4">
          <Zap className="h-6 w-6 text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">Reembolso por Timeout</p>
            <p className="text-slate-400">Si el vendedor no entrega, recuperas el 100% directo.</p>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Section */}
      <section className="mt-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Servicios Disponibles</h2>
            <p className="text-sm text-slate-400">Explora ofertas verificadas con liquidación en USDC</p>
          </div>

          <span className="text-xs font-medium text-slate-400">
            Mostrando {filteredServices.length} servicios
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
            <p className="text-base font-semibold">No se encontraron servicios en esta categoría</p>
            <p className="mt-1 text-xs text-slate-500">Prueba quitando los filtros de búsqueda</p>
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
            alert('¡Orden creada exitosamente en el Smart Contract!');
          }}
        />
      )}
    </div>
  );
}
