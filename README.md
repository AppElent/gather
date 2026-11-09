# gather

A household-management app — recipes and groups today, with a growing set of
modules for meal planning, groceries, pantry, recurring costs, shared costs,
savings goals, tasks, calendar, notes, cheeses, and wines.

Built on TanStack React Start + Router, Convex, Clerk, and Cloudflare Workers.
Agent and contributor guidance starts at [AGENTS.md](./AGENTS.md); project rules
are in [CODING_STANDARDS.md](./CODING_STANDARDS.md) and the [docs map](./docs/README.md).

## Getting Started

This project uses **pnpm** — install it via Corepack if you don't have it
(`corepack enable`). Every dependency comes from the public npm registry, so
no token is needed. Then:

```bash
pnpm install
infisical login              # select EU Cloud (first use only)
pnpm run env:apply local --only file   # writes web/mobile local files and .dev.vars
pnpm dev
```

`.env.local`, `apps/mobile/.env.local`, and `.dev.vars` are generated. A new
worktree gets them from the `t3.json` setup hook
(`node scripts/workspace.mjs prepare --editor t3`), never by copying another
checkout's files. Edit values in the Infisical project selected by the committed
`.infisical.json`, then rerun `env:apply`. To find missing source or destination values, run
`pnpm run env:check local`. See "Environment variables" below.

`pnpm dev` starts only the Vite frontend. Use `pnpm dev:watch` to run Convex
and Vite together (needed for anything that touches the backend).

## Building For Production

```bash
pnpm build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
pnpm run lint
pnpm run format
pnpm run check
```

## Deploy to Cloudflare Workers

This project uses the Cloudflare Vite plugin (configured in `vite.config.ts`) and `wrangler.jsonc`. The worker is named `gather` in production and `gather-stg` for staging (Wrangler env `staging`).

**CI is the normal path** — see `.github/workflows/deploy.yml`:

- **staging** — every merge to `main` deploys the `gather-stg` Worker automatically, at `gather-stg.appelent.nl`. It runs on the production Convex deployment and real data ([ADR 0039](docs/adr/0039-staging-is-a-frontend-on-the-production-backend.md)).
- **production** — **Actions → Deploy → Run workflow** on `main`. The click is the gate for both the Worker and every Convex change; there is no separate approval step.

Both run `check` / `typecheck` / `test` first. Production then runs `convex deploy`, `convex run seed:seedTastingCatalog` and `wrangler deploy`; staging builds and runs `wrangler deploy` only, so a staging feature that needs new Convex functions fails until production deploys. Both build with `pnpm build`: staging runs the same production bundle prod does, and sample data and the test-login button are absent from both. Credentials live in the `staging` and `production` GitHub Environments (see [deploy](docs/runbooks/deploy.md)).

**Dev is local.** There is no deployed dev environment — dev is `pnpm dev` against your own `convex dev` deployment. The `gather-dev` Worker and `deploy:dev` script below still work, but nothing automated touches them.

Deploying by hand is still possible and is what the npm scripts are for. `deploy:staging` and `deploy:production` run the same steps as `deploy.yml` through `node scripts/env.mjs exec <environment> --only github`, which adds that GitHub Environment's values from Infisical to the one command and writes no file:

1. Deploy to staging: `pnpm run deploy:staging` (`CLOUDFLARE_ENV=staging pnpm build && wrangler deploy`)
2. Deploy to prod: `pnpm run deploy:production` (`convex deploy` building with the deployed URL, then `convex run seed:seedTastingCatalog` and `wrangler deploy`)
3. Deploy to dev: `pnpm run deploy:dev` (runs `convex dev --once && convex run seed:seedTastingCatalog && CLOUDFLARE_ENV=dev pnpm run build:development && wrangler deploy`). There is no `dev` environment, so it reads `VITE_*` from your `.env.local` and needs `wrangler login` and an interactive Convex login.

Vite still fills any `VITE_*` the selected environment does not set from `.env.local`.

Don't set Worker secrets or Convex env vars by hand — `pnpm run env:apply <environment>` writes both, along with the GitHub secrets and variables, from `env.manifest.ts`. `wrangler.jsonc` has no `vars` block: everything the client needs is a `VITE_*` var inlined into the bundle at build time, so a Worker runtime binding would never be read.

KV, D1, R2, and Durable Object bindings are configured in `wrangler.jsonc` — see https://developers.cloudflare.com/workers/wrangler/configuration/.

## Auth (Clerk)

Sign-in/sign-up/forgot-password forms, the account profile panel, appearance
settings, and the header user menu are app-owned in `src/lib/auth/`, used by
`src/routes/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`,
`_app/account.tsx` and `components/app/Topbar.tsx`. `src/integrations/clerk/provider.tsx`
wraps the app in a plain `<ClerkProvider>`.

1. Sign up at [clerk.com](https://clerk.com) and create an application
2. Store the publishable key as `clerk-publishable-key` in Infisical root and run
   `pnpm run env:apply local`.
3. Visit `/sign-in` once `pnpm dev` is running

Routes under `src/routes/_app/*` are protected: `src/routes/_app.tsx` redirects
to `/sign-in` when there's no authenticated Convex session. In dev, setting
`VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` (alongside a `pk_test_...` key)
shows a "Dev: log in as test user" button on the sign-in screen.

## Setting up Convex

- Every developer has their own Convex dev deployment. Store its identifiers as `convex-deployment` and `convex-url` under Infisical `/gather`, then run `pnpm run env:apply local`.
- Run `pnpm exec convex dev` to start the Convex server (or `pnpm dev:watch` to run Convex and Vite together).
- Backend functions live in `convex/` (`recipes.ts`, `groups.ts`, `users.ts`, `lib/sharing.ts`); schema is in `convex/schema.ts`.

## Environment variables

`env.manifest.ts` is the single source of truth. An entry declares **who reads**
a value — the Vite build, a Worker server function, a Convex function, the
workflow — and which environments need it; the shared routing in
[environments](docs/standards/environments.md) derives *where* it has to be
written. `.env.example` is generated from it.

```bash
pnpm run env:check                 # manifest consistency + .env.example freshness
pnpm run env:check local           # what's missing, and where
pnpm run env:plan local --only file # inspect local file writes without applying
pnpm run env:apply local --only file # rewrite the generated local files
pnpm run env:plan preview --pr 12  # preview Worker values need the PR number
pnpm run env:generate              # regenerate .env.example
pnpm run env:exec production --only github -- <command>  # one command with deployed values
```

Values live in the Infisical project linked by `.infisical.json`. Shared values
are in project root; Gather-specific values are under `/gather` and override a
same-named root value. `local` reads Infisical `dev`, `preview` and `staging` read
`staging`, and `production` reads `prod`. `apply` never writes an empty value
and never deletes without `--prune`.

The commands run `scripts/env.mjs`, the engine vendored from developer-tools
(`scripts/lib/env/`, refreshed by `node scripts/sync-devtools.mjs`). Gather owns the
entries and config in `env.manifest.ts`; the engine owns the shared routing, source
parsing, validation, planning, and destination writers. Infisical JSON is captured in
memory; no Infisical-generated dotenv files or raw export files are created.
Use `pnpm run env:apply local --only file` when shared EAS/GitHub settings must
stay outside the operation. Required missing values fail before writes, and
missing optional values preserve existing generated values.

The writer accepts its own generated headers and Gather's previous env writer
headers. Human-owned files require an explicit review and ownership adoption
before applying; `apply` does not take them over automatically. Successful
writes record names and destinations only in ignored `.appelent/env-state.json`.
`--prune` removes only recorded retired keys, preserving active routes and other
owners. Entirely retired destinations and untracked provider keys require manual
retirement. Production pruning needs a typed confirmation or `--yes`.

Adding a variable means adding it to the manifest — there is nowhere else. Two
mistakes the types refuse: marking a value the Vite build reads as `secret`
(the build inlines it into a public bundle), and giving it a name without the
`VITE_` prefix (Vite would never deliver it).

Nothing validates variables when the app starts. The app reads `import.meta.env.*`
and the Worker's server functions read `process.env.*` directly, each handling an
absent value itself; `pnpm run env:check` is what holds an environment to the manifest.

See [ADR 0014](./docs/adr/0014-a-variable-declares-its-consumer-not-its-destination.md).

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing under `src/routes/`. After adding or renaming a route file, run `pnpm run generate-routes` to regenerate `src/routeTree.gen.ts`.
