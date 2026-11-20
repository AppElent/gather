---
type: runbook
description: Read when changing web or phone error reporting, the privacy scrubber, source-map upload, or the Sentry variables.
version: 1.2.0
---

# Sentry (web and phone)

Implements [Sentry monitoring](../standards/sentry-monitoring.md) for the web app,
the Expo phone app, and Convex through a log forwarder (see [Convex forwarder](#convex-forwarder)).

## Project facts

| Fact | Value |
| --- | --- |
| Browser | `src/instrument.client.ts`, imported first by `src/client.tsx`. Initialises only with `VITE_SENTRY_DSN`, outside `vite dev`, on a non-local host. Tag `app=gather-web` |
| Worker | `src/server.ts` is the `main` in `wrangler.jsonc`. Wraps TanStack Start with `@sentry/cloudflare` for deployed requests with a DSN; captures a 5xx response because Start turns SSR errors into a response instead of throwing. Tag `app=gather-web-server` |
| Router errors | `defaultOnCatch` in `src/router.tsx` calls `reportError` (`src/lib/observability/report.ts`), once per error object, through a sink each runtime registers |
| Scrubbing | One implementation, `packages/core/src/sentryPrivacy.ts` (`@gather/core/sentry-privacy`), runs in `beforeSend` and `beforeBreadcrumb` on the browser, the Worker and the phone. Tests: `packages/core/src/__tests__/sentryPrivacy.test.ts`; phone wiring: `apps/mobile/src/observability/options.test.ts` |
| Environment | From the hostname (`environmentFromHostname`): `gather-pr-<N>` → `preview`, `gather-staging` (and its `gather-stg` custom domain) → `staging`, `gather-dev` → `development`, else `production` |
| Release | `SENTRY_RELEASE`, else `gather@<version>+<short sha>` (version from `apps/mobile/app.json`, [ADR-0044](../adr/0044-every-merge-ships-and-the-app-updates-daily.md)), inlined as `VITE_SENTRY_RELEASE`; the same string names the source-map upload and appears on `/version` |
| Project | Browser and Worker share one Sentry project, told apart by the `app` tag |
| Phone | `apps/mobile/src/observability/` (`init.ts` imported first by `app/_layout.tsx`; `options.ts` is the policy as plain data). Initialises only with `EXPO_PUBLIC_SENTRY_DSN` in a release bundle (`__DEV__` is off unless `EXPO_PUBLIC_SENTRY_DEBUG=1`). Tag `app=gather-mobile`; environment is the update channel (`preview` / `production`), `development` otherwise. Release is the SDK default (`com.appelent.gather@<version>+<build>`) plus the OTA runtime version and update id; maps match by Metro debug ID (`apps/mobile/metro.config.js`), not by release |
| Phone errors | The root `ErrorBoundary` in `app/_layout.tsx` renders Expo Router's own error screen and reports once (`report.ts`, once per error object); the Search tab's boundary reports the same way. Anything no boundary catches reaches the SDK's global handler. `Sentry.wrap` is **not** used: errors-only needs nothing from it, and its touch boundary would create the `ui.*` breadcrumbs the scrubber exists to drop |
| Convex | `scripts/convex-sentry.mjs` (`pnpm sentry:convex`) forwards failed executions from `convex logs --jsonl`. Tag `app=gather-convex` (from the package name). Test: `scripts/convex-sentry.test.mjs` |
| Variables | `VITE_SENTRY_DSN`, `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, and for the phone `EXPO_PUBLIC_SENTRY_DSN` (EAS `preview`/`production`) plus `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` on EAS for native builds ([environment](environment.md), `env.manifest.ts`). The phone shares the web's Sentry project, told apart by the `app` tag |

## What is sent, and what never is

Errors only. Tracing, replay, logs, profiling, screenshots and release-health sessions are off. On the web,
Sentry 11's `dataCollection` (`SENTRY_BASE_OPTIONS`) turns off every automatic
source of user data; the phone's SDK still uses `sendDefaultPii: false`. The
scrubber removes request bodies, headers, cookies, query strings and
fragments, `extra`, stack-frame locals, emails, Bearer tokens and JWTs, and
the value Convex echoes in an `ArgumentValidationError`. No user is attached.
Convex arguments are never captured.

| Surface | What remains |
| --- | --- |
| Breadcrumbs | Allowlisted categories only: `navigation`, `fetch`, `xhr`, `http`, `sentry.*`. On the phone `navigation` is a route *pattern* (`/(app)/(tabs)/all/notes/[noteId]`, from `useSegments`), never an address with ids or params, and `touch`, `app.lifecycle` and the rest of the native categories are dropped too. Data keys limited to `url` (no query/fragment), `method`, `status_code`, `from`, `to`. **All `ui.*` and `console` breadcrumbs are dropped**: the SDK serialises a clicked element with its `aria-label`/`title`/`alt`, and Gather puts household content in labels ("Delete task <title>") |
| Convex errors | `[CONVEX M(fn)] [Request ID: x] Server Error: <ErrorClass> (message withheld)`. The function and class find the throw site; the message and any `ConvexError` data are withheld |
| Other errors | The thrown message, redacted and cut to 500 characters, plus the stack. **Never interpolate user content into an `Error` message** — a message authored in code is sent as written |
| Request | Method and URL without query or fragment. URL paths can hold opaque ids (a recipe id), never names |
| Tags / release | `app`, `environment`, release SHA, HTTP status on SSR 5xx | Adding a field to `BREADCRUMB_DATA_KEYS` or turning on replay is a
privacy change: update this table and the privacy statement.

## Source maps

`vite.config.ts` emits hidden maps and uploads them only when `SENTRY_AUTH_TOKEN`
is set (in CI from the job env; by hand through `pnpm deploy:<environment>`,
which runs under `env:exec`; the token never lands in `.env.local`. Vite reads dotenv files
only after the config is evaluated, so the config loads just the four Sentry
names itself; the process environment wins); the plugin deletes `dist/**/*.map` after upload. Without the token the
build emits no maps at all. A failed upload is logged by the plugin and does not
fail the build, so check the deploy log. `scripts/generate-sw.mjs` disables its
own maps.

## Phone source maps and symbols

An over-the-air update is published only through `pnpm mobile:update:preview` /
`mobile:update:production` from the repo root, which run
`apps/mobile/scripts/publish-update.mjs` under `env:exec` with that channel's
EAS values (`SENTRY_*` included): `eas update` with its
`--environment`, then `sentry-expo-upload-sourcemaps dist` for that same
export. **Production refuses to publish without `SENTRY_AUTH_TOKEN`** (plus
org and project: `SENTRY_ORG`/`SENTRY_PROJECT`, else the web's `VITE_SENTRY_*`,
read from the process or the root `.env.local`). Preview publishes without them
and says so, because preview is where the pipeline is tried. If the update
publishes and the upload fails, run `pnpm mobile:update:production --upload-only` (it
re-uploads the last `dist/`; it never publishes again).

A store or internal build uploads its own bundle map and native symbols from the
Sentry config plugin during the EAS build, so `SENTRY_ORG`, `SENTRY_PROJECT` and
`SENTRY_AUTH_TOKEN` must exist in that EAS environment. A local build
sets `SENTRY_DISABLE_AUTO_UPLOAD=true` to skip the upload. What a cloud build
does with the token missing, and whether its upload resolves a native stack, has
not been verified.

## Convex forwarder

The free plan has no managed Convex integration, so a reader forwards failed
executions (queries, mutations, actions, HTTP actions and scheduled functions) to
the web's Sentry project. The script is the toolkit's forwarder
([example](../standards/sentry-monitoring/examples/convex-sentry.mjs)), copied as
Arcade Club ships it. It sends only the sanitized error stack and structural tags
(`app`, `func`, `func_type`, `caller`, `request_id`): never log lines, arguments,
return values or the caller's identity. It replays the last 100 entries on
restart, skips failures Convex will retry, and deduplicates by a stable event id.
There is no durable queue, so failures older than the replay are lost while it is
down. Run one reader per deployment.

**Locally, against your dev deployment:**

```sh
pnpm env:exec local -- pnpm sentry:convex
pnpm env:exec local -- pnpm sentry:convex --deployment <dev-deployment-name>
```

`env:exec local` sets `SENTRY_CONVEX_DSN` (Infisical `sentry-dsn`, the same public
value as `VITE_SENTRY_DSN`) and `CONVEX_DEPLOYMENT`, which the script uses when no
`--deployment` is given. The environment tag is `development`.

### Production

Production failures are forwarded by the shared
[incident inbox](https://github.com/AppElent/developer-home/blob/main/services/incident-inbox/README.md) in `AppElent/developer-home`, not by this repo's
script (since 17 Nov 2026). One launchd agent on Eric's always-on Mac,
`com.appelent.incident-inbox` (run from `~/Developer/.services/developer-home`),
reads `eric-jansen:gather:prod` with the logged-in Convex CLI and sends failed executions to this
app's Sentry project with the same `app=gather-convex` tag and
`environment=production`. Its incident poll then files each new Sentry issue in
Linear (team `APP`, labels `app:gather` and Source `convex`). Events are grouped
by throwing function and message, so one helper failing under several queries
is one Sentry issue; the `func` tag still names the query.

- Log: `~/Library/Logs/incident-inbox.log`. A healthy start logs
  `convex gather: reading eric-jansen:gather:prod`.
- Restart: `launchctl kickstart -k "gui/$(id -u)/com.appelent.incident-inbox"`.
- Deployment, tag and DSN (`SENTRY_DSN_GATHER`) are set in the inbox's `config.mjs` and
  its env file; change them there, not here.

Do not run `pnpm sentry:convex` against production while the inbox runs:
Sentry would get each failure twice. The old per-app agent
`com.appelent.convex-sentry.gather`, its clone `~/Developer/.services/gather`
and the `convex-sentry-run` wrapper are retired
([APP-98](https://linear.app/appelent/issue/APP-98), [APP-222](https://linear.app/appelent/issue/APP-222)).

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
- **Convex:** failed executions, including scheduled functions, while the
  forwarder runs ([Convex forwarder](#convex-forwarder)). Best effort: no durable
  queue. Production is covered by the shared incident inbox
  ([Production](#production)). Console output and successful calls are never sent.
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
