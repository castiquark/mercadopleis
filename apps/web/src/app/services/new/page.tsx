'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { MARKETPLACE_CATEGORIES, ServiceCategory, ServiceDeliveryType } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { ArrowLeft, Clock, DollarSign, Sparkles, CheckCircle2, AlertCircle, MapPin, Globe, Compass } from 'lucide-react';
import Link from 'next/link';

export default function NewServicePage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { language, t } = useLanguage();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('ai_data');
  const [deliveryType, setDeliveryType] = useState<ServiceDeliveryType>('digital');
  const [country, setCountry] = useState('Uruguay');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [addressOrReference, setAddressOrReference] = useState('');
  const [description, setDescription] = useState('');
  const [priceUsdc, setPriceUsdc] = useState<string>('150');
  const [deliveryDays, setDeliveryDays] = useState<string>('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const priceNum = parseFloat(priceUsdc) || 0;
  // Seller receives 97% (3% platform fee deducted upon release as agreed in Sprint 0)
  const fee = (priceNum * 0.03).toFixed(2);
  const netEarnings = (priceNum * 0.97).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || priceNum <= 0) return;

    if (!address) {
      alert('Por favor conecta tu wallet para publicar un servicio.');
      setIsSubmitting(false);
      return;
    }

    const isInPerson = deliveryType === 'in_person' || deliveryType === 'both';

    // Store in localStorage so it appears immediately across all components!
    const newService = {
      id: `local-${Date.now()}`,
      sellerId: address,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + `-${Date.now().toString().slice(-4)}`,
      description,
      category,
      deliveryType,
      country: isInPerson ? country.trim() : null,
      city: isInPerson ? city.trim() : null,
      locality: isInPerson ? locality.trim() : null,
      addressOrReference: isInPerson ? addressOrReference.trim() : null,
      priceUsdc: priceNum,
      deliveryDays: parseInt(deliveryDays, 10) || 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const { createService } = await import('@/lib/api');
      await createService({
        title,
        description,
        category,
        deliveryType,
        country: isInPerson ? country.trim() : undefined,
        city: isInPerson ? city.trim() : undefined,
        locality: isInPerson ? locality.trim() : undefined,
        addressOrReference: isInPerson ? addressOrReference.trim() : undefined,
        priceUsdc: priceNum,
        deliveryDays: parseInt(deliveryDays, 10) || 3,
        sellerWallet: address || undefined,
      }).catch((e) => console.warn('[API] Could not save to remote backend, saving to local fallback:', e));

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

  const selectedCatObj = MARKETPLACE_CATEGORIES.find((c) => c.id === category);
  const selectedCatLabel = selectedCatObj
    ? language === 'en'
      ? selectedCatObj.nameEn || selectedCatObj.name
      : selectedCatObj.name
    : category;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 transition hover:text-white sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{language === 'en' ? 'Back to Catalog' : 'Volver al Catálogo'}</span>
      </Link>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        {/* Form Column */}
        <div className="flex-1 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-2 text-primary-light">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {language === 'en' ? 'Create Listing' : 'Crear Oferta'}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">
            {language === 'en' ? 'Publish New Service' : 'Publicar Nuevo Servicio'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {language === 'en'
              ? 'Set your USDC price and delivery timeframe. Get paid via automated smart contract escrow.'
              : 'Define tu tarifa en USDC y plazo de entrega. Cobra mediante liquidación automática por smart contract.'}
          </p>

          {!isConnected && (
            <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                {language === 'en'
                  ? 'Connect your wallet to link this service to your payout address.'
                  : 'Conecta tu wallet para vincular este servicio a tu dirección de cobro.'}
              </span>
            </div>
          )}

          {success && (
            <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/10 p-3.5 text-xs font-semibold text-accent">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
              <span>
                {language === 'en'
                  ? 'Service published successfully! Redirecting to catalog...'
                  : '¡Servicio publicado con éxito! Redirigiendo al catálogo...'}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {language === 'en' ? 'Service Title' : 'Título del Servicio'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  language === 'en'
                    ? 'e.g. Escrow Smart Contract Development in Solidity'
                    : 'ej. Desarrollo de Smart Contract Escrow en Solidity'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-primary focus:outline-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {language === 'en' ? 'Category' : 'Categoría'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white transition focus:border-primary focus:outline-none"
              >
                {MARKETPLACE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-surface text-white">
                    {language === 'en' ? (cat.nameEn || cat.name) : cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Mode: Digital vs In-Person vs Hybrid */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  {t('deliveryModeLabel')}
                </label>
                <span className="text-[11px] text-slate-400">
                  {t('deliveryModeHelp')}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setDeliveryType('digital')}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition ${
                    deliveryType === 'digital'
                      ? 'border-primary bg-primary/15 text-white shadow-md shadow-primary/20'
                      : 'border-border bg-background text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Globe className={`h-5 w-5 ${deliveryType === 'digital' ? 'text-primary-light' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">{t('modeDigital')}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    {language === 'en' ? '100% Online / Remote' : '100% Online / Remoto'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('in_person')}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition ${
                    deliveryType === 'in_person'
                      ? 'border-cyan-400 bg-cyan-500/15 text-white shadow-md shadow-cyan-500/20'
                      : 'border-border bg-background text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <MapPin className={`h-5 w-5 ${deliveryType === 'in_person' ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">{t('modeInPerson')}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    {language === 'en' ? 'Physical / In-Person' : 'Físico / Presencial'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('both')}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition ${
                    deliveryType === 'both'
                      ? 'border-indigo-400 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/20'
                      : 'border-border bg-background text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Compass className={`h-5 w-5 ${deliveryType === 'both' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">{t('modeBoth')}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    {language === 'en' ? 'Hybrid / Flexible' : 'Híbrido / Flexible'}
                  </span>
                </button>
              </div>
            </div>

            {/* In-Person Geographic Location Form */}
            {(deliveryType === 'in_person' || deliveryType === 'both') && (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    {t('locationSectionTitle')}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {t('locationSectionSubtitle')}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Country */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      {t('countryLabel')} *
                    </label>
                    <input
                      type="text"
                      required={true}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder={language === 'en' ? 'e.g. Uruguay, Argentina, United States...' : 'ej. Uruguay, Argentina, España...'}
                      className="mt-1.5 w-full rounded-xl border border-cyan-500/30 bg-background/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      {t('cityLabel')} *
                    </label>
                    <input
                      type="text"
                      required={true}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={language === 'en' ? 'e.g. Maldonado, Montevideo, Buenos Aires...' : 'ej. Maldonado, Montevideo, Buenos Aires...'}
                      className="mt-1.5 w-full rounded-xl border border-cyan-500/30 bg-background/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Locality / Barrio / Balneario */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-300">
                    {t('localityLabel')} *
                  </label>
                  <input
                    type="text"
                    required={true}
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder={t('localityPlaceholder')}
                    className="mt-1.5 w-full rounded-xl border border-cyan-500/30 bg-background/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Address or Meeting point */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-300">
                    {t('addressOrRefLabel')}
                  </label>
                  <input
                    type="text"
                    value={addressOrReference}
                    onChange={(e) => setAddressOrReference(e.target.value)}
                    placeholder={t('addressOrRefPlaceholder')}
                    className="mt-1.5 w-full rounded-xl border border-cyan-500/30 bg-background/80 px-3.5 py-2 text-sm text-white placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {language === 'en' ? 'Description & Deliverables' : 'Descripción y Entregables'}
              </label>
              <textarea
                required
                rows={4}
                placeholder={
                  language === 'en'
                    ? 'Detail what your deliverables include, tools used, requirements from client...'
                    : 'Detalla qué incluye tu entrega, herramientas que usas, entregables y requisitos del cliente...'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-primary focus:outline-none"
              />
            </div>

            {/* Pricing & Timeline row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  {language === 'en' ? 'Price (USDC)' : 'Precio (USDC)'}
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
                  {language === 'en' ? 'Delivery Time (Days)' : 'Tiempo de Entrega (Días)'}
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
                    {language === 'en' ? 'days' : 'días'}
                  </div>
                </div>
              </div>
            </div>

            {/* Commission calculation preview */}
            <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>
                  {language === 'en' ? 'Published price to buyer:' : 'Precio publicado al comprador:'}
                </span>
                <span className="font-semibold text-white">{priceNum} USDC</span>
              </div>
              <div className="mt-1.5 flex justify-between text-slate-400">
                <span>
                  {language === 'en'
                    ? 'Platform fee (3% deducted upon escrow release):'
                    : 'Comisión de plataforma (3% deducido en liquidación):'}
                </span>
                <span className="text-slate-300">-{fee} USDC</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border/60 pt-2 font-bold text-accent">
                <span>
                  {language === 'en'
                    ? 'Net received in your wallet when delivery approved:'
                    : 'Recibes neto en tu wallet al aprobar entrega:'}
                </span>
                <span>{netEarnings} USDC</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title || !description || priceNum <= 0}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting
                ? (language === 'en' ? 'Publishing...' : 'Publicando...')
                : (language === 'en' ? 'Publish Service to Marketplace' : 'Publicar Servicio en el Marketplace')}
            </button>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="w-full lg:w-80">
          <div className="sticky top-24">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {language === 'en' ? 'Card Live Preview' : 'Vista Previa de Tarjeta'}
            </span>

            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {selectedCatLabel}
                  </span>
                  {deliveryType === 'in_person' && (
                    <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30">
                      {language === 'en' ? 'In-Person' : 'Presencial'}
                    </span>
                  )}
                  {deliveryType === 'both' && (
                    <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                      {language === 'en' ? 'Hybrid' : 'Híbrido'}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-accent">
                  {language === 'en' ? 'New' : 'Nuevo'}
                </span>
              </div>

              {(deliveryType === 'in_person' || deliveryType === 'both') && (
                <div className="mt-2.5 flex items-center gap-1 text-xs text-cyan-300">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  <span className="truncate font-medium">
                    {locality ? `${locality}, ` : ''}{city ? `${city}` : country}
                  </span>
                </div>
              )}

              <h4 className="mt-3 font-semibold text-white">
                {title || (language === 'en' ? 'Your service title here' : 'Título de tu servicio aquí')}
              </h4>

              <p className="mt-2 line-clamp-3 text-xs text-slate-400">
                {description ||
                  (language === 'en'
                    ? 'Detailed description of your deliverables will appear here...'
                    : 'Aquí aparecerá la descripción detallada de lo que entregas al comprador...')}
              </p>

              <div className="mt-4 border-t border-border/80 pt-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {language === 'en'
                      ? `Delivery: ${deliveryDays || 3} days`
                      : `Entrega: ${deliveryDays || 3} días`}
                  </span>
                  <span className="text-accent">
                    {language === 'en' ? 'Protected Escrow' : 'Escrow protegido'}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">
                    {language === 'en' ? 'Total price' : 'Precio total'}
                  </span>
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

