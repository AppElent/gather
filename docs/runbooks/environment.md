---
type: runbook
description: Read when adding or changing an environment variable, an Infisical value, a Convex deployment variable, or a generated env file.
version: 2.1.0
---

# Environment

Binds the shared [environments](../standards/environments.md) standard.
[`env.manifest.ts`](../../env.manifest.ts) is data only: it declares every
variable by its consumer, never its destination ([ADR-0014](../adr/0014-a-variable-declares-its-consumer-not-its-destination.md)),
and the standard's shared routing picks the destination. Infisical is the value
source; `pnpm env:*` runs the vendored `scripts/env.mjs`. Variable lists live in
the manifest and `.env.example`, not here.

## Prerequisites

- Infisical CLI signed in for source reads; the Convex, GitHub, Wrangler and
  EAS CLIs for the destinations a remote apply touches.

## Project facts

| Fact | Value |
| --- | --- |
| Environments → Infisical environment | `local` → `dev`, `preview` → `staging`, `staging` and `production` → `prod` (the standard map) |
| `staging` holds no Convex deploy key or Convex variables | It runs on the production deployment, which `production` configures ([ADR-0039](../adr/0039-staging-is-a-frontend-on-the-production-backend.md)); the manifest names no `convex.deployments.staging` |
| Convex | Project `eric-jansen:gather`; production deployment `limitless-bulldog-972`; `local` writes to the deployment the Convex CLI selects |
| Workers | `gather` (production), `gather-staging` (staging), `gather-pr-<N>` (preview, needs `--pr <N>`) |
| Infisical folders | `/` then `/gather`; `/gather` overrides a same-named root value. `.infisical.json` holds the project reference only |
| Local apply writes | `.env.local`, `.dev.vars`, `apps/mobile/.env.local` |
| Remote apply routes to | GitHub (repository scope holds only `PREVIEW_<name>`; `staging`/`production` Environments), Convex, Workers, EAS (`development` from `local`, `preview` from `staging`, `production`) |
| Worktrees | The `t3.json` hook runs `node scripts/workspace.mjs prepare --editor t3`, which writes the three local files from Infisical ([workspaces](../standards/workspaces.md)) |
| Commands needing deployed values | `pnpm deploy:staging`, `pnpm deploy:production`, `pnpm mobile:update:<channel>`: each runs through `env.mjs exec`, which adds the values to that one command and writes no file. The `preview` channel reads `staging` |

## Steps

1. Add or change the entry in `env.manifest.ts`, then `pnpm env:generate` for
   `.env.example`.
2. `pnpm env:check <environment>`, then `pnpm env:plan <environment>` (preview
   Worker values need `--pr <N>`), before any `pnpm env:apply <environment>`.
   Locally, `pnpm env:apply local --only file` rewrites only the generated
   files. Apply writes no empty values and prunes only with an explicit
   `--prune`.
3. A value the preview workflow needs also lands on `workflow` for `preview`,
   and `preview.yml` maps `PREVIEW_<name>` back to `<name>`.

## Hazards

- **`ENABLE_SAMPLE_DATA` is never set on production.** Its absence is what
  stops anyone holding the deployment URL from calling the public
  `seed.loadSampleData` / `seed.resetSampleData`. Set it on dev and as a
  preview default (`convex env default set --type preview`). The internal
  `seedTastingCatalog`, `seedRetailerCatalog` and `seedPreview` do not consult it. `VITE_ENABLE_SAMPLE_DATA`
  (the Settings panel) follows the same rule; `import.meta.env.DEV` implies it.
- **Preview Convex backends inherit nothing** from dev or prod: each PR gets a
  fresh deployment, so a server variable a preview needs (`CLERK_JWT_ISSUER_DOMAIN`
  above all) must be a preview default, `convex env default set --type preview`.
- **`VITE_*` and `EXPO_PUBLIC_*` are public**: inlined into bundles. Test-user
  credentials therefore belong to the Clerk *test* instance only, and land only
  in `local` (apply and exec refuse any other landing).
- **Auth follows the Infisical tier.** Local and web PR previews (short-lived)
  use the Clerk development instance; staging web, the installed preview app and
  production (long-lived) use production. Infisical `staging` holds
  `clerk-publishable-key` and `clerk-jwt-issuer-domain` as secret references to
  the `dev` values, so the preview Convex default `CLERK_JWT_ISSUER_DOMAIN` is the
  development issuer (`pnpm env:apply preview --only convex`). Staging web can
  use production auth because it serves `gather-stg.appelent.nl`: a production
  instance signs in only on its own domain and subdomains, never on `workers.dev`.
- **Staging and production share Infisical `prod`.** Staging web reads the
  production values (the backend URL above all, [ADR-0039](../adr/0039-staging-is-a-frontend-on-the-production-backend.md)).
  A value that must differ for staging gets its own Infisical key.
- **OAuth providers** (Notion, Todoist) register the redirect URI
  `<app-origin>/integrations/callback` (`http://localhost:3000/integrations/callback`
  in dev). Without their client id/secret, connecting fails with a clear
  "not configured" error and local task lists still work.
- `ANTHROPIC_API_KEY` is optional: without it, recipe import works only for
  pages with JSON-LD, and Plan mijn week (APP-319) always makes its rules-only
  "Eenvoudig voorstel", which costs no slimme actie.
- `APPLE_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID` and `APPLE_SIGN_IN_PRIVATE_KEY`
  (Infisical `apple-team-id`, `apple-sso-key-id`, `apple-sso-key-value`, the
  same Apple team and key as Foundry) let account deletion revoke a person's
  Sign in with Apple grant, which Apple requires (TN3194). They are optional so
  a deploy never fails on them, but production needs them before Gather ships
  Sign in with Apple to the App Store: without them the revoke answers "not
  configured", Sentry gets the report, and the deletion goes ahead unrevoked.
- `CLERK_WEBHOOK_SECRET` (Infisical `clerk-webhook-secret`) is the signing
  secret of the Clerk webhook endpoint pointed at `POST /clerk/webhook` on that
  Convex deployment's `.convex.site` origin, subscribed to `user.deleted`
  ([ADR-0050](../adr/0050-deleting-gather-data-keeps-the-appelent-login.md)),
  and to `user.created` and `user.updated`, which mirror the login's Apple
  links for web Apple revocation (APP-388,
  [account deletion](../contracts/account-deletion.md#web-apple-revocation)),
  and to `session.ended`, `session.removed` and `session.revoked`, which end the
  keys of watches paired under that session (APP-653,
  [watch API](../contracts/watch-api.md)).
  Each Clerk instance has its own endpoint and secret: the development one for
  `local`, the production one for `production`, which waits for Eric's go
  (APP-392). Per-PR preview backends get none. Optional: without it the route refuses every request
  (503), a login deleted in another app leaves Gather's data behind, and web
  Apple revocation refuses every code (nothing is deleted).

## Verify

- `pnpm env:check <target>` reports no missing required values.
