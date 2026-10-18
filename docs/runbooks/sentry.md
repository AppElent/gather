---
type: runbook
description: Read when changing web error reporting, the privacy scrubber, source-map upload, or the Sentry variables.
version: 1.0.0
---

# Sentry (web)

Implements [Sentry monitoring](../standards/sentry-monitoring.md) for the web app.
The phone and Convex are **not covered** (see Coverage).

## Project facts

| Fact | Value |
| --- | --- |
| Browser | `src/instrument.client.ts`, imported first by `src/client.tsx`. Initialises only with `VITE_SENTRY_DSN`, outside `vite dev`, on a non-local host. Tag `app=gather-web` |
| Worker | `src/server.ts` is the `main` in `wrangler.jsonc`. Wraps TanStack Start with `@sentry/cloudflare` for deployed requests with a DSN; captures a 5xx response because Start turns SSR errors into a response instead of throwing. Tag `app=gather-web-server` |
| Router errors | `defaultOnCatch` in `src/router.tsx` calls `reportError` (`src/lib/observability/report.ts`), once per error object, through a sink each runtime registers |
| Scrubbing | `src/lib/observability/privacy.ts` runs in `beforeSend` and `beforeBreadcrumb` on both runtimes. Tested in `privacy.test.ts` |
| Environment | From the hostname (`environmentFromHostname`): `gather-pr-<N>` → `preview`, `gather-stg` → `staging`, `gather-dev` → `development`, else `production` |
| Release | `SENTRY_RELEASE`, else `git rev-parse HEAD`, inlined as `VITE_SENTRY_RELEASE`; the same string names the source-map upload |
| Project | Browser and Worker share one Sentry project, told apart by the `app` tag |
| Variables | `VITE_SENTRY_DSN`, `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` ([environment](environment.md), `env.manifest.ts`) |

## What is sent, and what never is

Errors only. Tracing, replay, logs and profiling are off. `sendDefaultPii` is
false, and the scrubber removes request bodies, headers, cookies, query strings
and fragments, `extra`, stack-frame locals, console and input breadcrumbs,
emails, Bearer tokens and JWTs, and the value Convex echoes in an
`ArgumentValidationError`. No user is attached. Convex arguments are never
captured. Adding a field to `BREADCRUMB_DATA_KEYS` or turning on replay is a
privacy change: update this table and the privacy statement.

## Source maps

`vite.config.ts` emits hidden maps and uploads them only when `SENTRY_AUTH_TOKEN`
is set; the plugin deletes `dist/**/*.map` after upload. Without the token the
build emits no maps at all. A failed upload is logged by the plugin and does not
fail the build, so check the deploy log. `scripts/generate-sw.mjs` disables its
own maps.

## Local reporting is off

Any request or page on `localhost`, `*.localhost`, `127.*`, `[::1]` or `0.0.0.0`
never reports, even with a DSN and production bindings. To see a payload locally,
point `VITE_SENTRY_DSN` at a throwaway HTTP listener and temporarily make
`isLocalReportingUrl` return `false`; never commit that.

## Coverage

- **Web browser and Worker:** active once `VITE_SENTRY_DSN` is set per environment.
- **SSR errors:** the 5xx fallback carries no original stack; the framework has
  already swallowed the exception.
- **Convex:** inactive. No managed integration or log forwarder is set up, so
  unattended backend failures are unobserved.
- **Phone:** inactive; no Sentry SDK in `apps/mobile`.
- **Not yet verified end to end:** symbolication of an uploaded map in a real
  Sentry project.
