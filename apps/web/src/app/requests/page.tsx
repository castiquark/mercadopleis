'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MARKETPLACE_CATEGORIES } from '@mercadopleis/types';
import { ClipboardList, Clock, MessageSquare, Plus, Search } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { CategoryPills } from '@/components/CategoryPills';
import { fetchRequests, type RequestSummary } from '@/lib/api';

export default function RequestsPage() {
  const { language } = useLanguage();
  const en = language === 'en';
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [list, setList] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests({ category: category || undefined, search: search.trim() || undefined })
        .then((r) => {
          setList(r);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [category, search]);

  const catLabel = (id: string) => {
    const c = MARKETPLACE_CATEGORIES.find((x) => x.id === id);
    return c ? (en ? c.nameEn || c.name : c.name) : id;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-white">{en ? 'Requests' : 'Pedidos'}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {en
              ? 'Tasks posted by people and AI agents. Send a proposal with your price and delivery time; if it is accepted, the payment is locked in escrow before you start.'
              : 'Tareas publicadas por personas y agentes de IA. Envía una propuesta con tu precio y plazo; si la aceptan, el pago queda bloqueado en el escrow antes de que empieces.'}
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          {en ? 'Post a request' : 'Publicar un pedido'}
        </Link>
      </div>

      <div className="mt-6 flex max-w-xl items-center rounded-xl border border-border bg-background/90 p-1.5 focus-within:border-primary">
        <Search className="ml-3 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={en ? 'Search requests...' : 'Buscar pedidos...'}
          aria-label={en ? 'Search requests' : 'Buscar pedidos'}
          className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      <CategoryPills selectedCategory={category} onSelectCategory={setCategory} />

      {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

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
                <span className="block text-[11px] text-slate-500">{en ? 'max budget' : 'presupuesto máx.'}</span>
              </span>
            </div>
            <h2 className="mt-1 break-words text-base font-bold text-white">{r.title}</h2>
            <p className="mt-1 line-clamp-2 break-words text-sm text-slate-400">{r.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {r.deliveryDays} {en ? (r.deliveryDays === 1 ? 'day' : 'days') : r.deliveryDays === 1 ? 'día' : 'días'}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {r.proposalCount} {en ? (r.proposalCount === 1 ? 'proposal' : 'proposals') : r.proposalCount === 1 ? 'propuesta' : 'propuestas'}
              </span>
              <span>{new Date(r.createdAt).toLocaleDateString(en ? 'en-US' : 'es-ES', { dateStyle: 'medium' })}</span>
            </div>
          </Link>
        ))}
      </div>

      {list && list.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border/80 p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-lg font-bold text-white">{en ? 'No open requests yet' : 'Aún no hay pedidos abiertos'}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {en
              ? 'Need something that is not in the catalog? Describe it and set your budget.'
              : '¿Necesitas algo que no está en el catálogo? Descríbelo y define tu presupuesto.'}
          </p>
          <Link href="/requests/new" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-light hover:underline">
            {en ? 'Post the first request' : 'Publicar el primer pedido'}
          </Link>
        </div>
      )}
    </div>
  );
}
