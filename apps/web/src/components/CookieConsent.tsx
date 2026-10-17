'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/languageContext';
import { CONSENT_REOPEN_EVENT, readConsent, saveConsent } from '@/lib/consent';

export function CookieConsent() {
  const { L } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
    const reopen = () => setVisible(true);
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const choose = (choice: 'granted' | 'denied') => {
    saveConsent(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label={L('Preferencias de cookies', 'Cookie preferences', 'Preferências de cookies')}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
          {L('Usamos almacenamiento esencial para mantener tu sesión y analítica opcional (Google Analytics) para mejorar el sitio. La analítica solo se activa si aceptas. ', 'We use essential storage to keep you signed in, and optional analytics (Google Analytics) to improve the site. Analytics only runs if you accept. ', 'Usamos armazenamento essencial para manter sua sessão e análise opcional (Google Analytics) para melhorar o site. A análise só é ativada se você aceitar. ')}
          <Link href="/privacy" className="font-semibold text-primary-light underline">
            {L('Política de privacidad', 'Privacy policy', 'Política de privacidade')}
          </Link>
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="min-h-10 rounded-xl border border-border bg-surface-elevated px-5 py-2 text-sm font-semibold text-slate-200 transition hover:text-white"
          >
            {L('Rechazar', 'Reject', 'Recusar')}
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="min-h-10 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            {L('Aceptar', 'Accept', 'Aceitar')}
          </button>
        </div>
      </div>
    </div>
  );
}
