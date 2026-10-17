'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { fetchActivity, type ActivitySummary } from '@/lib/api';

const POLL_MS = 60_000;

type Kind = ActivitySummary['items'][number]['kind'];

const LABELS: Record<Kind, { es: (n: number) => string; en: (n: number) => string }> = {
  deliver: { es: () => 'Orden pagada: entrega el trabajo', en: () => 'Paid order: deliver the work' },
  review: { es: () => 'Entrega recibida: revísala y aprueba', en: () => 'Delivery received: review and approve' },
  claim: { es: () => 'Pago disponible para cobrar', en: () => 'Payment ready to claim' },
  dispute: { es: () => 'Orden en disputa', en: () => 'Order in dispute' },
  message: { es: (n) => (n === 1 ? '1 mensaje nuevo' : `${n} mensajes nuevos`), en: (n) => (n === 1 ? '1 new message' : `${n} new messages`) },
  proposals: { es: (n) => (n === 1 ? '1 propuesta por revisar' : `${n} propuestas por revisar`), en: (n) => (n === 1 ? '1 proposal to review' : `${n} proposals to review`) },
  admin_disputes: { es: (n) => (n === 1 ? '1 disputa abierta por resolver' : `${n} disputas abiertas por resolver`), en: (n) => (n === 1 ? '1 open dispute to resolve' : `${n} open disputes to resolve`) },
};

/** Bell in the header with what needs the signed-in user's attention. Polls while the tab is visible. */
export function ActivityMenu() {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const en = language === 'en';
  const pathname = usePathname();
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!token) return setActivity(null);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    setActivity(await fetchActivity(token));
  }, [token]);

  // Refresh on sign-in, on every navigation (e.g. after opening an order) and periodically.
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);
  useEffect(() => {
    if (!token) return;
    const t = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, refresh]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isAuthenticated) return null;
  const total = activity?.total ?? 0;
  const label = en ? 'Activity' : 'Actividad';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        aria-label={total > 0 ? `${label}: ${total}` : label}
        aria-expanded={open}
        title={label}
        className="relative flex items-center rounded-lg border border-border bg-surface p-2.5 text-slate-300 transition hover:bg-surface-elevated hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {en ? 'Needs your attention' : 'Requiere tu atención'}
          </div>
          {activity && activity.items.length > 0 ? (
            <ul className="max-h-[60vh] overflow-y-auto">
              {activity.items.map((item, i) => (
                <li key={`${item.kind}-${item.href}-${i}`}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-border/60 px-4 py-3 text-sm transition last:border-0 hover:bg-surface-elevated"
                  >
                    <span className="block font-medium text-white">{(en ? LABELS[item.kind].en : LABELS[item.kind].es)(item.count)}</span>
                    {item.title && <span className="mt-0.5 block truncate text-xs text-slate-400">{item.title}</span>}
                    {item.contractOrderId != null && (
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {en ? 'Order' : 'Orden'} #{item.contractOrderId} · {item.chainId === 84532 ? 'Base Sepolia' : 'Base Mainnet'}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">{en ? "You're all caught up." : 'No tienes nada pendiente.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
