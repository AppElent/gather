---
type: runbook
description: Read when deploying gather, changing deploy.yml or the deploy scripts, or adding reference data a deploy must seed.
version: 1.0.0
---

# Deploy

Staging deploys on merge and production on a click
([ADR-0013](../adr/0013-staging-deploys-on-merge-production-deploys-on-a-click.md)).
Commands for a deploy by hand are in the [README](../../README.md#deploy-to-cloudflare-workers).

## Project facts

| Fact | Value |
| --- | --- |
| Workflow | `.github/workflows/deploy.yml`: push to `main` → `stg`; **Actions → Deploy → Run workflow** on `main` → `production` (the job refuses another ref) |
| Workers (`wrangler.jsonc`) | `gather` (production), `gather-stg`, `gather-dev` (manual `deploy:dev` only), `gather-pr-<N>` ([previews](previews.md)) |
| Credentials | GitHub Environments `stg` and `production`; which names exist where is declared in `env.manifest.ts` and checked by the workflow's `Check environment` step before anything ships |
| Build | Both targets run `pnpm build`; they differ only in environment values |
| Dev | Local: `pnpm dev:watch` against your own `convex dev` deployment |

## Seeding is a deploy step

Convex has no post-deploy hook outside previews, so the Catalog seed is a
separate step after `convex deploy` and before the Worker flips — the only
deterministic place for it. `pnpm deploy:dev` / `deploy:prod` and `pnpm seed`
run `seed:seedCatalog` **and** `seed:seedTastingCatalog`. `deploy.yml` runs only
`seed:seedCatalog`: CI deploys do not reconcile the tasting Catalog (open
follow-up). Reference data a new Module needs gets its own seed step here and
in the scripts ([seed data](../contracts/seed-data.md)).

## Verify

- The workflow run is green and the Worker URL serves the new build.
- `pnpm exec convex run seed:seedCatalog --prod` is idempotent: rerunning it
  reports no changes.
