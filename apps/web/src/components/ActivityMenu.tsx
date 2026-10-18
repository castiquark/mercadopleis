'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { fetchActivity, markNotificationsRead, type ActivitySummary } from '@/lib/api';
import { notifyText } from '@/lib/notify/messages';

const POLL_MS = 60_000;

type Kind = ActivitySummary['items'][number]['kind'];

const LABELS: Record<Kind, { es: (n: number) => string; en: (n: number) => string; pt: (n: number) => string }> = {
  deliver: { es: () => 'Orden pagada: entrega el trabajo', en: () => 'Paid order: deliver the work', pt: () => 'Pedido pago: entregue o trabalho' },
  review: { es: () => 'Entrega recibida: revísala y aprueba', en: () => 'Delivery received: review and approve', pt: () => 'Entrega recebida: revise e aprove' },
  claim: { es: () => 'Pago disponible para cobrar', en: () => 'Payment ready to claim', pt: () => 'Pagamento disponível para receber' },
  dispute: { es: () => 'Orden en disputa', en: () => 'Order in dispute', pt: () => 'Pedido em disputa' },
  message: { es: (n) => (n === 1 ? '1 mensaje nuevo' : `${n} mensajes nuevos`), en: (n) => (n === 1 ? '1 new message' : `${n} new messages`), pt: (n) => (n === 1 ? '1 nova mensagem' : `${n} novas mensagens`) },
  proposals: { es: (n) => (n === 1 ? '1 propuesta por revisar' : `${n} propuestas por revisar`), en: (n) => (n === 1 ? '1 proposal to review' : `${n} proposals to review`), pt: (n) => (n === 1 ? '1 proposta para revisar' : `${n} propostas para revisar`) },
  admin_disputes: { es: (n) => (n === 1 ? '1 disputa abierta por resolver' : `${n} disputas abiertas por resolver`), en: (n) => (n === 1 ? '1 open dispute to resolve' : `${n} open disputes to resolve`), pt: (n) => (n === 1 ? '1 disputa aberta para resolver' : `${n} disputas abertas para resolver`) },
};

function timeAgo(iso: string, lang: 'es' | 'en' | 'pt') {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === 'pt' ? 'pt-BR' : lang, { numeric: 'auto' });
  if (s < 60) return rtf.format(0, 'second');
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
  return rtf.format(-Math.floor(s / 86400), 'day');
}

/** Bell in the header with what needs the signed-in user's attention and the latest notifications. Polls while the
 * tab is visible; opening it marks the notifications as read (the unread ones keep their dot until it closes). */
export function ActivityMenu() {
  const { token, isAuthenticated } = useAuth();
  const { language, L } = useLanguage();
  const pathname = usePathname();
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
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
  const label = L('Actividad', 'Activity', 'Atividade');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (open) return;
          refresh();
          const unread = (activity?.notifications ?? []).filter((n) => !n.read).map((n) => n.id);
          setHighlight(new Set(unread));
          if (token && (activity?.unreadNotifications ?? 0) > 0) {
            markNotificationsRead(token);
            setActivity((a) =>
              a ? { ...a, total: a.total - (a.unreadNotifications ?? 0), unreadNotifications: 0, notifications: a.notifications?.map((n) => ({ ...n, read: true })) } : a
            );
          }
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
        <div className="absolute right-0 z-50 mt-2 max-h-[75vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
          <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {L('Requiere tu atención', 'Needs your attention', 'Precisa da sua atenção')}
          </div>
          {activity && activity.items.length > 0 ? (
            <ul>
              {activity.items.map((item, i) => (
                <li key={`${item.kind}-${item.href}-${i}`}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-border/60 px-4 py-3 text-sm transition last:border-0 hover:bg-surface-elevated"
                  >
                    <span className="block font-medium text-white">{LABELS[item.kind][language](item.count)}</span>
                    {item.title && <span className="mt-0.5 block truncate text-xs text-slate-400">{item.title}</span>}
                    {item.contractOrderId != null && (
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {L('Orden', 'Order', 'Pedido')} #{item.contractOrderId} · {item.chainId === 84532 ? 'Base Sepolia' : 'Base Mainnet'}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">{L('No tienes nada pendiente.', "You're all caught up.", 'Você não tem nada pendente.')}</p>
          )}
          {activity?.notifications && activity.notifications.length > 0 && (
            <>
              <div className="border-y border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {L('Avisos recientes', 'Recent notifications', 'Avisos recentes')}
              </div>
              <ul>
                {activity.notifications.map((n) => {
                  const text = notifyText(n.event, language);
                  const isNew = highlight.has(n.id);
                  return (
                    <li key={n.id}>
                      <Link
                        href={text.path}
                        onClick={() => setOpen(false)}
                        className="flex gap-2.5 border-b border-border/60 px-4 py-3 text-sm transition last:border-0 hover:bg-surface-elevated"
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew ? 'bg-primary-light' : 'bg-transparent'}`} aria-hidden />
                        <span className="min-w-0">
                          <span className={`block ${isNew ? 'font-semibold text-white' : 'font-medium text-slate-200'}`}>{text.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{text.body}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{timeAgo(n.createdAt, language)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
