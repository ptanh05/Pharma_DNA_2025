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

  // Uncomment the following line to enable source maps upload
  // sourceMapUploadOptions: {
  //   project: "pharma-dna-saga",
  //   authToken: process.env.SENTRY_AUTH_TOKEN,
  // },
});
