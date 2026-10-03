'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { MARKETPLACE_CATEGORIES, type Service } from '@mercadopleis/types';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, MessageSquare, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { useAuth } from '@/lib/authContext';
import { CheckoutModal } from '@/components/CheckoutModal';
import { cancelRequest, fetchRequest, sendProposal, updateProposal, type Proposal, type RequestDetail } from '@/lib/api';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none';
const short = (w?: string) => (w ? `${w.slice(0, 6)}...${w.slice(-4)}` : '');

export default function RequestDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { user, isAuthenticated, isLoading: signingIn, signIn } = useAuth();
  const { language } = useLanguage();
  const en = language === 'en';

  const [data, setData] = useState<RequestDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState<Proposal | null>(null);
  const [checkoutService, setCheckoutService] = useState<Service | null>(null);
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const [message, setMessage] = useState('');
  const [usePhases, setUsePhases] = useState(false);
  const [phases, setPhases] = useState([
    { title: '', amountUsdc: '', deliveryDays: '' },
    { title: '', amountUsdc: '', deliveryDays: '' },
  ]);

  const load = useCallback(async () => {
    try {
      const d = await fetchRequest(slug, address);
      setData(d);
      const mine = d.proposals.find((p) => p.sellerId === user?.id);
      if (mine && mine.status === 'PENDING') {
        setPrice(Number(mine.priceUsdc).toFixed(2));
        setDays(String(mine.deliveryDays));
        setMessage(mine.message);
        if (mine.milestones?.length) {
          setUsePhases(true);
          setPhases(mine.milestones.map((m) => ({ title: m.title, amountUsdc: Number(m.amountUsdc).toFixed(2), deliveryDays: String(m.deliveryDays) })));
        }
      }
    } catch (e: any) {
      if (/not found/i.test(e?.message || '')) setNotFound(true);
      else setError(e?.message);
    }
  }, [slug, address, user?.id]);

  useEffect(() => {
    load();
  }, [load, isAuthenticated]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    setNotice(null);
    try {
      setBusy(true);
      await fn();
      setNotice(ok);
      await load();
    } catch (e: any) {
      setError(e?.message || (en ? 'Something went wrong' : 'Algo salió mal'));
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = async (serviceSlug: string) => {
    setError(null);
    const res = await fetch(`/api/services/${serviceSlug}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.service) {
      setError(en ? 'The agreed service could not be loaded.' : 'No se pudo cargar el servicio acordado.');
      return;
    }
    setCheckoutService(body.service);
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-400">
        {en ? 'This request does not exist.' : 'Este pedido no existe.'}{' '}
        <Link href="/requests" className="text-primary-light hover:underline">
          {en ? 'See requests' : 'Ver pedidos'}
        </Link>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">{error || (en ? 'Loading...' : 'Cargando...')}</div>;

  const { request: r, proposals, award } = data;
  const isOwner = !!r.isOwner;
  const mine = proposals.find((p) => p.sellerId === user?.id);
  const accepted = proposals.find((p) => p.id === award?.proposalId);
  const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === r.category);
  const statusLabel = {
    OPEN: en ? 'Open' : 'Abierto',
    AWARDED: en ? 'Awarded' : 'Adjudicado',
    CANCELLED: en ? 'Cancelled' : 'Cancelado',
  }[r.status];
  const proposalStatus = (s: Proposal['status']) =>
    ({
      PENDING: en ? 'Pending' : 'Pendiente',
      ACCEPTED: en ? 'Accepted' : 'Aceptada',
      REJECTED: en ? 'Not selected' : 'No seleccionada',
      WITHDRAWN: en ? 'Withdrawn' : 'Retirada',
    })[s];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/requests" className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 hover:text-white sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        {en ? 'Back to requests' : 'Volver a pedidos'}
      </Link>

      {/* Request */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-400">{cat ? (en ? cat.nameEn || cat.name : cat.name) : r.category}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 font-semibold ${
              r.status === 'OPEN' ? 'bg-accent/10 text-accent' : r.status === 'AWARDED' ? 'bg-primary/15 text-primary-light' : 'bg-slate-700/40 text-slate-400'
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <h1 className="mt-2 break-words text-2xl font-bold text-white">{r.title}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {en ? 'Posted by' : 'Publicado por'} {r.buyer?.displayName || short(r.buyer?.walletAddress)} ·{' '}
          {new Date(r.createdAt).toLocaleDateString(en ? 'en-US' : 'es-ES', { dateStyle: 'medium' })}
        </p>
        <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">{r.description}</p>
        <div className="mt-5 flex flex-wrap gap-6 border-t border-border/80 pt-4 text-sm">
          <span>
            <span className="block text-xs text-slate-500">{en ? 'Max budget' : 'Presupuesto máx.'}</span>
            <span className="font-bold text-white">{Number(r.budgetUsdc).toFixed(2)} USDC</span>
          </span>
          <span>
            <span className="block text-xs text-slate-500">{en ? 'Delivery' : 'Plazo'}</span>
            <span className="inline-flex items-center gap-1 font-bold text-white">
              <Clock className="h-4 w-4" /> {r.deliveryDays} {en ? 'days' : 'días'}
            </span>
          </span>
          <span>
            <span className="block text-xs text-slate-500">{en ? 'Proposals' : 'Propuestas'}</span>
            <span className="inline-flex items-center gap-1 font-bold text-white">
              <MessageSquare className="h-4 w-4" /> {r.proposalCount}
            </span>
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      {/* Awarded: buyer funds the escrow order; the chosen seller waits for it */}
      {award && accepted && (
        <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ShieldCheck className="h-5 w-5 text-accent" /> {en ? 'Accepted proposal' : 'Propuesta aceptada'}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {accepted.seller?.displayName || short(accepted.seller?.walletAddress)} · {Number(accepted.priceUsdc).toFixed(2)} USDC ·{' '}
            {accepted.deliveryDays} {en ? 'days' : 'días'}
          </p>
          <ol className="mt-4 space-y-2">
            {award.phases.map((ph, i) => {
              const previousDone = award.phases.slice(0, i).every((x) => x.order && ['RELEASED', 'RESOLVED'].includes(x.order.status));
              const nextToFund = !ph.order && award.phases.slice(0, i).every((x) => x.order);
              return (
                <li key={ph.serviceSlug} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/60 p-3">
                  <span className="min-w-0 text-sm text-slate-200">
                    {award.phases.length > 1 && (
                      <span className="font-semibold">{en ? `Phase ${ph.index}/${ph.count}` : `Fase ${ph.index}/${ph.count}`} · </span>
                    )}
                    {Number(ph.priceUsdc).toFixed(2)} USDC · {ph.deliveryDays} {en ? 'days' : 'días'}
                    <span className="block text-xs text-slate-400">
                      {ph.order
                        ? `${en ? 'Order' : 'Orden'} #${ph.order.contractOrderId} · ${ph.order.status}`
                        : en
                          ? 'Not funded yet'
                          : 'Sin fondear todavía'}
                    </span>
                  </span>
                  {isOwner && nextToFund && (
                    <span className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => openCheckout(ph.serviceSlug)}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover"
                      >
                        {en ? `Fund ${Number(ph.priceUsdc).toFixed(2)} USDC` : `Fondear ${Number(ph.priceUsdc).toFixed(2)} USDC`}
                      </button>
                      {i > 0 && !previousDone && (
                        <span className="text-[11px] text-amber-400">
                          {en ? 'Tip: approve the previous phase first.' : 'Consejo: aprueba antes la fase anterior.'}
                        </span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-slate-400">
            {isOwner
              ? en
                ? 'Each phase is its own escrow order: the money stays in the contract until you approve that phase or its review period ends.'
                : 'Cada fase es una orden de escrow propia: el dinero queda en el contrato hasta que apruebes esa fase o termine su período de revisión.'
              : en
                ? 'Your proposal was accepted. Start each phase only when it shows as funded.'
                : 'Tu propuesta fue aceptada. Empieza cada fase solo cuando figure como fondeada.'}{' '}
            <Link href="/orders" className="font-semibold text-primary-light hover:underline">
              {en ? 'Follow them in My Orders' : 'Síguelas en Mis Órdenes'}
            </Link>
          </p>
        </div>
      )}

      {/* Buyer: proposals received */}
      {isOwner && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{en ? 'Proposals received' : 'Propuestas recibidas'}</h2>
            {r.status !== 'CANCELLED' && !award?.order && (
              <button
                onClick={() => run(() => cancelRequest(address, r.id), en ? 'Request cancelled.' : 'Pedido cancelado.')}
                disabled={busy}
                className="text-xs font-semibold text-slate-400 hover:text-red-400"
              >
                {en ? 'Cancel request' : 'Cancelar pedido'}
              </button>
            )}
          </div>
          {proposals.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">
              {en ? 'No proposals yet. Share the link of this page to get some.' : 'Aún no hay propuestas. Comparte el enlace de esta página para recibirlas.'}
            </p>
          )}
          <div className="mt-3 space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{p.seller?.displayName || short(p.seller?.walletAddress)}</p>
                    <p className="font-mono text-[11px] text-slate-500">{short(p.seller?.walletAddress)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{Number(p.priceUsdc).toFixed(2)} USDC</p>
                    <p className="text-xs text-slate-400">
                      {p.deliveryDays} {en ? 'days' : 'días'} · {proposalStatus(p.status)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-300">{p.message}</p>
                {p.milestones && p.milestones.length > 0 && (
                  <ol className="mt-3 space-y-1 rounded-xl bg-background/50 p-3 text-xs text-slate-300">
                    {p.milestones.map((m, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words">
                          {i + 1}. {m.title}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {Number(m.amountUsdc).toFixed(2)} USDC · {m.deliveryDays} {en ? 'days' : 'días'}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {r.status === 'OPEN' && p.status === 'PENDING' && (
                  <button
                    onClick={() => setConfirmAccept(p)}
                    disabled={busy}
                    className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent/90"
                  >
                    {en ? 'Accept proposal' : 'Aceptar propuesta'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seller: send or edit a proposal */}
      {!isOwner && r.status === 'OPEN' && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-bold text-white">
            {mine && mine.status === 'PENDING' ? (en ? 'Your proposal' : 'Tu propuesta') : en ? 'Send a proposal' : 'Enviar una propuesta'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {en
              ? 'Only the buyer sees your price. If accepted, you get the price minus the fixed 3% fee when the work is approved.'
              : 'Solo el comprador ve tu precio. Si la aceptan, cobras el precio menos la comisión fija del 3% cuando se apruebe el trabajo.'}
          </p>
          {!isConnected ? (
            <p className="mt-4 text-sm text-amber-400">{en ? 'Connect your wallet to send a proposal.' : 'Conecta tu wallet para enviar una propuesta.'}</p>
          ) : !isAuthenticated ? (
            <button onClick={() => signIn()} disabled={signingIn} className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary-light">
              {en ? 'Sign in with your wallet' : 'Firma la sesión con tu wallet'}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    sendProposal(
                      address,
                      r.id,
                      usePhases
                        ? {
                            message: message.trim(),
                            milestones: phases.map((ph) => ({
                              title: ph.title.trim(),
                              amountUsdc: ph.amountUsdc.trim(),
                              deliveryDays: parseInt(ph.deliveryDays, 10),
                            })),
                          }
                        : { priceUsdc: price.trim(), deliveryDays: parseInt(days, 10), message: message.trim() }
                    ),
                  en ? 'Proposal sent.' : 'Propuesta enviada.'
                );
              }}
              className="mt-4 space-y-4"
            >
              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={usePhases} onChange={(e) => setUsePhases(e.target.checked)} className="mt-1" />
                <span>
                  {en ? 'Split into milestones (paid by phases)' : 'Dividir en hitos (pago por fases)'}
                  <span className="block text-xs text-slate-500">
                    {en
                      ? 'Each phase is funded and approved separately: you only start a phase once its payment is locked in escrow.'
                      : 'Cada fase se fondea y aprueba por separado: solo empiezas una fase cuando su pago ya está bloqueado en el escrow.'}
                  </span>
                </span>
              </label>
              {usePhases ? (
                <div className="space-y-3">
                  {phases.map((ph, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-border/80 p-3 sm:grid-cols-[1fr_8rem_6rem_auto] sm:items-end">
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {en ? `Phase ${i + 1}` : `Fase ${i + 1}`}
                        <input
                          required
                          maxLength={120}
                          value={ph.title}
                          onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                          placeholder={en ? 'What is delivered' : 'Qué se entrega'}
                          className={inputClass}
                        />
                      </label>
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        USDC
                        <input
                          required
                          type="number"
                          min={1}
                          step="0.01"
                          value={ph.amountUsdc}
                          onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, amountUsdc: e.target.value } : x)))}
                          className={inputClass}
                        />
                      </label>
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {en ? 'Days' : 'Días'}
                        <input
                          required
                          type="number"
                          min={1}
                          max={365}
                          step="1"
                          value={ph.deliveryDays}
                          onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, deliveryDays: e.target.value } : x)))}
                          className={inputClass}
                        />
                      </label>
                      {phases.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPhases(phases.filter((_, j) => j !== i))}
                          className="pb-2.5 text-xs font-semibold text-slate-500 hover:text-red-400"
                        >
                          {en ? 'Remove' : 'Quitar'}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    {phases.length < 10 && (
                      <button
                        type="button"
                        onClick={() => setPhases([...phases, { title: '', amountUsdc: '', deliveryDays: '' }])}
                        className="font-semibold text-primary-light hover:underline"
                      >
                        {en ? '+ Add phase' : '+ Añadir fase'}
                      </button>
                    )}
                    <span>
                      Total: {phases.reduce((t, ph) => t + (Number(ph.amountUsdc) || 0), 0).toFixed(2)} USDC ·{' '}
                      {phases.reduce((t, ph) => t + (parseInt(ph.deliveryDays, 10) || 0), 0)} {en ? 'days' : 'días'}
                    </span>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  {en ? 'Your price (USDC)' : 'Tu precio (USDC)'}
                  <input required type="number" min={1} max={10000} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  {en ? 'Delivery (days)' : 'Plazo (días)'}
                  <input required type="number" min={1} max={365} step="1" value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
                </label>
              </div>
              )}
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {en ? 'How you will do it' : 'Cómo lo harás'}
                <textarea required rows={4} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50">
                  {mine && mine.status === 'PENDING' ? (en ? 'Update proposal' : 'Actualizar propuesta') : en ? 'Send proposal' : 'Enviar propuesta'}
                </button>
                {mine && mine.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => updateProposal(address, r.id, mine.id, 'withdraw'), en ? 'Proposal withdrawn.' : 'Propuesta retirada.')}
                    className="text-xs font-semibold text-slate-400 hover:text-red-400"
                  >
                    {en ? 'Withdraw' : 'Retirar'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {!isOwner && mine && mine.status !== 'PENDING' && mine.status !== 'ACCEPTED' && (
        <p className="mt-6 text-sm text-slate-400">
          {en ? 'Your proposal:' : 'Tu propuesta:'} {proposalStatus(mine.status)}
        </p>
      )}

      {/* Accept confirmation */}
      {confirmAccept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-lg font-bold text-white">{en ? 'Accept this proposal?' : '¿Aceptar esta propuesta?'}</h3>
            <p className="mt-2 text-sm text-slate-300">
              {Number(confirmAccept.priceUsdc).toFixed(2)} USDC · {confirmAccept.deliveryDays} {en ? 'days' : 'días'}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {en
                ? 'The other proposals will be declined. Next you fund the escrow with this amount; nothing is charged until you do.'
                : 'Las demás propuestas quedarán rechazadas. Después fondeas el escrow con este monto; no se cobra nada hasta que lo hagas.'}
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmAccept(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white">
                {en ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const p = confirmAccept;
                  setConfirmAccept(null);
                  run(() => updateProposal(address, r.id, p.id, 'accept'), en ? 'Proposal accepted. Now fund the escrow.' : 'Propuesta aceptada. Ahora fondea el escrow.');
                }}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-background hover:bg-accent/90"
              >
                {en ? 'Accept' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutService && (
        <CheckoutModal
          service={checkoutService}
          onClose={() => setCheckoutService(null)}
          onSuccess={() => {
            setCheckoutService(null);
            router.push('/orders');
          }}
        />
      )}
    </div>
  );
}
