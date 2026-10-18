'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

/** "Founding Seller #003": one of the first 25 sellers, assigned by the operator. Renders nothing without a number. */
export function FoundingBadge({ n, className = '' }: { n?: number | null; className?: string }) {
  const { L } = useLanguage();
  if (!n) return null;
  const num = String(n).padStart(3, '0');
  return (
    <span
      title={L(
        'Uno de los primeros 25 vendedores de Mercadopleis.',
        'One of the first 25 sellers on Mercadopleis.',
        'Um dos primeiros 25 vendedores do Mercadopleis.'
      )}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ${className}`}
    >
      <Award className="h-3 w-3" aria-hidden />
      {L(`Vendedor fundador #${num}`, `Founding Seller #${num}`, `Vendedor fundador #${num}`)}
    </span>
  );
}
