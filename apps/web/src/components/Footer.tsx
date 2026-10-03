'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/languageContext';
import { reopenConsent } from '@/lib/consent';

export function Footer() {
  const { t, language } = useLanguage();
  const en = language === 'en';
  const linkClass = 'inline-flex min-h-10 items-center px-2 text-slate-400 transition hover:text-white sm:min-h-0';

  return (
    <footer className="border-t border-border bg-surface/50 py-8 text-center text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4">
        <nav aria-label={en ? 'Site' : 'Sitio'} className="mb-3 flex flex-wrap items-center justify-center gap-x-2">
          <Link href="/requests" className={linkClass}>
            {t('requests')}
          </Link>
          <Link href="/services/new" className={linkClass}>
            {t('postService')}
          </Link>
          <Link href="/terms" className={linkClass}>
            {en ? 'Terms' : 'Términos'}
          </Link>
          <Link href="/privacy" className={linkClass}>
            {en ? 'Privacy' : 'Privacidad'}
          </Link>
          <button type="button" onClick={reopenConsent} className={linkClass}>
            {en ? 'Cookie settings' : 'Configuración de cookies'}
          </button>
          <a href="mailto:hello@mercadopleis.club" className={linkClass}>
            hello@mercadopleis.club
          </a>
        </nav>
        <p>© {new Date().getFullYear()} {t('footerCopyright')}</p>
        <p className="mt-1 text-slate-600">{t('footerTagline')}</p>
      </div>
    </footer>
  );
}
