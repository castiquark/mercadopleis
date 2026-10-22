'use client';

// Last-resort error page for errors the language layout cannot catch; reports them to Sentry.
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0b0f17', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Something went wrong</h1>
        <p style={{ color: '#94a3b8' }}>
          Please reload the page. <Link href="/" style={{ color: '#a78bfa' }}>Back to Mercadopleis</Link>
        </p>
      </body>
    </html>
  );
}
