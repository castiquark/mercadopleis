'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import type { LegalDocumentContent } from '@/lib/legalContent';

interface LegalDocumentProps {
  content: Record<'es' | 'en', LegalDocumentContent>;
}

export function LegalDocument({ content }: LegalDocumentProps) {
  const { language } = useLanguage();
  const doc = content[language === 'en' ? 'en' : 'es'];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 transition hover:text-white sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{language === 'en' ? 'Back to Catalog' : 'Volver al Catálogo'}</span>
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold text-white">{doc.title}</h1>
      <p className="mt-1 text-xs text-slate-500">{doc.updatedLabel}</p>
      <p className="mt-6 text-sm leading-relaxed text-slate-300">{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-lg font-bold text-white">{section.title}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 break-words text-sm leading-relaxed text-slate-300">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
