// Browser error monitoring (Sentry). Errors only: no tracing, replay or profiling.
import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentryScrub';

Sentry.init({
  ...sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // Keep the bundle small: only the default error integrations, without the browser tracing one.
  integrations: (defaults) => defaults.filter((i) => i.name !== 'BrowserTracing'),
});
