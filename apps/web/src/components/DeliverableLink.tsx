'use client';

import React, { useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { getDeliverableAccess } from '@/lib/api';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (/^https?:\/\//i.test(reference)) {
    return (
      <a
        href={reference}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex max-w-full items-start gap-1 break-all ${className}`}
      >
        <span>{reference}</span>
        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
      </a>
    );
  }

  const filename = reference.split('/').pop()?.replace(/^\d+-/, '') || 'entregable';

  const download = async () => {
    try {
      setLoading(true);
      setError(null);
      const access = await getDeliverableAccess(orderId);
      window.open(access.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'No se pudo descargar el archivo');
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
        <span className="break-all">Descargar {filename}</span>
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
