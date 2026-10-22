// Server and edge error monitoring (Sentry): pages, API routes and /mcp. Errors only.
import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentryScrub';

export function register() {
  Sentry.init(sentryOptions(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN));
}

// Errors thrown while rendering or in route handlers. notFound() and redirect() are not reported.
export const onRequestError = Sentry.captureRequestError;
