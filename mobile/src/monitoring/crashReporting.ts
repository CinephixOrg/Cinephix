import type { ErrorInfo } from "react";

// Crash reporting through Sentry, on only when EXPO_PUBLIC_SENTRY_DSN is set
// (an EAS environment variable; a DSN is not a secret). Without it nothing
// here loads Sentry or sends anything, so local and dev builds stay quiet.
//
// The SDK is required lazily, like adsModule.ts does for ads: a dev-client
// built before this native module was added must keep working.

type SentryModule = typeof import("@sentry/react-native");

let sentry: SentryModule | null = null;

/** Starts Sentry once, at app start. Uncaught JS and native errors are reported from then on. */
export function initCrashReporting(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || sentry) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/react-native") as SentryModule;
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? "development" : "production"),
      // Errors only: no performance tracing, no personal data.
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
    sentry = Sentry;
  } catch (error) {
    console.warn("Crash reporting is off:", (error as Error)?.message ?? error);
  }
}

/** A render error caught by AppErrorBoundary (which keeps it from crashing the app). */
export function reportRenderError(error: Error, info: ErrorInfo): void {
  sentry?.captureException(error, {
    contexts: { react: { componentStack: info.componentStack ?? "" } },
  });
}
