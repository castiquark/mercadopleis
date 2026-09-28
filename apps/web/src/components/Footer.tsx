'use client';

import React from 'react';
import { useLanguage } from '@/lib/languageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-surface/50 py-8 text-center text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4">
        <p>© {new Date().getFullYear()} {t('footerCopyright')}</p>
        <p className="mt-1 text-slate-600">{t('footerTagline')}</p>
      </div>
    </footer>
  );
}
