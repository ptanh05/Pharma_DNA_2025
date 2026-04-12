import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Set `environment` to match the deployment environment
  environment: process.env.NODE_ENV,

  // Enable debug logs in development for Sentry troubleshooting
  debug: process.env.NODE_ENV === "development",

  sourceMapUploadOptions: {
    project: "javascript-nextjs",
    authToken: process.env.SENTRY_AUTH_TOKEN,
  },
});

export async function onRequestError({ error }: { error: Error }) {
  Sentry.captureRequestError(error);
}
