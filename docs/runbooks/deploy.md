---
type: runbook
description: Read when deploying gather, changing deploy.yml or the deploy scripts, or adding reference data a deploy must seed.
version: 4.0.0
---

# Deploy

Every merge deploys staging, then production, then publishes the preview app
update, in one run ([ADR-0044](../adr/0044-every-merge-ships-and-the-app-updates-daily.md)).
Staging is a frontend on the production Convex deployment, so only the
production job changes the backend ([ADR-0039](../adr/0039-staging-is-a-frontend-on-the-production-backend.md)).
The gate is the merge: a `high` change, or one that could break installed app
builds, merges only after the owner's decision card. Commands for a deploy by
hand are in the [README](../../README.md#deploy-to-cloudflare-workers).

## Project facts

| Fact | Value |
| --- | --- |
| Workflow | `.github/workflows/deploy.yml`: push to `main` → `checks` → `staging` → `production` → `mobile` (preview app update, [mobile releases](mobile-releases.md)). Each web target runs `deploy-web.yml`. **Run workflow** on `main` redeploys the same chain; from another ref it stops before production |
| Smoke check | After each Worker deploy: the custom domain (`gather-stg.appelent.nl`, `gather.appelent.nl`) answers, and `/version` reports the commit the job built |
| `/version` | `GET /version` on any Worker returns `app`, `version` (`apps/mobile/app.json`), `commit`, `environment`, `deployedAt`, `release` (`src/lib/release/version.ts`, values inlined by `vite.config.ts`) |
| Workers (`wrangler.jsonc`) | `gather` (production), `gather-staging` (Wrangler env `staging`, `gather-stg.appelent.nl`), `gather-dev` (manual `deploy:dev` only), `gather-pr-<N>` (Wrangler env `pr`, [previews](previews.md)) |
| Credentials | GitHub Environments `staging` and `production`, written by `pnpm env:apply <environment> --only github`; which names exist where is declared in `env.manifest.ts` and checked by the workflow's `Check environment` step before anything ships. Secrets are read from `secrets.`, public values (including `CLOUDFLARE_ACCOUNT_ID`) from `vars.` |
| Build | Both targets run `pnpm build`; they differ only in environment values and `CLOUDFLARE_ENV` (`staging`, or empty for production), which the Cloudflare Vite plugin reads at build time to pick the Worker. `wrangler deploy --env` is ignored after such a build, so the `Guard Worker name` step compares `dist/server/wrangler.json` with `EXPECTED_WORKER` before deploying |
| By hand | `pnpm deploy:staging` / `pnpm deploy:production` run the same steps through `env.mjs exec <environment> --only github`, with the GitHub Environment's values read from Infisical, so neither needs `wrangler login`. `exec` sets every `.env.local` name it does not supply to `""`, which the app reads as off, so Vite cannot fill a missing `VITE_*` from `.env.local` |
| Checks | The `checks` job calls `ci.yml` (`workflow_call`), the same suite as pull requests; it gets no secrets, so its build uploads no source maps |
| Dev | Local: `pnpm dev:watch` against your own `convex dev` deployment |

## Seeding is a deploy step

Convex has no post-deploy hook outside previews, so the Catalog seed is a
separate step after `convex deploy` and before the Worker flips — the only
deterministic place for it. `pnpm deploy:dev` / `deploy:production` and `pnpm seed`
run `seed:seedTastingCatalog` and `seed:seedRetailerCatalog`, as do the seed
steps in `deploy-web.yml`, which run on production only. Reference data a new Module needs gets its own seed step here and
in the scripts ([seed data](../contracts/seed-data.md)).

## Verify

- The workflow run is green: staging, production and their smoke checks.
- `curl https://gather.appelent.nl/version` reports the commit at `main`.
- `pnpm exec convex run seed:seedTastingCatalog --prod` and
  `seed:seedRetailerCatalog --prod` are idempotent: rerunning either reports
  no inserts or retirements, and a rerun of `seed:seedRetailerCatalog` also
  reports `updated: 0` (every row `unchanged`).
