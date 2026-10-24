'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@/components/LocaleLink';
import { Service, MARKETPLACE_CATEGORIES, categoryLabel as categoryLabel_ } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { FoundingBadge } from '@/components/FoundingBadge';
import { CheckoutModal } from '@/components/CheckoutModal';
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  Star,
  CheckCircle2,
  Check,
  MapPin,
  Compass,
} from 'lucide-react';
import { fetchServiceReviews } from '@/lib/api';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

/** `initialService` comes from the server render (indexable without a wallet); without it the page loads the service itself. */
export default function ServiceDetailPage({ initialService = null }: { initialService?: Service | null }) {
  const { language, L, lp } = useLanguage();
  const { chainId, address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [service, setService] = useState<Service | null>(initialService);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(!initialService);

  useEffect(() => {
    if (initialService?.slug === slug) return;
    fetch(`/api/services/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.service) setService(data.service);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug, initialService]);


  // ?buy=1 (the checkout link an agent hands to a person, e.g. checkoutUrl from the MCP server) opens the payment
  // straight away: wallet connection first if needed. Ignored for inactive services and for the seller's own service.
  const [buyRequested, setBuyRequested] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('buy') === '1') setBuyRequested(true);
  }, []);
  const clearBuyParam = () => {
    setBuyRequested(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('buy')) {
      url.searchParams.delete('buy');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  };
  const isOwnService = !!address && service?.seller?.walletAddress?.toLowerCase() === address.toLowerCase();
  useEffect(() => {
    if (!buyRequested || !service) return;
    if (!service.isActive || isOwnService) {
      clearBuyParam();
      return;
    }
    if (isConnected) {
      setIsCheckoutOpen(true);
    } else {
      openConnectModal?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyRequested, service, isConnected, isOwnService, openConnectModal]);

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
          {L('Cargando detalles del servicio...', 'Loading service details...', 'Carregando detalhes do serviço...')}
        </p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-white">
          {L('Servicio no encontrado', 'Service not found', 'Serviço não encontrado')}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {L('Este servicio no existe o puede haber sido retirado.', 'This service does not exist or may have been removed.', 'Este serviço não existe ou pode ter sido removido.')}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:bg-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{L('Volver al Catálogo', 'Back to Catalog', 'Voltar ao Catálogo')}</span>
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
          className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 transition hover:text-white sm:min-h-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{L('Volver al Catálogo', 'Back to Catalog', 'Voltar ao Catálogo')}</span>
        </Link>

        <div className="flex items-center gap-2">
          {service.deliveryType === 'in_person' && (
            <span className="rounded-md bg-cyan-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {L('Servicio Presencial', 'In-Person Service', 'Serviço Presencial')}
            </span>
          )}
          {service.deliveryType === 'both' && (
            <span className="rounded-md bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              {L('Híbrido (Online o Presencial)', 'Hybrid (Online or In-Person)', 'Híbrido (Online ou Presencial)')}
            </span>
          )}
          {(() => {
            const categoryObj = MARKETPLACE_CATEGORIES.find((c) => c.id === service.category);
            const categoryLabel = categoryObj ? categoryLabel_(categoryObj, language) : service.category;
            return (
              <span className="rounded-md bg-surface-elevated px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {L('Categoría', 'Category', 'Categoria')}: {categoryLabel}
              </span>
            );
          })()}
        </div>
      </div>


      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Details (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            {/* Title & Metadata */}
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold text-white">
                  {reviewsList.length > 0
                    ? (reviewsList.reduce((acc: number, r: any) => acc + Number(r.rating || 5), 0) / reviewsList.length).toFixed(1)
                    : (L('Nuevo', 'New', 'Novo'))}
                </span>
              </div>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                {reviewsList.length > 0
                  ? `${reviewsList.length} ${reviewsList.length === 1 ? L('reseña', 'review', 'avaliação') : L('reseñas', 'reviews', 'avaliações')}`
                  : (L('Primeras contrataciones disponibles', 'First orders open', 'Primeiras contratações disponíveis'))}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-accent font-semibold">
                {L('Escrow Non-Custodial', 'Non-Custodial Escrow', 'Escrow sem custódia')}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {service.title}
            </h1>

            {/* Seller profile card */}
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border/80 bg-background/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 font-bold text-primary-light">
                  {service.seller?.displayName?.[0] || service.seller?.username?.[0] || 'V'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      {service.seller?.displayName || service.seller?.username || `${service.seller?.walletAddress?.slice(0, 6)}...${service.seller?.walletAddress?.slice(-4)}` || (L('Vendedor Verificado', 'Verified Seller', 'Vendedor Verificado'))}
                    </span>
                    <FoundingBadge n={service.seller?.foundingSellerNumber} />
                  </div>
                  <p className="text-xs text-slate-400">
                    {service.country || 'Global'} • {L('Miembro Registrado', 'Registered Member', 'Membro Registrado')}
                  </p>
                </div>
              </div>

              <div className="hidden text-right text-xs sm:block">
                <span className="text-slate-400">{L('Moneda de Cobro', 'Payment Token', 'Moeda de Pagamento')}</span>
                <p className="font-bold text-white">USDC (Circle)</p>
              </div>
            </div>

            {/* Description */}
            <div className="mt-8 border-t border-border/80 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                {L('Acerca de este servicio', 'About this service', 'Sobre este serviço')}
              </h3>
              <p className="mt-3 leading-relaxed text-slate-300 text-sm sm:text-base whitespace-pre-line">
                {service.description}
              </p>
            </div>

            {/* In-Person Geographic Location Details if applicable */}
            {(service.deliveryType === 'in_person' || service.deliveryType === 'both' || service.locality || service.city) && (
              <div className="mt-8 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <MapPin className="h-5 w-5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {L('Ubicación Geográfica y Encuentro', 'Geographic Location & Meeting Info', 'Localização e Ponto de Encontro')}
                      </h3>
                      <p className="text-xs text-slate-300">
                        {service.deliveryType === 'both'
                          ? (L('Disponible tanto de forma presencial como remota', 'Available both in-person and remotely', 'Disponível presencialmente e a distância'))
                          : (L('Servicio con prestación física / presencial', 'In-person / Physical service', 'Serviço com prestação física / presencial'))}
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-center rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/40">
                    {service.deliveryType === 'both' ? (L('Híbrido', 'Hybrid', 'Híbrido')) : (L('Presencial', 'In-Person', 'Presencial'))}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {service.country && (
                    <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                      <span className="text-slate-400 font-medium block">{L('País', 'Country', 'País')}</span>
                      <span className="text-sm font-semibold text-white mt-0.5 block">{service.country}</span>
                    </div>
                  )}
                  {service.city && (
                    <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                      <span className="text-slate-400 font-medium block">{L('Ciudad / Depto', 'City / State', 'Cidade / Estado')}</span>
                      <span className="text-sm font-semibold text-white mt-0.5 block">{service.city}</span>
                    </div>
                  )}
                  {service.locality && (
                    <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-3">
                      <span className="text-cyan-300 font-medium block">{L('Localidad / Barrio / Balneario', 'Locality / Area', 'Localidade / Bairro')}</span>
                      <span className="text-sm font-bold text-cyan-200 mt-0.5 block">{service.locality}</span>
                    </div>
                  )}
                </div>

                {service.addressOrReference && (
                  <div className="mt-3 rounded-xl border border-border/80 bg-background/40 p-3 text-xs">
                    <span className="text-slate-400 font-medium block">
                      {L('Punto de encuentro, dirección o zona de cobertura:', 'Meeting point, address or coverage notes:', 'Ponto de encontro, endereço ou área de cobertura:')}
                    </span>
                    <p className="text-slate-200 mt-0.5">{service.addressOrReference}</p>
                  </div>
                )}
              </div>
            )}

            {/* How delivery works: platform guarantees, not seller promises */}
            <div className="mt-8 border-t border-border/80 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                {L('Cómo funciona la entrega', 'How delivery works', 'Como funciona a entrega')}
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  L('El vendedor registra la entrega con su hash SHA-256 on-chain', 'The seller records the delivery with its SHA-256 hash on-chain', 'O vendedor registra a entrega com o hash SHA-256 on-chain'),
                  L('Tienes 5 días para aprobarla o abrir una disputa', 'You have 5 days to approve it or open a dispute', 'Você tem 5 dias para aprovar ou abrir uma disputa'),
                  L('Reembolso íntegro si no se entrega en el plazo acordado', 'Full refund if it is not delivered within the agreed time', 'Reembolso total se não for entregue no prazo combinado'),
                  L('Los archivos subidos son privados: solo tú, el vendedor y el árbitro pueden descargarlos', 'Uploaded files are private: only you, the seller and the arbitrator can download them', 'Os arquivos enviados são privados: só você, o vendedor e o árbitro podem baixá-los'),
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-slate-200">
                    <Check className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {L('Lo que incluye el trabajo lo define el vendedor en la descripción; acuerda cualquier detalle en los mensajes de la orden.', 'What the work includes is defined by the seller in the description above; agree on any details in the order messages.', 'O que o trabalho inclui é definido pelo vendedor na descrição; combine qualquer detalhe nas mensagens do pedido.')}
              </p>
            </div>

            {/* Customer Reviews Section */}
            <div className="mt-8 border-t border-border/80 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    {L('Reseñas de Clientes Verificados', 'Verified Client Reviews', 'Avaliações de Clientes Verificados')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {L('Reseñas verificadas vinculadas a órdenes de escrow completadas', 'Verified reviews tied to completed escrow orders', 'Avaliações verificadas vinculadas a pedidos de escrow concluídos')}
                  </p>
                </div>
                {reviewsList.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>
                      {(reviewsList.reduce((acc: number, r: any) => acc + Number(r.rating || 5), 0) / reviewsList.length).toFixed(1)} / 5.0 ({reviewsList.length})
                    </span>
                  </div>
                )}
              </div>

              {/* Reviews list or honest empty state */}
              <div className="mt-4 space-y-3">
                {reviewsList.length > 0 ? (
                  reviewsList.map((rev: any) => (
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
                            {L('Comprador Verificado', 'Verified Buyer', 'Comprador Verificado')}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>

                      <p className="mt-2 text-slate-300 leading-relaxed">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-background/30 p-5 text-center text-xs text-slate-400">
                    <p className="font-medium text-slate-300">
                      {L('Aún no hay reseñas registradas', 'No reviews recorded yet', 'Ainda não há avaliações')}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {L('Sé el primer cliente en contratar este servicio y calificar el trabajo completado.', 'Be the first client to hire this service and review the completed work.', 'Seja o primeiro cliente a contratar este serviço e avaliar o trabalho.')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Checkout Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {L('Resumen de Contratación', 'Order Summary', 'Resumo da Contratação')}
            </span>

            {/* Price */}
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-sm text-slate-300">
                {L('Precio total', 'Total price', 'Preço total')}
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
                {L('Plazo de entrega:', 'Delivery timeframe:', 'Prazo de entrega:')}
              </span>
              <span className="font-semibold text-white">
                {L(`${service.deliveryDays} ${service.deliveryDays === 1 ? 'día' : 'días'}`, `${service.deliveryDays} ${service.deliveryDays === 1 ? 'day' : 'days'}`, `${service.deliveryDays} ${service.deliveryDays === 1 ? 'dia' : 'dias'}`)}
              </span>
            </div>

            {/* Escrow Guarantee Points (Sprint 0 Spec) */}
            <div className="mt-5 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                <span>
                  <strong>{L('0% de recargo al comprador:', '0% buyer surcharge:', '0% de acréscimo para quem compra:')}</strong>{' '}
                  {L('Abonas el precio exacto sin comisiones sorpresa.', 'You pay the exact price with zero hidden fees.', 'Você paga o preço exato, sem taxas surpresa.')}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-light mt-0.5" />
                <span>
                  <strong>{L('Escrow sin custodia:', 'Non-Custodial Escrow:', 'Escrow sem custódia:')}</strong>{' '}
                  {L('Los USDC quedan bloqueados en el contrato hasta que apruebes o termine el período de revisión.', 'USDC stays locked in the smart contract until you approve or the review period ends.', 'Os USDC ficam bloqueados no contrato até você aprovar ou terminar o período de revisão.')}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>{L('5 días de revisión:', '5-day review period:', '5 dias de revisão:')}</strong>{' '}
                  {L('Plazo para validar entregas antes de que el vendedor pueda cobrar.', 'Window to review deliverables before the seller can claim payment.', 'Prazo para validar entregas antes que o vendedor possa receber.')}
                </span>
              </div>
            </div>

            {/* Book Button */}
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-white shadow-xl shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99]"
            >
              {L('Contratar Servicio con Escrow', 'Hire Service with Escrow', 'Contratar Serviço com Escrow')}
            </button>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              {chainId === 84532
                ? (L('Protegido por Smart Contract en Base Sepolia', 'Secured by Escrow Smart Contract on Base Sepolia', 'Protegido por Smart Contract na Base Sepolia'))
                : (L('Protegido por Smart Contract en Base Mainnet', 'Secured by Escrow Smart Contract on Base Mainnet', 'Protegido por Smart Contract na Base Mainnet'))}
            </p>

          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          service={service}
          onClose={() => {
            setIsCheckoutOpen(false);
            clearBuyParam();
          }}
          onSuccess={() => {
            setIsCheckoutOpen(false);
            clearBuyParam();
            router.push(lp('/orders'));
          }}
        />
      )}
    </div>
  );
}
