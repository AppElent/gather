---
type: runbook
description: Read when deploying gather, changing deploy.yml or the deploy scripts, or adding reference data a deploy must seed.
version: 1.4.0
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
| Workflow | `.github/workflows/deploy.yml`: push to `main` → `stg`; **Actions → Deploy → Run workflow** on `main` → `production` (the job refuses another ref) |
| Workers (`wrangler.jsonc`) | `gather` (production), `gather-stg` (`gather-stg.appelent.nl`), `gather-dev` (manual `deploy:dev` only), `gather-pr-<N>` ([previews](previews.md)) |
| Credentials | GitHub Environments `stg` and `production`; which names exist where is declared in `env.manifest.ts` and checked by the workflow's `Check environment` step before anything ships |
| Build | Both targets run `pnpm build`; they differ only in environment values and `CLOUDFLARE_ENV` (`stg`, or empty for production), which the Cloudflare Vite plugin reads at build time to pick the Worker. `wrangler deploy --env` is ignored after such a build, so the job checks the name in `dist/server/wrangler.json` before deploying |
| Checks | The `checks` job calls `ci.yml` (`workflow_call`), the same suite as pull requests; it gets no secrets, so its build uploads no source maps |
| Dev | Local: `pnpm dev:watch` against your own `convex dev` deployment |

## Seeding is a deploy step

Convex has no post-deploy hook outside previews, so the Catalog seed is a
separate step after `convex deploy` and before the Worker flips — the only
deterministic place for it. `pnpm deploy:dev` / `deploy:prod` and `pnpm seed`
run `seed:seedCatalog` **and** `seed:seedTastingCatalog`, as do the two seed steps
in `deploy.yml`, which run on production only. Reference data a new Module needs gets its own seed step here and
in the scripts ([seed data](../contracts/seed-data.md)).

## Verify

- The workflow run is green and the Worker URL serves the new build.
- `pnpm exec convex run seed:seedCatalog --prod` is idempotent: rerunning it
  reports no changes.
