'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Service, MARKETPLACE_CATEGORIES } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { CheckoutModal } from '@/components/CheckoutModal';
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  Star,
  CheckCircle2,
  Share2,
  Check,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { fetchServiceReviews } from '@/lib/api';


const FALLBACK_SERVICES: Service[] = [];

export default function ServiceDetailPage() {
  const { language } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [service, setService] = useState<Service | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let customServices: Service[] = [];
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('mercadopleis_custom_services') : null;
      if (stored) {
        const custom = JSON.parse(stored);
        if (Array.isArray(custom)) {
          customServices = custom;
        }
      }
    } catch (e) {
      console.error(e);
    }

    const localFound = customServices.find((s) => s.slug === slug);
    if (localFound) {
      setService(localFound);
      setLoading(false);
    } else {
      fetch(`/api/services/${slug}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.service) setService(data.service);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [slug]);


  const [reviewsList, setReviewsList] = useState<any[]>([]);

  useEffect(() => {
    if (service?.id) {
      fetchServiceReviews(service.id).then((revs) => {
        if (revs && revs.length > 0) setReviewsList(revs);
      });
    }
  }, [service?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-slate-400">
          {language === 'en' ? 'Loading service details...' : 'Cargando detalles del servicio...'}
        </p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-white">
          {language === 'en' ? 'Service not found' : 'Servicio no encontrado'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {language === 'en'
            ? 'This service does not exist or may have been removed.'
            : 'Este servicio no existe o puede haber sido retirado.'}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:bg-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{language === 'en' ? 'Back to Catalog' : 'Volver al Catálogo'}</span>
        </Link>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{language === 'en' ? 'Back to Catalog' : 'Volver al Catálogo'}</span>
        </Link>

        {(() => {
          const categoryObj = MARKETPLACE_CATEGORIES.find((c) => c.id === service.category);
          const categoryLabel = categoryObj
            ? language === 'en'
              ? categoryObj.nameEn || categoryObj.name
              : categoryObj.name
            : service.category;
          return (
            <span className="rounded-md bg-surface-elevated px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {language === 'en' ? 'Category' : 'Categoría'}: {categoryLabel}
            </span>
          );
        })()}
      </div>


      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Details (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            {/* Title & Metadata */}
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold text-white">4.98</span>
              </div>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">83 órdenes completadas</span>
              <span className="text-slate-500">•</span>
              <span className="text-accent font-semibold">100% satisfacción</span>
            </div>

            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {service.title}
            </h1>

            {/* Seller profile card (Consistent with Section 19.3) */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border/80 bg-background/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 font-bold text-primary-light">
                  {service.seller?.displayName?.[0] || 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {service.seller?.displayName || 'Pablo C.'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      <UserCheck className="h-3 w-3" /> Wallet Verificada
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Uruguay • Miembro desde 2026</p>
                </div>
              </div>

              <div className="hidden text-right text-xs sm:block">
                <span className="text-slate-400">Volumen histórico</span>
                <p className="font-bold text-white">12,430 USDC</p>
              </div>
            </div>

            {/* Description */}
            <div className="mt-8 border-t border-border/80 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Acerca de este servicio
              </h3>
              <p className="mt-3 leading-relaxed text-slate-300 text-sm sm:text-base whitespace-pre-line">
                {service.description}
              </p>
            </div>

            {/* What you receive checklist (Section 9.2) */}
            <div className="mt-8 border-t border-border/80 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Qué incluye la entrega
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                  <span>Código fuente completo y documentación técnica</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                  <span>Pruebas unitarias y reporte de verificación</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                  <span>Soporte post-entrega y resolución de dudas</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                  <span>Hash criptográfico on-chain de los archivos entregados</span>
                </div>
              </div>
            </div>

            {/* Customer Reviews Section */}
            <div className="mt-8 border-t border-border/80 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    Reseñas de Clientes Verificados
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calificaciones registradas on-chain tras la liberación del escrow
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>4.98 / 5.0</span>
                </div>
              </div>

              {/* Reviews list */}
              <div className="mt-4 space-y-3">
                {(reviewsList.length > 0
                  ? reviewsList
                  : [
                      {
                        id: 'rev-sample-1',
                        rating: 5,
                        comment: 'Excelente desarrollo de smart contracts. El código fue impecable, bien comentado y con pruebas completas de invariantes. Muy recomendable.',
                        createdAt: '2026-09-24T18:00:00Z',
                        buyer: { displayName: 'Carlos Web3', walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
                      },
                      {
                        id: 'rev-sample-2',
                        rating: 5,
                        comment: 'Gran comunicación y rapidez en la entrega. Cumplió con todos los requerimientos y el escrow garantizó total tranquilidad durante el proceso.',
                        createdAt: '2026-09-22T15:30:00Z',
                        buyer: { displayName: 'Elena D.', walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' },
                      },
                    ]
                ).map((rev: any) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-border/80 bg-background/40 p-4 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary-light">
                          {(rev.buyer?.displayName || 'U')[0]}
                        </div>
                        <span className="font-semibold text-white">
                          {rev.buyer?.displayName || `${rev.buyer?.walletAddress?.slice(0, 6)}...${rev.buyer?.walletAddress?.slice(-4)}`}
                        </span>
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          Verificado
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="mt-2 text-slate-300 leading-relaxed">
                      "{rev.comment}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Checkout Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {language === 'en' ? 'Order Summary' : 'Resumen de Contratación'}
            </span>

            {/* Price */}
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-slate-300">
                {language === 'en' ? 'Total price' : 'Precio total'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{service.priceUsdc}</span>
                <span className="text-sm font-bold text-usdc">USDC</span>
              </div>
            </div>

            {/* Delivery time */}
            <div className="mt-3 flex items-center justify-between border-b border-border/80 pb-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />{' '}
                {language === 'en' ? 'Delivery timeframe:' : 'Plazo de entrega:'}
              </span>
              <span className="font-semibold text-white">
                {language === 'en'
                  ? `${service.deliveryDays} ${service.deliveryDays === 1 ? 'day' : 'days'}`
                  : `${service.deliveryDays} ${service.deliveryDays === 1 ? 'día' : 'días'}`}
              </span>
            </div>

            {/* Escrow Guarantee Points (Sprint 0 Spec) */}
            <div className="mt-5 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                <span>
                  <strong>{language === 'en' ? '0% buyer surcharge:' : '0% de recargo al comprador:'}</strong>{' '}
                  {language === 'en'
                    ? 'You pay the exact price with zero hidden fees.'
                    : 'Abonas el precio exacto sin comisiones sorpresa.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-light mt-0.5" />
                <span>
                  <strong>{language === 'en' ? 'Non-Custodial Escrow:' : 'Escrow Non-Custodial:'}</strong>{' '}
                  {language === 'en'
                    ? 'USDC is locked in the smart contract until your approval.'
                    : 'Los USDC se bloquean en el contrato inteligente hasta tu aprobación.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>{language === 'en' ? '5-day inspection:' : '5 días de revisión:'}</strong>{' '}
                  {language === 'en'
                    ? 'Guaranteed window to inspect deliveries prior to auto-release.'
                    : 'Ventana garantizada para validar entregas antes del auto-release.'}
                </span>
              </div>
            </div>

            {/* Book Button */}
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-white shadow-xl shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99]"
            >
              {language === 'en' ? 'Hire Service with Escrow' : 'Contratar Servicio con Escrow'}
            </button>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              {language === 'en'
                ? 'Secured by Smart Contract on Base Sepolia'
                : 'Protegido por Smart Contract en Base Sepolia'}
            </p>

          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          service={service}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={() => {
            setIsCheckoutOpen(false);
            router.push('/orders');
          }}
        />
      )}
    </div>
  );
}
