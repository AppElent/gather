---
type: runbook
description: Read when adding or changing an environment variable, an Infisical value, a Convex deployment variable, or a generated env file.
version: 1.0.0
---

# Environment

Binds the shared [environments](../standards/environments.md) standard.
[`env.manifest.ts`](../../env.manifest.ts) declares every variable by its
consumer, never its destination ([ADR-0014](../adr/0014-a-variable-declares-its-consumer-not-its-destination.md));
Infisical is the value source; `pnpm env:*` runs the vendored
`scripts/env.mjs`. Variable lists live in the manifest and `.env.example`, not
here.

## Prerequisites

- Infisical CLI signed in for source reads; the Convex, GitHub, Wrangler and
  EAS CLIs for the destinations a remote apply touches.

## Project facts

| Fact | Value |
| --- | --- |
| Targets → Infisical environment | `local` → `dev`, `preview` and `stg` → `staging`, `production` → `prod` |
| Infisical folders | `/` then `/gather`; `/gather` overrides a same-named root value. `.infisical.json` holds the project reference only |
| Local apply writes | `.env.local`, `.dev.vars`, `apps/mobile/.env.local` |
| Remote apply routes to | GitHub (repo scope uses the `PREVIEW_` prefix; `stg`/`production` Environments), Convex, Workers, EAS (`development`, `preview`, `production`) |
| Worktrees | `scripts/copy-env.sh` copies the three local files from the main checkout (see [bindings](../../CODING_STANDARDS.md#local-bindings-and-exceptions)) |

## Steps

1. Add or change the entry in `env.manifest.ts`, then `pnpm env:generate` for
   `.env.example`.
2. `pnpm env:check <target>`, then `pnpm env:plan <target>`, before any
   `pnpm env:apply <target>`. Apply writes no empty values and prunes only with
   an explicit `--prune`.

## Hazards

- **`ENABLE_SAMPLE_DATA` is never set on production.** Its absence is what
  stops anyone holding the deployment URL from calling the public
  `seed.loadSampleData` / `seed.resetSampleData`. Set it on dev and as a
  preview default (`convex env default set --type preview`). The internal
  `seedCatalog` / `seedPreview` do not consult it. `VITE_ENABLE_SAMPLE_DATA`
  (the Settings panel) follows the same rule; `import.meta.env.DEV` implies it.
- **Preview Convex backends inherit nothing** from dev or prod: each PR gets a
  fresh deployment, so a server variable a preview needs (`CLERK_JWT_ISSUER_DOMAIN`
  above all) must be a preview default, `convex env default set --type preview`.
- **`VITE_*` and `EXPO_PUBLIC_*` are public**: inlined into bundles. Test-user
  credentials therefore belong to the Clerk *test* instance only.
- **OAuth providers** (Notion, Todoist) register the redirect URI
  `<app-origin>/integrations/callback` (`http://localhost:3000/integrations/callback`
  in dev). Without their client id/secret, connecting fails with a clear
  "not configured" error and local task lists still work.
- `ANTHROPIC_API_KEY` is optional: without it, recipe import works only for
  pages with JSON-LD.

## Verify

- `pnpm env:check <target>` reports no missing required values.
