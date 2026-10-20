'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MARKETPLACE_CATEGORIES, categoryLabel as categoryLabel_ } from '@mercadopleis/types';
import { ClipboardList, Clock, MessageSquare, Plus, Search } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { CategoryPills } from '@/components/CategoryPills';
import { fetchRequests, type RequestSummary } from '@/lib/api';

/**
 * `initialRequests` are the open requests from the server render (in the HTML for crawlers); null when the server
 * could not read them. A failed load never shows the raw API error: it keeps the list it has or offers a retry.
 */
export default function RequestsPage({ initialRequests = null }: { initialRequests?: RequestSummary[] | null }) {
  const { language, L } = useLanguage();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [list, setList] = useState<RequestSummary[] | null>(initialRequests);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests({ category: category || undefined, search: search.trim() || undefined })
        .then((r) => {
          setList(r);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    }, 250);
    return () => clearTimeout(timer);
  }, [category, search, reloadKey]);

  const catLabel = (id: string) => {
    const c = MARKETPLACE_CATEGORIES.find((x) => x.id === id);
    return c ? categoryLabel_(c, language) : id;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-white">{L('Solicitudes', 'Requests', 'Solicitações')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {L('Tareas publicadas por personas y agentes de IA. Envía una propuesta con tu precio y plazo; si la aceptan, el pago queda bloqueado en el escrow antes de que empieces.', 'Tasks posted by people and AI agents. Send a proposal with your price and delivery time; if it is accepted, the payment is locked in escrow before you start.', 'Tarefas publicadas por pessoas e agentes de IA. Envie uma proposta com seu preço e prazo; se for aceita, o pagamento fica bloqueado no escrow antes de você começar.')}
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          {L('Publicar una solicitud', 'Post a request', 'Publicar uma solicitação')}
        </Link>
      </div>

      <div className="mt-6 flex max-w-xl items-center rounded-xl border border-border bg-background/90 p-1.5 focus-within:border-primary">
        <Search className="ml-3 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={L('Buscar solicitudes...', 'Search requests...', 'Buscar solicitações...')}
          aria-label={L('Buscar solicitudes', 'Search requests', 'Buscar solicitações')}
          className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      <CategoryPills selectedCategory={category} onSelectCategory={setCategory} />

      {!failed && !list && (
        <p className="mt-6 text-center text-sm text-slate-500" role="status">{L('Cargando solicitudes…', 'Loading requests…', 'Carregando solicitações…')}</p>
      )}

      {failed && !list && (
        <div className="mt-6 rounded-xl border border-dashed border-amber-500/40 p-8 text-center text-slate-300" role="alert">
          <p className="font-semibold">{L('No pudimos cargar las solicitudes', "We couldn't load the requests", 'Não conseguimos carregar as solicitações')}</p>
          <p className="mt-1 text-xs text-slate-400">
            {L('Es un problema temporal de conexión. Vuelve a intentarlo en unos segundos.', "It's a temporary connection problem. Try again in a few seconds.", 'É um problema temporário de conexão. Tente de novo em alguns segundos.')}
          </p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            {L('Reintentar', 'Try again', 'Tentar de novo')}
          </button>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        {list?.map((r) => (
          <Link
            key={r.id}
            href={`/requests/${r.slug}`}
            className="min-w-0 rounded-2xl border border-border bg-surface p-5 transition hover:border-slate-600"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{catLabel(r.category)}</span>
              <span className="shrink-0 text-right">
                <span className="text-lg font-extrabold text-white">{Number(r.budgetUsdc).toFixed(2)}</span>{' '}
                <span className="text-xs font-semibold text-usdc">USDC</span>
                <span className="block text-[11px] text-slate-500">{L('presupuesto máx.', 'max budget', 'orçamento máx.')}</span>
              </span>
            </div>
            <h2 className="mt-1 break-words text-base font-bold text-white">{r.title}</h2>
            <p className="mt-1 line-clamp-2 break-words text-sm text-slate-400">{r.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {r.deliveryDays} {r.deliveryDays === 1 ? L('día', 'day', 'dia') : L('días', 'days', 'dias')}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {r.proposalCount} {r.proposalCount === 1 ? L('propuesta', 'proposal', 'proposta') : L('propuestas', 'proposals', 'propostas')}
              </span>
              <span>{new Date(r.createdAt).toLocaleDateString(L('es-ES', 'en-US', 'pt-BR'), { dateStyle: 'medium' })}</span>
            </div>
          </Link>
        ))}
      </div>

      {list && list.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border/80 p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-lg font-bold text-white">{L('Aún no hay pedidos abiertos', 'No open requests yet', 'Ainda não há solicitações abertas')}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {L('¿Necesitas algo que no está en el catálogo? Descríbelo y define tu presupuesto.', 'Need something that is not in the catalog? Describe it and set your budget.', 'Precisa de algo que não está no catálogo? Descreva e defina seu orçamento.')}
          </p>
          <Link href="/requests/new" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-light hover:underline">
            {L('Publicar el primer pedido', 'Post the first request', 'Publicar a primeira solicitação')}
          </Link>
        </div>
      )}
    </div>
  );
}
