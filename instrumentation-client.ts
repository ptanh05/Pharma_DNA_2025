import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Set environment
  environment: process.env.NODE_ENV,

  // Enable debugging in development
  debug: process.env.NODE_ENV === "development",

  // Don't send errors in development
  enabled: process.env.NODE_ENV !== "test",
});
