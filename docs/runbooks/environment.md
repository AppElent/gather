---
type: runbook
description: Read when adding or changing an environment variable, an Infisical value, a Convex deployment variable, or a generated env file.
version: 2.0.0
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
| Environments → Infisical environment | `local` → `dev`, `preview` and `staging` → `staging`, `production` → `prod` (the standard map) |
| `staging` holds no Convex deploy key or Convex variables | It runs on the production deployment, which `production` configures ([ADR-0039](../adr/0039-staging-is-a-frontend-on-the-production-backend.md)); the manifest names no `convex.deployments.staging` |
| Convex | Project `eric-jansen:gather`; production deployment `limitless-bulldog-972`; `local` writes to the deployment the Convex CLI selects |
| Workers | `gather` (production), `gather-stg` (staging, kept by `worker.names.staging`), `gather-pr-<N>` (preview, needs `--pr <N>`) |
| Infisical folders | `/` then `/gather`; `/gather` overrides a same-named root value. `.infisical.json` holds the project reference only |
| Local apply writes | `.env.local`, `.dev.vars`, `apps/mobile/.env.local` |
| Remote apply routes to | GitHub (repository scope holds only `PREVIEW_<name>`; `staging`/`production` Environments), Convex, Workers, EAS (`development` from `local`, `preview`, `production`) |
| Worktrees | The `t3.json` hook runs `node scripts/workspace.mjs prepare --editor t3`, which writes the three local files from Infisical ([workspaces](../standards/workspaces.md)) |
| Commands needing deployed values | `pnpm deploy:staging`, `pnpm deploy:production`, `pnpm mobile:update:<channel>`: each runs through `env.mjs exec`, which adds the values to that one command and writes no file |

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
  `seedTastingCatalog` / `seedPreview` do not consult it. `VITE_ENABLE_SAMPLE_DATA`
  (the Settings panel) follows the same rule; `import.meta.env.DEV` implies it.
- **Preview Convex backends inherit nothing** from dev or prod: each PR gets a
  fresh deployment, so a server variable a preview needs (`CLERK_JWT_ISSUER_DOMAIN`
  above all) must be a preview default, `convex env default set --type preview`.
- **`VITE_*` and `EXPO_PUBLIC_*` are public**: inlined into bundles. Test-user
  credentials therefore belong to the Clerk *test* instance only, and land only
  in `local` (apply and exec refuse any other landing).
- **Auth follows lifetime.** Local and web PR previews (short-lived) use the
  Clerk development instance; staging web, the installed preview app and
  production (long-lived) use production. Web PR previews read
  `pr-clerk-publishable-key` and `pr-clerk-jwt-issuer-domain`, which Infisical
  `staging` holds as secret references to the `dev` values, so the preview
  Convex default `CLERK_JWT_ISSUER_DOMAIN` is the development issuer
  (`pnpm env:apply preview --only convex`). Staging web can use production auth
  because it serves `gather-stg.appelent.nl`: a production instance signs in
  only on its own domain and subdomains, never on `workers.dev`.
- **OAuth providers** (Notion, Todoist) register the redirect URI
  `<app-origin>/integrations/callback` (`http://localhost:3000/integrations/callback`
  in dev). Without their client id/secret, connecting fails with a clear
  "not configured" error and local task lists still work.
- `ANTHROPIC_API_KEY` is optional: without it, recipe import works only for
  pages with JSON-LD.

## Verify

- `pnpm env:check <target>` reports no missing required values.
