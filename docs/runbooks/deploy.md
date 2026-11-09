---
type: runbook
description: Read when deploying gather, changing deploy.yml or the deploy scripts, or adding reference data a deploy must seed.
version: 3.0.0
---

# Deploy

Staging deploys on merge and production on a click
([ADR-0013](../adr/0013-staging-deploys-on-merge-production-deploys-on-a-click.md)).
Staging is a frontend on the production Convex deployment, so only the click
changes the backend ([ADR-0039](../adr/0039-staging-is-a-frontend-on-the-production-backend.md)).
Commands for a deploy by hand are in the [README](../../README.md#deploy-to-cloudflare-workers).

## Project facts

| Fact | Value |
| --- | --- |
| Workflow | `.github/workflows/deploy.yml`: push to `main` → `staging`; **Actions → Deploy → Run workflow** on `main` → `production` (the job refuses another ref) |
| Workers (`wrangler.jsonc`) | `gather` (production), `gather-stg` (Wrangler env `staging`, `gather-stg.appelent.nl`), `gather-dev` (manual `deploy:dev` only), `gather-pr-<N>` (Wrangler env `pr`, [previews](previews.md)) |
| Credentials | GitHub Environments `staging` and `production`, written by `pnpm env:apply <environment> --only github`; which names exist where is declared in `env.manifest.ts` and checked by the workflow's `Check environment` step before anything ships. Secrets are read from `secrets.`, public values (including `CLOUDFLARE_ACCOUNT_ID`) from `vars.` |
| Build | Both targets run `pnpm build`; they differ only in environment values and `CLOUDFLARE_ENV` (`staging`, or empty for production), which the Cloudflare Vite plugin reads at build time to pick the Worker. `wrangler deploy --env` is ignored after such a build, so the `Guard Worker name` step compares `dist/server/wrangler.json` with `EXPECTED_WORKER` before deploying |
| By hand | `pnpm deploy:staging` / `pnpm deploy:production` run the same steps through `env.mjs exec <environment> --only github`, with the GitHub Environment's values read from Infisical, so neither needs `wrangler login`. Until the developer-tools #53 sync, Vite still fills any `VITE_*` the environment does not set from `.env.local`; after it, `exec` sets every `.env.local` name it does not supply to `""`, which the app reads as off |
| Checks | The `checks` job calls `ci.yml` (`workflow_call`), the same suite as pull requests; it gets no secrets, so its build uploads no source maps |
| Dev | Local: `pnpm dev:watch` against your own `convex dev` deployment |

## Seeding is a deploy step

Convex has no post-deploy hook outside previews, so the Catalog seed is a
separate step after `convex deploy` and before the Worker flips — the only
deterministic place for it. `pnpm deploy:dev` / `deploy:production` and `pnpm seed`
run `seed:seedTastingCatalog`, as does the seed step in `deploy.yml`, which runs
on production only. Reference data a new Module needs gets its own seed step here and
in the scripts ([seed data](../contracts/seed-data.md)).

## Verify

- The workflow run is green and the Worker URL serves the new build.
- `pnpm exec convex run seed:seedTastingCatalog --prod` is idempotent: rerunning it
  reports no changes.
