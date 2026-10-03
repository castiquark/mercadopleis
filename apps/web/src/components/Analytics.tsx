'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { CONSENT_EVENT, readConsent } from '@/lib/consent';

const GA_ID = 'G-2GCQ3QTT5D';

/** Loads Google Analytics only after the visitor accepts analytics cookies. */
export function Analytics() {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    setGranted(readConsent() === 'granted');
    const onChange = (e: Event) => setGranted((e as CustomEvent).detail === 'granted');
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (!granted) return null;

  return (
    <>
      <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true });
          `,
        }}
      />
    </>
  );
}
