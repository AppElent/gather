---
type: runbook
description: Read when changing web or phone error reporting, the privacy scrubber, source-map upload, or the Sentry variables.
version: 1.0.0
---

# Sentry (web and phone)

Implements [Sentry monitoring](../standards/sentry-monitoring.md) for the web app
and the Expo phone app. Convex is **not covered** (see Coverage).

## Project facts

| Fact | Value |
| --- | --- |
| Browser | `src/instrument.client.ts`, imported first by `src/client.tsx`. Initialises only with `VITE_SENTRY_DSN`, outside `vite dev`, on a non-local host. Tag `app=gather-web` |
| Worker | `src/server.ts` is the `main` in `wrangler.jsonc`. Wraps TanStack Start with `@sentry/cloudflare` for deployed requests with a DSN; captures a 5xx response because Start turns SSR errors into a response instead of throwing. Tag `app=gather-web-server` |
| Router errors | `defaultOnCatch` in `src/router.tsx` calls `reportError` (`src/lib/observability/report.ts`), once per error object, through a sink each runtime registers |
| Scrubbing | One implementation, `packages/core/src/sentryPrivacy.ts` (`@gather/core/sentry-privacy`), runs in `beforeSend` and `beforeBreadcrumb` on the browser, the Worker and the phone. Web tests: `src/lib/observability/privacy.test.ts`; phone wiring: `apps/mobile/src/observability/options.test.ts` |
| Environment | From the hostname (`environmentFromHostname`): `gather-pr-<N>` → `preview`, `gather-stg` → `staging`, `gather-dev` → `development`, else `production` |
| Release | `SENTRY_RELEASE`, else `git rev-parse HEAD`, inlined as `VITE_SENTRY_RELEASE`; the same string names the source-map upload |
| Project | Browser and Worker share one Sentry project, told apart by the `app` tag |
| Phone | `apps/mobile/src/observability/` (`init.ts` imported first by `app/_layout.tsx`; `options.ts` is the policy as plain data). Initialises only with `EXPO_PUBLIC_SENTRY_DSN` in a release bundle (`__DEV__` is off unless `EXPO_PUBLIC_SENTRY_DEBUG=1`). Tag `app=gather-mobile`; environment is the update channel (`preview` / `production`), `development` otherwise. Release is the SDK default (`com.appelent.gather@<version>+<build>`) plus the OTA runtime version and update id; maps match by Metro debug ID (`apps/mobile/metro.config.js`), not by release |
| Phone errors | The root `ErrorBoundary` in `app/_layout.tsx` renders Expo Router's own error screen and reports once (`report.ts`, once per error object); the Search tab's boundary reports the same way. Anything no boundary catches reaches the SDK's global handler. `Sentry.wrap` is **not** used: errors-only needs nothing from it, and its touch boundary would create the `ui.*` breadcrumbs the scrubber exists to drop |
| Variables | `VITE_SENTRY_DSN`, `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, and for the phone `EXPO_PUBLIC_SENTRY_DSN` (EAS `preview`/`production`) plus `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` on EAS for native builds ([environment](environment.md), `env.manifest.ts`). The phone shares the web's Sentry project, told apart by the `app` tag |

## What is sent, and what never is

Errors only. Tracing, replay, logs, profiling, screenshots and release-health sessions are off. `sendDefaultPii` is
false, and the scrubber removes request bodies, headers, cookies, query strings
and fragments, `extra`, stack-frame locals, emails, Bearer tokens and JWTs, and
the value Convex echoes in an `ArgumentValidationError`. No user is attached.
Convex arguments are never captured.

| Surface | What remains |
| --- | --- |
| Breadcrumbs | Allowlisted categories only: `navigation`, `fetch`, `xhr`, `http`, `sentry.*`. On the phone `navigation` is a route *pattern* (`/(app)/g/[groupId]/notes`, from `useSegments`), never an address with ids or params, and `touch`, `app.lifecycle` and the rest of the native categories are dropped too. Data keys limited to `url` (no query/fragment), `method`, `status_code`, `from`, `to`. **All `ui.*` and `console` breadcrumbs are dropped**: the SDK serialises a clicked element with its `aria-label`/`title`/`alt`, and Gather puts household content in labels ("Delete task <title>") |
| Convex errors | `[CONVEX M(fn)] [Request ID: x] Server Error: <ErrorClass> (message withheld)`. The function and class find the throw site; the message and any `ConvexError` data are withheld |
| Other errors | The thrown message, redacted and cut to 500 characters, plus the stack. **Never interpolate user content into an `Error` message** — a message authored in code is sent as written |
| Request | Method and URL without query or fragment. URL paths can hold opaque ids (a recipe id), never names |
| Tags / release | `app`, `environment`, release SHA, HTTP status on SSR 5xx | Adding a field to `BREADCRUMB_DATA_KEYS` or turning on replay is a
privacy change: update this table and the privacy statement.

## Source maps

`vite.config.ts` emits hidden maps and uploads them only when `SENTRY_AUTH_TOKEN`
is set (from the process environment, else `.env.local` — Vite reads dotenv files
only after the config is evaluated, so the config loads just the four Sentry
names itself; the process environment wins); the plugin deletes `dist/**/*.map` after upload. Without the token the
build emits no maps at all. A failed upload is logged by the plugin and does not
fail the build, so check the deploy log. `scripts/generate-sw.mjs` disables its
own maps.

## Phone source maps and symbols

An over-the-air update is published only through `pnpm update:preview` /
`update:prod` (`apps/mobile/scripts/publish-update.mjs`): `eas update` with its
`--environment`, then `sentry-expo-upload-sourcemaps dist` for that same
export. **Production refuses to publish without `SENTRY_AUTH_TOKEN`** (plus
org and project: `SENTRY_ORG`/`SENTRY_PROJECT`, else the web's `VITE_SENTRY_*`,
read from the process or the root `.env.local`). Preview publishes without them
and says so, because preview is where the pipeline is tried. If the update
publishes and the upload fails, run `pnpm update:prod --upload-only` (it
re-uploads the last `dist/`; it never publishes again).

A store or internal build uploads its own bundle map and native symbols from the
Sentry config plugin during the EAS build, so `SENTRY_ORG`, `SENTRY_PROJECT` and
`SENTRY_AUTH_TOKEN` must exist in that EAS environment. A local build
sets `SENTRY_DISABLE_AUTO_UPLOAD=true` to skip the upload. What a cloud build
does with the token missing, and whether its upload resolves a native stack, has
not been verified.

## Local reporting is off

Any request or page on `localhost`, `*.localhost`, `127.*`, `[::1]` or `0.0.0.0`
never reports, even with a DSN and production bindings. To see a payload locally,
point `VITE_SENTRY_DSN` at a throwaway HTTP listener and temporarily make
`isLocalReportingUrl` return `false`; never commit that. On the phone, a
development bundle never reports; to see a payload, run a dev build with
`EXPO_PUBLIC_SENTRY_DSN=http://key@<host-ip>:<port>/1` (the emulator reaches the
host at `10.0.2.2`) and `EXPO_PUBLIC_SENTRY_DEBUG=1` against a throwaway HTTP
listener. A Metro-served bundle also attaches the source lines around each frame
(`context_line` and its neighbours); a release bundle does not.

## Coverage

- **Web browser and Worker:** active once `VITE_SENTRY_DSN` is set per environment.
- **SSR errors:** the 5xx fallback carries no original stack; the framework has
  already swallowed the exception.
- **Convex:** inactive. No managed integration or log forwarder is set up, so
  unattended backend failures are unobserved.
- **Phone:** active once `EXPO_PUBLIC_SENTRY_DSN` is set in an EAS environment
  and a build containing the SDK is installed. The SDK is **native**: it moves
  the `fingerprint` runtime version, so it ships only with the next native build
  and never by update; installed builds report nothing until they are replaced.
  Native crashes (Java/NDK, iOS) are sent by the native SDK and are not verified
  to pass through the JS `beforeSend`; device context (model, OS, locale, free
  memory, a device id) travels with every event. Not covered by the scrubber test
  and not yet exercised on a real native crash.
- **Not yet verified end to end:** symbolication of an uploaded map in a real
  Sentry project, for either the web map or a phone update's map.
