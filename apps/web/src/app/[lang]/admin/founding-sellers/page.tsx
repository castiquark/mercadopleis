'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from '@/components/LocaleLink';
import { useAccount } from 'wagmi';
import { Award, Loader2, Trash2 } from 'lucide-react';
import NotFound from '@/app/[lang]/not-found';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Row {
  number: number;
  wallet: string;
  name: string;
  services: number;
}

/** Admin: give or remove the Founding Seller badge (numbers 1–25). */
export default function FoundingSellersAdminPage() {
  const { isConnected } = useAccount();
  const { token, isAdmin, isAuthenticated, isLoading } = useAuth();
  const { L } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [max, setMax] = useState(25);
  const [wallet, setWallet] = useState('');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setMounted(true), []);

  const call = useCallback(
    async (method: string, body?: unknown) => {
      const res = await fetch(`${API_URL}/admin/founding-sellers`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    },
    [token]
  );

  const load = useCallback(async () => {
    try {
      const data = await call('GET');
      setRows(data.sellers);
      setMax(data.max);
    } catch (err: any) {
      setNotice({ ok: false, text: err.message });
    }
  }, [call]);

  useEffect(() => {
    if (isAuthenticated && isAdmin && token) load();
  }, [isAuthenticated, isAdmin, token, load]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ ok: true, text: await fn() });
      await load();
    } catch (err: any) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }
  // Same rule as the disputes panel: anyone who is not a signed-in admin sees a plain 404.
  if (!isConnected || !isAuthenticated || !isAdmin) return <NotFound />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-primary-light">
        <Award className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wider">{L('Administración', 'Administration', 'Administração')}</span>
      </div>
      <h1 className="mt-1 text-3xl font-extrabold text-white">Founding Sellers</h1>
      <p className="mt-1 text-sm text-slate-400">
        {L(
          `Insignia numerada para los primeros ${max} vendedores. Sus servicios aparecen primero en el catálogo. La comisión del contrato no cambia.`,
          `Numbered badge for the first ${max} sellers. Their services are listed first. The contract fee does not change.`,
          `Insígnia numerada para os primeiros ${max} vendedores. Os serviços deles aparecem primeiro no catálogo. A taxa do contrato não muda.`
        )}{' '}
        <Link href="/admin/disputes" className="text-primary-light hover:underline">
          {L('Ir a disputas', 'Go to disputes', 'Ir para disputas')}
        </Link>
      </p>

      <form
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await call('POST', { wallet, number: number || null });
            setWallet('');
            setNumber('');
            return L(`Asignado: Founding Seller #${r.number}.`, `Assigned: Founding Seller #${r.number}.`, `Atribuído: Founding Seller #${r.number}.`);
          });
        }}
      >
        <label className="flex-1 text-xs font-semibold text-slate-400">
          {L('Wallet del vendedor', 'Seller wallet', 'Carteira do vendedor')}
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="0x…"
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="text-xs font-semibold text-slate-400 sm:w-32">
          {L('Número (opcional)', 'Number (optional)', 'Número (opcional)')}
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder={L('siguiente', 'next', 'próximo')}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !wallet}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {L('Asignar', 'Assign', 'Atribuir')}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        {L(
          'La wallet tiene que haber iniciado sesión en el sitio al menos una vez.',
          'The wallet must have signed in on the site at least once.',
          'A carteira precisa ter entrado no site pelo menos uma vez.'
        )}
      </p>

      {notice && (
        <p className={`mt-4 rounded-xl border p-3 text-sm ${notice.ok ? 'border-accent/30 bg-accent/10 text-accent' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {notice.text}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {rows ? `${rows.length} / ${max}` : '…'}
        </div>
        {rows && rows.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400">{L('Todavía no hay Founding Sellers.', 'No Founding Sellers yet.', 'Ainda não há Founding Sellers.')}</p>
        )}
        <ul>
          {rows?.map((r) => (
            <li key={r.number} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-0">
              <div className="min-w-0">
                <p className="font-semibold text-white">
                  #{String(r.number).padStart(3, '0')} · {r.name}
                </p>
                <p className="truncate font-mono text-xs text-slate-400">{r.wallet}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400">
                  {r.services} {L('servicios publicados', 'listed services', 'serviços publicados')}
                </span>
                <button
                  onClick={() =>
                    window.confirm(L(`¿Quitar la insignia #${r.number}?`, `Remove badge #${r.number}?`, `Remover a insígnia #${r.number}?`)) &&
                    run(async () => {
                      await call('DELETE', { wallet: r.wallet });
                      return L('Insignia quitada.', 'Badge removed.', 'Insígnia removida.');
                    })
                  }
                  disabled={busy}
                  title={L('Quitar insignia', 'Remove badge', 'Remover insígnia')}
                  className="rounded-lg p-2 text-slate-400 hover:bg-surface-elevated hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
