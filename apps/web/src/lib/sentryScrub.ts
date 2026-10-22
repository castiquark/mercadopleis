// Shared Sentry options for the browser, Node and edge runtimes: errors only, nothing sensitive.
// Sentry only sends when a DSN is set, and the DSN is only set in Netlify's production context,
// so local builds and the test server on port 3100 send nothing.
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const WALLET = /\b0x[a-fA-F0-9]{40}\b/g;
const SIGNATURE = /\b0x[a-fA-F0-9]{128,}\b/g; // SIWE and transaction signatures

export function redact(text: string): string {
  return text.replace(SIGNATURE, '0x[signature]').replace(WALLET, '0x[wallet]');
}

/** Expected outcomes, not bugs: wallet rejections, escrow reverts the UI already explains, wallet SDK noise. */
export const IGNORE_ERRORS: (string | RegExp)[] = [
  /user rejected|user denied|rejected the request|UserRejectedRequestError|ACTION_REJECTED/i,
  /InvalidStatus|DeadlineNotPassed|AutoReleaseNotReady|EnforcedPause|reverted with the following reason/i,
  /Connector not connected|Cross-Origin-Opener-Policy/i,
  'NEXT_NOT_FOUND',
  'NEXT_REDIRECT',
];

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    if (event.request.query_string) event.request.query_string = '[removed]';
    if (event.request.url) event.request.url = redact(event.request.url);
  }
  delete event.user;
  if (event.message) event.message = redact(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redact(ex.value);
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = redact(b.message);
    if (b.data) b.data = JSON.parse(redact(JSON.stringify(b.data)));
  }
  if (event.extra) event.extra = JSON.parse(redact(JSON.stringify(event.extra)));
  return event;
}

export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: !!dsn,
    environment: 'production',
    tracesSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: IGNORE_ERRORS,
    beforeSend: scrubEvent,
  };
}
