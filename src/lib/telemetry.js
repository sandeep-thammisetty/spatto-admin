import * as Sentry from '@sentry/react';
import { configureTelemetry, installGlobalHandlers } from '@spattoo/designer';

// Initialise error telemetry for the admin app and bind Sentry to spattoo-core's
// vendor-neutral façade. The SDK lives ONLY here — admin code calls reportError/
// the ErrorBoundary from @spattoo/designer, never Sentry directly. Without
// VITE_SENTRY_DSN this falls back to the console transport, so local dev without a
// DSN still works. surface='admin' tags every event into the spattoo-admin project.
export function initTelemetry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    configureTelemetry({ surface: 'admin' });   // console transport
    installGlobalHandlers();
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,           // 'development' | 'production'
    tracesSampleRate: 0,                          // errors only — no perf/tracing
  });

  configureTelemetry({
    surface: 'admin',
    transport: {
      capture(error, ctx) {
        Sentry.withScope((scope) => {
          if (ctx.bakerId || ctx.customerId) scope.setUser({ id: ctx.customerId || ctx.bakerId });
          scope.setTags({
            surface:     ctx.surface    || 'admin',
            baker_id:    ctx.bakerId    ?? 'none',
            customer_id: ctx.customerId ?? 'none',
            screen:      ctx.screen     || 'unknown',
            action:      ctx.action     || 'unknown',
          });
          if (ctx.extra) scope.setContext('extra', ctx.extra);
          scope.setLevel(ctx.severity === 'warning' ? 'warning' : ctx.severity === 'info' ? 'info' : 'error');
          Sentry.captureException(error);
        });
      },
      setContext(ctx) {
        Sentry.setUser(ctx.bakerId || ctx.customerId ? { id: ctx.customerId || ctx.bakerId } : null);
      },
    },
  });

  installGlobalHandlers();
}
