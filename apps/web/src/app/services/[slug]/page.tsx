'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Service } from '@mercadopleis/types';
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

const FALLBACK_SERVICES: Service[] = [
  {
    id: 's-1',
    sellerId: 'user-1',
    title: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
    slug: 'desarrollo-smart-contract-escrow-solidity',
    description:
      'Desarrollo integral de smart contracts con Foundry y OpenZeppelin. Incluye contratos auditables, suite completa de pruebas unitarias, fuzz testing de invariantes matemáticas, optimización de consumo de gas y scripts de despliegue para Base y Base Sepolia.',
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
    description:
      'Prototipo interactivo en Figma de alta fidelidad para aplicaciones descentralizadas. Incluye sistema de diseño completo con componentes reutilizables, tipografías modernas, paleta dark mode premium con gradientes sutiles y diseño 100% responsive para móviles y desktop.',
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
    description:
      'Especificación rigurosa de producto y arquitectura técnica: descripción de smart contracts, flujos de escrow, diagramas de interacción, tokenomics y modelo de negocio en inglés y español con estándares profesionales.',
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
    description:
      'Revisión manual y automatizada de contratos inteligentes para prevenir vulnerabilidades críticas como reentrancy, desbordamientos, manipulaciones de timestamp o fallos de control de acceso antes de su despliegue en mainnet.',
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
    description:
      'Integración completa de interfaz Web3 moderna con Next.js App Router, conexión multicanal con RainbowKit, transacciones tipadas con Viem y Wagmi, y diseño responsive con Tailwind CSS.',
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
    description:
      'Identidad visual completa adaptada al ecosistema cripto: logotipo vectorial, paleta de colores cromática, fuentes, manual de uso y activos gráficos para perfiles de redes sociales y Discord.',
    category: 'design',
    priceUsdc: 200,
    deliveryDays: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [service, setService] = useState<Service | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    let allServices = [...FALLBACK_SERVICES];
    try {
      const stored = localStorage.getItem('mercadopleis_custom_services');
      if (stored) {
        const custom = JSON.parse(stored);
        if (Array.isArray(custom)) {
          allServices = [...custom, ...FALLBACK_SERVICES];
        }
      }
    } catch (e) {
      console.error(e);
    }

    const found = allServices.find((s) => s.slug === slug);
    if (found) {
      setService(found);
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

  if (!service) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-slate-400">Cargando detalles del servicio...</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary-light hover:underline">
          Volver al Catálogo
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
          <span>Volver al Catálogo</span>
        </Link>

        <span className="rounded-md bg-surface-elevated px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Categoría: {service.category}
        </span>
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
              Resumen de Contratación
            </span>

            {/* Price */}
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-slate-300">Precio total</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{service.priceUsdc}</span>
                <span className="text-sm font-bold text-usdc">USDC</span>
              </div>
            </div>

            {/* Delivery time */}
            <div className="mt-3 flex items-center justify-between border-b border-border/80 pb-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" /> Plazo de entrega:
              </span>
              <span className="font-semibold text-white">
                {service.deliveryDays} {service.deliveryDays === 1 ? 'día' : 'días'}
              </span>
            </div>

            {/* Escrow Guarantee Points (Sprint 0 Spec) */}
            <div className="mt-5 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                <span>
                  <strong>0% de recargo al comprador:</strong> Abonas el precio exacto sin comisiones sorpresa.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-light mt-0.5" />
                <span>
                  <strong>Escrow Non-Custodial:</strong> Los USDC se bloquean en el contrato inteligente hasta tu aprobación.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>5 días de revisión:</strong> Ventana garantizada para validar entregas antes del auto-release.
                </span>
              </div>
            </div>

            {/* Book Button */}
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-white shadow-xl shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99]"
            >
              Contratar Servicio con Escrow
            </button>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              Protegido por Smart Contract en Base Sepolia
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
