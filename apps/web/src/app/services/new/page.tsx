'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { MARKETPLACE_CATEGORIES, ServiceCategory } from '@mercadopleis/types';
import { ArrowLeft, Clock, DollarSign, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewServicePage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('development');
  const [description, setDescription] = useState('');
  const [priceUsdc, setPriceUsdc] = useState<string>('150');
  const [deliveryDays, setDeliveryDays] = useState<string>('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const priceNum = parseFloat(priceUsdc) || 0;
  // Seller receives 97% (3% platform fee deducted upon release as agreed in Sprint 0)
  const fee = (priceNum * 0.03).toFixed(2);
  const netEarnings = (priceNum * 0.97).toFixed(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || priceNum <= 0) return;

    setIsSubmitting(true);

    // In local demo / MVP without backend DB migration, store in localStorage so it appears immediately!
    const newService = {
      id: `local-${Date.now()}`,
      sellerId: address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + `-${Date.now().toString().slice(-4)}`,
      description,
      category,
      priceUsdc: priceNum,
      deliveryDays: parseInt(deliveryDays, 10) || 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem('mercadopleis_custom_services') || '[]');
      localStorage.setItem('mercadopleis_custom_services', JSON.stringify([newService, ...existing]));
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver al Catálogo</span>
      </Link>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        {/* Form Column */}
        <div className="flex-1 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary-light">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Crear Oferta</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">Publicar Nuevo Servicio</h1>
          <p className="mt-1 text-sm text-slate-400">
            Define tu tarifa en USDC y plazo de entrega. Cobra mediante liquidación automática por smart contract.
          </p>

          {!isConnected && (
            <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Conecta tu wallet para vincular este servicio a tu dirección de cobro.</span>
            </div>
          )}

          {success && (
            <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/10 p-3.5 text-xs font-semibold text-accent">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
              <span>¡Servicio publicado con éxito! Redirigiendo al catálogo...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                Título del Servicio
              </label>
              <input
                type="text"
                required
                placeholder="ej. Desarrollo de Smart Contract Escrow en Solidity"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-primary focus:outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white transition focus:border-primary focus:outline-none"
              >
                {MARKETPLACE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-surface text-white">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                Descripción y Entregables
              </label>
              <textarea
                required
                rows={4}
                placeholder="Detalla qué incluye tu entrega, herramientas que usas, entregables y requisitos del cliente..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-primary focus:outline-none"
              />
            </div>

            {/* Pricing & Timeline row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  Precio (USDC)
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={priceUsdc}
                    onChange={(e) => setPriceUsdc(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-14 text-sm text-white transition focus:border-primary focus:outline-none"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-usdc">
                    USDC
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  Tiempo de Entrega (Días)
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-14 text-sm text-white transition focus:border-primary focus:outline-none"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs text-slate-400">
                    días
                  </div>
                </div>
              </div>
            </div>

            {/* Commission calculation preview */}
            <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Precio publicado al comprador:</span>
                <span className="font-semibold text-white">{priceNum} USDC</span>
              </div>
              <div className="mt-1.5 flex justify-between text-slate-400">
                <span>Comisión de plataforma (3% deducido en liquidación):</span>
                <span className="text-slate-300">-{fee} USDC</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border/60 pt-2 font-bold text-accent">
                <span>Recibes neto en tu wallet al aprobar entrega:</span>
                <span>{netEarnings} USDC</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title || !description || priceNum <= 0}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? 'Publicando...' : 'Publicar Servicio en el Marketplace'}
            </button>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="w-full lg:w-80">
          <div className="sticky top-24">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Vista Previa de Tarjeta
            </span>

            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {category}
                </span>
                <span className="text-xs font-semibold text-accent">Nuevo</span>
              </div>

              <h4 className="mt-3 font-semibold text-white">
                {title || 'Título de tu servicio aquí'}
              </h4>

              <p className="mt-2 line-clamp-3 text-xs text-slate-400">
                {description || 'Aquí aparecerá la descripción detallada de lo que entregas al comprador...'}
              </p>

              <div className="mt-4 border-t border-border/80 pt-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Entrega: {deliveryDays || 3} días</span>
                  <span className="text-accent">Escrow protegido</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Precio total</span>
                  <span className="text-lg font-bold text-white">
                    {priceNum} <span className="text-xs text-usdc">USDC</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
