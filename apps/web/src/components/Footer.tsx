'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/languageContext';
import { reopenConsent } from '@/lib/consent';

export function Footer() {
  const { t, L } = useLanguage();
  const linkClass = 'inline-flex min-h-10 items-center px-2 text-slate-400 transition hover:text-white sm:min-h-0';

  return (
    <footer className="border-t border-border bg-surface/50 py-8 text-center text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4">
        <nav aria-label={L('Sitio', 'Site', 'Site')} className="mb-3 flex flex-wrap items-center justify-center gap-x-2">
          <Link href="/requests" className={linkClass}>
            {t('requests')}
          </Link>
          <Link href="/services/new" className={linkClass}>
            {t('postService')}
          </Link>
          <Link href="/mcp-server" className={linkClass}>
            MCP
          </Link>
          <Link href="/stats" className={linkClass}>
            {L('Operación 100', 'Operation 100', 'Operação 100')}
          </Link>
          <Link href="/terms" className={linkClass}>
            {L('Términos', 'Terms', 'Termos')}
          </Link>
          <Link href="/privacy" className={linkClass}>
            {L('Privacidad', 'Privacy', 'Privacidade')}
          </Link>
          <button type="button" onClick={reopenConsent} className={linkClass}>
            {L('Configuración de cookies', 'Cookie settings', 'Configurações de cookies')}
          </button>
          <a href="mailto:hello@mercadopleis.club" className={linkClass}>
            hello@mercadopleis.club
          </a>
          <a href="https://x.com/Mercadopleis" target="_blank" rel="noopener noreferrer me" className={linkClass} aria-label="Mercadopleis on X">
            X @Mercadopleis
          </a>
          <a href="https://www.linkedin.com/company/mercadopleis" target="_blank" rel="noopener noreferrer me" className={linkClass} aria-label="Mercadopleis on LinkedIn">
            LinkedIn
          </a>
          <a href="https://t.me/mercadopleis" target="_blank" rel="noopener noreferrer me" className={linkClass} aria-label="Mercadopleis channel on Telegram">
            Telegram
          </a>
        </nav>
        <p>© {new Date().getFullYear()} {t('footerCopyright')}</p>
        <p className="mt-1 text-slate-600">{t('footerTagline')}</p>
      </div>
    </footer>
  );
}
