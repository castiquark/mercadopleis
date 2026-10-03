'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { MARKETPLACE_CATEGORIES } from '@mercadopleis/types';
import { AlertCircle, ArrowLeft, ClipboardList } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { useAuth } from '@/lib/authContext';
import { createRequest } from '@/lib/api';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none';

export default function NewRequestPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const { language } = useLanguage();
  const en = language === 'en';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ai_data');
  const [budget, setBudget] = useState('30');
  const [days, setDays] = useState('3');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      const { request } = await createRequest(address, {
        title: title.trim(),
        description: description.trim(),
        category,
        budgetUsdc: budget.trim(),
        deliveryDays: parseInt(days, 10),
      });
      router.push(`/requests/${request.slug}`);
    } catch (err: any) {
      setError(err?.message || (en ? 'The request could not be posted.' : 'No se pudo publicar el pedido.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/requests" className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 hover:text-white sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        {en ? 'Back to requests' : 'Volver a pedidos'}
      </Link>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2 text-primary-light">
          <ClipboardList className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">{en ? 'New request' : 'Nuevo pedido'}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">{en ? 'Describe what you need' : 'Describe lo que necesitas'}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {en
            ? 'People send proposals with their price and delivery time. You only pay when you accept one, and the money stays in escrow until you approve the work. 0% fee for the buyer.'
            : 'Las personas envían propuestas con su precio y plazo. Solo pagas al aceptar una, y el dinero queda en el escrow hasta que apruebas el trabajo. 0% de comisión para el comprador.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
            {en ? 'Title' : 'Título'}
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={en ? 'Label 500 support tickets by sentiment' : 'Etiquetar 500 tickets de soporte por sentimiento'}
              className={inputClass}
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
            {en ? 'What exactly do you need?' : '¿Qué necesitas exactamente?'}
            <textarea
              required
              rows={6}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                en
                  ? 'Input you will provide, expected output and format, quality criteria. Do not include passwords or private data: the request is public.'
                  : 'Qué material entregas, qué resultado esperas y en qué formato, criterios de calidad. No incluyas contraseñas ni datos privados: el pedido es público.'
              }
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
              {en ? 'Category' : 'Categoría'}
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {en ? c.nameEn || c.name : c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
              {en ? 'Max budget (USDC)' : 'Presupuesto máx. (USDC)'}
              <input required type="number" min={1} max={10000} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
              {en ? 'Delivery (days)' : 'Plazo (días)'}
              <input required type="number" min={1} max={365} step="1" value={days} onChange={(e) => setDays(e.target.value)} className={inputClass} />
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isConnected ? (
            <p className="text-sm text-amber-400">{en ? 'Connect your wallet to post a request.' : 'Conecta tu wallet para publicar un pedido.'}</p>
          ) : !isAuthenticated ? (
            <button
              type="button"
              onClick={() => signIn()}
              disabled={isLoading}
              className="w-full rounded-xl border border-primary/40 bg-primary/10 py-3 text-sm font-semibold text-primary-light hover:bg-primary/20"
            >
              {isLoading ? (en ? 'Signing...' : 'Firmando...') : en ? 'Sign in with your wallet to post' : 'Firma la sesión con tu wallet para publicar'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? (en ? 'Posting...' : 'Publicando...') : en ? 'Post request' : 'Publicar pedido'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
