'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { MARKETPLACE_CATEGORIES, type Service, categoryLabel as categoryLabel_ } from '@mercadopleis/types';
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
  const { language, L } = useLanguage();

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
      setError(e?.message || (L('Algo salió mal', 'Something went wrong', 'Algo deu errado')));
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = async (serviceSlug: string) => {
    setError(null);
    const res = await fetch(`/api/services/${serviceSlug}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.service) {
      setError(L('No se pudo cargar el servicio acordado.', 'The agreed service could not be loaded.', 'Não foi possível carregar o serviço combinado.'));
      return;
    }
    setCheckoutService(body.service);
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-400">
        {L('Este pedido no existe.', 'This request does not exist.', 'Esta solicitação não existe.')}{' '}
        <Link href="/requests" className="text-primary-light hover:underline">
          {L('Ver pedidos', 'See requests', 'Ver solicitações')}
        </Link>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">{error || (L('Cargando...', 'Loading...', 'Carregando...'))}</div>;

  const { request: r, proposals, award } = data;
  const isOwner = !!r.isOwner;
  const mine = proposals.find((p) => p.sellerId === user?.id);
  const accepted = proposals.find((p) => p.id === award?.proposalId);
  const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === r.category);
  const statusLabel = {
    OPEN: L('Abierto', 'Open', 'Aberto'),
    AWARDED: L('Adjudicado', 'Awarded', 'Adjudicado'),
    CANCELLED: L('Cancelado', 'Cancelled', 'Cancelado'),
  }[r.status];
  const proposalStatus = (s: Proposal['status']) =>
    ({
      PENDING: L('Pendiente', 'Pending', 'Pendente'),
      ACCEPTED: L('Aceptada', 'Accepted', 'Aceita'),
      REJECTED: L('No seleccionada', 'Not selected', 'Não selecionada'),
      WITHDRAWN: L('Retirada', 'Withdrawn', 'Retirada'),
    })[s];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/requests" className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 hover:text-white sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        {L('Volver a pedidos', 'Back to requests', 'Voltar às solicitações')}
      </Link>

      {/* Request */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-400">{cat ? categoryLabel_(cat, language) : r.category}</span>
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
          {L('Publicado por', 'Posted by', 'Publicado por')} {r.buyer?.displayName || short(r.buyer?.walletAddress)} ·{' '}
          {new Date(r.createdAt).toLocaleDateString(L('es-ES', 'en-US', 'pt-BR'), { dateStyle: 'medium' })}
        </p>
        <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">{r.description}</p>
        <div className="mt-5 flex flex-wrap gap-6 border-t border-border/80 pt-4 text-sm">
          <span>
            <span className="block text-xs text-slate-500">{L('Presupuesto máx.', 'Max budget', 'Orçamento máx.')}</span>
            <span className="font-bold text-white">{Number(r.budgetUsdc).toFixed(2)} USDC</span>
          </span>
          <span>
            <span className="block text-xs text-slate-500">{L('Plazo', 'Delivery', 'Prazo')}</span>
            <span className="inline-flex items-center gap-1 font-bold text-white">
              <Clock className="h-4 w-4" /> {r.deliveryDays} {L('días', 'days', 'dias')}
            </span>
          </span>
          <span>
            <span className="block text-xs text-slate-500">{L('Propuestas', 'Proposals', 'Propostas')}</span>
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
            <ShieldCheck className="h-5 w-5 text-accent" /> {L('Propuesta aceptada', 'Accepted proposal', 'Proposta aceita')}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {accepted.seller?.displayName || short(accepted.seller?.walletAddress)} · {Number(accepted.priceUsdc).toFixed(2)} USDC ·{' '}
            {accepted.deliveryDays} {L('días', 'days', 'dias')}
          </p>
          <ol className="mt-4 space-y-2">
            {award.phases.map((ph, i) => {
              const previousDone = award.phases.slice(0, i).every((x) => x.order && ['RELEASED', 'RESOLVED'].includes(x.order.status));
              const nextToFund = !ph.order && award.phases.slice(0, i).every((x) => x.order);
              return (
                <li key={ph.serviceSlug} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/60 p-3">
                  <span className="min-w-0 text-sm text-slate-200">
                    {award.phases.length > 1 && (
                      <span className="font-semibold">{L(`Fase ${ph.index}/${ph.count}`, `Phase ${ph.index}/${ph.count}`, `Etapa ${ph.index}/${ph.count}`)} · </span>
                    )}
                    {Number(ph.priceUsdc).toFixed(2)} USDC · {ph.deliveryDays} {L('días', 'days', 'dias')}
                    <span className="block text-xs text-slate-400">
                      {ph.order
                        ? `${L('Orden', 'Order', 'Pedido')} #${ph.order.contractOrderId} · ${ph.order.status}`
                        : L('Sin fondear todavía', 'Not funded yet', 'Ainda sem depósito')}
                    </span>
                  </span>
                  {isOwner && nextToFund && (
                    <span className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => openCheckout(ph.serviceSlug)}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover"
                      >
                        {L(`Fondear ${Number(ph.priceUsdc).toFixed(2)} USDC`, `Fund ${Number(ph.priceUsdc).toFixed(2)} USDC`, `Depositar ${Number(ph.priceUsdc).toFixed(2)} USDC`)}
                      </button>
                      {i > 0 && !previousDone && (
                        <span className="text-[11px] text-amber-400">
                          {L('Consejo: aprueba antes la fase anterior.', 'Tip: approve the previous phase first.', 'Dica: aprove antes a etapa anterior.')}
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
              ? L('Cada fase es una orden de escrow propia: el dinero queda en el contrato hasta que apruebes esa fase o termine su período de revisión.', 'Each phase is its own escrow order: the money stays in the contract until you approve that phase or its review period ends.', 'Cada etapa é um pedido de escrow próprio: o dinheiro fica no contrato até você aprovar a etapa ou terminar o período de revisão.')
              : L('Tu propuesta fue aceptada. Empieza cada fase solo cuando figure como fondeada.', 'Your proposal was accepted. Start each phase only when it shows as funded.', 'Sua proposta foi aceita. Comece cada etapa só quando ela aparecer com depósito feito.')}{' '}
            <Link href="/orders" className="font-semibold text-primary-light hover:underline">
              {L('Síguelas en Mis Órdenes', 'Follow them in My Orders', 'Acompanhe em Meus Pedidos')}
            </Link>
          </p>
        </div>
      )}

      {/* Buyer: proposals received */}
      {isOwner && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{L('Propuestas recibidas', 'Proposals received', 'Propostas recebidas')}</h2>
            {r.status !== 'CANCELLED' && !award?.order && (
              <button
                onClick={() => run(() => cancelRequest(address, r.id), L('Pedido cancelado.', 'Request cancelled.', 'Solicitação cancelada.'))}
                disabled={busy}
                className="text-xs font-semibold text-slate-400 hover:text-red-400"
              >
                {L('Cancelar pedido', 'Cancel request', 'Cancelar solicitação')}
              </button>
            )}
          </div>
          {proposals.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">
              {L('Aún no hay propuestas. Comparte el enlace de esta página para recibirlas.', 'No proposals yet. Share the link of this page to get some.', 'Ainda não há propostas. Compartilhe o link desta página para receber.')}
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
                      {p.deliveryDays} {L('días', 'days', 'dias')} · {proposalStatus(p.status)}
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
                          {Number(m.amountUsdc).toFixed(2)} USDC · {m.deliveryDays} {L('días', 'days', 'dias')}
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
                    {L('Aceptar propuesta', 'Accept proposal', 'Aceitar proposta')}
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
            {mine && mine.status === 'PENDING' ? (L('Tu propuesta', 'Your proposal', 'Sua proposta')) : L('Enviar una propuesta', 'Send a proposal', 'Enviar uma proposta')}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {L('Solo el comprador ve tu precio. Si la aceptan, cobras el precio menos la comisión fija del 3% cuando se apruebe el trabajo.', 'Only the buyer sees your price. If accepted, you get the price minus the fixed 3% fee when the work is approved.', 'Só o comprador vê seu preço. Se for aceita, você recebe o preço menos a taxa fixa de 3% quando o trabalho for aprovado.')}
          </p>
          {!isConnected ? (
            <p className="mt-4 text-sm text-amber-400">{L('Conecta tu wallet para enviar una propuesta.', 'Connect your wallet to send a proposal.', 'Conecte sua carteira para enviar uma proposta.')}</p>
          ) : !isAuthenticated ? (
            <button onClick={() => signIn()} disabled={signingIn} className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary-light">
              {L('Firma la sesión con tu wallet', 'Sign in with your wallet', 'Entre com sua carteira')}
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
                  L('Propuesta enviada.', 'Proposal sent.', 'Proposta enviada.')
                );
              }}
              className="mt-4 space-y-4"
            >
              <label className="flex items-start gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={usePhases} onChange={(e) => setUsePhases(e.target.checked)} className="mt-1" />
                <span>
                  {L('Dividir en hitos (pago por fases)', 'Split into milestones (paid by phases)', 'Dividir em etapas (pagamento por fases)')}
                  <span className="block text-xs text-slate-500">
                    {L('Cada fase se fondea y aprueba por separado: solo empiezas una fase cuando su pago ya está bloqueado en el escrow.', 'Each phase is funded and approved separately: you only start a phase once its payment is locked in escrow.', 'Cada etapa é depositada e aprovada separadamente: você só começa uma etapa quando o pagamento dela já está bloqueado no escrow.')}
                  </span>
                </span>
              </label>
              {usePhases ? (
                <div className="space-y-3">
                  {phases.map((ph, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-border/80 p-3 sm:grid-cols-[1fr_8rem_6rem_auto] sm:items-end">
                      <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {L(`Fase ${i + 1}`, `Phase ${i + 1}`, `Etapa ${i + 1}`)}
                        <input
                          required
                          maxLength={120}
                          value={ph.title}
                          onChange={(e) => setPhases(phases.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                          placeholder={L('Qué se entrega', 'What is delivered', 'O que será entregue')}
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
                        {L('Días', 'Days', 'Dias')}
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
                          {L('Quitar', 'Remove', 'Remover')}
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
                        {L('+ Añadir fase', '+ Add phase', '+ Adicionar etapa')}
                      </button>
                    )}
                    <span>
                      Total: {phases.reduce((t, ph) => t + (Number(ph.amountUsdc) || 0), 0).toFixed(2)} USDC ·{' '}
                      {phases.reduce((t, ph) => t + (parseInt(ph.deliveryDays, 10) || 0), 0)} {L('días', 'days', 'dias')}
                    </span>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  {L('Tu precio (USDC)', 'Your price (USDC)', 'Seu preço (USDC)')}
                  <input required type="number" min={1} max={10000} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                  {L('Plazo (días)', 'Delivery (days)', 'Prazo (dias)')}
                  <input required type="number" min={1} max={365} step="1" value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
                </label>
              </div>
              )}
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {L('Cómo lo harás', 'How you will do it', 'Como você vai fazer')}
                <textarea required rows={4} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50">
                  {mine && mine.status === 'PENDING' ? (L('Actualizar propuesta', 'Update proposal', 'Atualizar proposta')) : L('Enviar propuesta', 'Send proposal', 'Enviar proposta')}
                </button>
                {mine && mine.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => updateProposal(address, r.id, mine.id, 'withdraw'), L('Propuesta retirada.', 'Proposal withdrawn.', 'Proposta retirada.'))}
                    className="text-xs font-semibold text-slate-400 hover:text-red-400"
                  >
                    {L('Retirar', 'Withdraw', 'Retirar')}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {!isOwner && mine && mine.status !== 'PENDING' && mine.status !== 'ACCEPTED' && (
        <p className="mt-6 text-sm text-slate-400">
          {L('Tu propuesta:', 'Your proposal:', 'Sua proposta:')} {proposalStatus(mine.status)}
        </p>
      )}

      {/* Accept confirmation */}
      {confirmAccept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-lg font-bold text-white">{L('¿Aceptar esta propuesta?', 'Accept this proposal?', 'Aceitar esta proposta?')}</h3>
            <p className="mt-2 text-sm text-slate-300">
              {Number(confirmAccept.priceUsdc).toFixed(2)} USDC · {confirmAccept.deliveryDays} {L('días', 'days', 'dias')}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {L('Las demás propuestas quedarán rechazadas. Después fondeas el escrow con este monto; no se cobra nada hasta que lo hagas.', 'The other proposals will be declined. Next you fund the escrow with this amount; nothing is charged until you do.', 'As outras propostas serão recusadas. Depois você deposita este valor no escrow; nada é cobrado até você fazer isso.')}
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmAccept(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white">
                {L('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const p = confirmAccept;
                  setConfirmAccept(null);
                  run(() => updateProposal(address, r.id, p.id, 'accept'), L('Propuesta aceptada. Ahora fondea el escrow.', 'Proposal accepted. Now fund the escrow.', 'Proposta aceita. Agora deposite no escrow.'));
                }}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-background hover:bg-accent/90"
              >
                {L('Aceptar', 'Accept', 'Aceitar')}
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
