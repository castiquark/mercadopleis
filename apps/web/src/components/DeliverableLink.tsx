'use client';

import React, { useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { getDeliverableAccess } from '@/lib/api';
import { useLanguage } from '@/lib/languageContext';

interface DeliverableLinkProps {
  orderId: string;
  /** Value stored in the order: an external http(s) URL or a private `storage:` reference. */
  reference: string;
  className?: string;
}

/**
 * External links open directly. Uploaded files are private, so the signed download URL is requested
 * on click (it is valid for a few minutes only).
 */
export function DeliverableLink({ orderId, reference, className = '' }: DeliverableLinkProps) {
  const { language } = useLanguage();
  const en = language === 'en';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (/^https?:\/\//i.test(reference)) {
    return (
      <span className="inline-flex max-w-full flex-col items-start gap-0.5">
        <a
          href={reference}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex max-w-full items-start gap-1 break-all ${className}`}
        >
          <span>{reference}</span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
        </a>
        {/* The on-chain hash covers the link text only, so the content behind it can change. */}
        <span className="text-[11px] text-slate-500">
          {en
            ? 'External link: the on-chain hash records the link, not its content. Review it before approving.'
            : 'Enlace externo: el hash on-chain registra el enlace, no su contenido. Revísalo antes de aprobar.'}
        </span>
      </span>
    );
  }

  const filename = reference.split('/').pop()?.replace(/^\d+-/, '') || (en ? 'deliverable' : 'entregable');

  const download = async () => {
    try {
      setLoading(true);
      setError(null);
      const access = await getDeliverableAccess(orderId);
      window.open(access.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || (en ? 'The file could not be downloaded' : 'No se pudo descargar el archivo'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className={`inline-flex min-h-10 items-center gap-1.5 text-left sm:min-h-0 ${className}`}
      >
        {loading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <Download className="h-3 w-3 shrink-0" />}
        <span className="break-all">{en ? 'Download' : 'Descargar'} {filename}</span>
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
