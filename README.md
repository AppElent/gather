# gather

A household-management app — recipes and groups today, with a growing set of
placeholder modules (meal planner, groceries, pantry, finances, bills, tasks,
calendar, notes, cheeses, wines) waiting to be built out.

Built on TanStack React Start + Router, Convex, Clerk, and Cloudflare Workers.
See [CLAUDE.md](./CLAUDE.md) for the full architecture and conventions.

## Getting Started

This project uses **pnpm** — install it via Corepack if you don't have it
(`corepack enable`). `@appelent/*` packages are published to a private GitHub
Packages registry; add a `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`
line to your **user-level** `~/.npmrc` (never the committed one) with a
`read:packages` token before installing.

Then:

```bash
pnpm install
pnpm run env:apply local   # writes .env.local and .dev.vars from env/
pnpm dev
```

Don't create `.env.local` by hand — it is generated. Public values are already
committed in `env/local.public.env`; put anything secret in
`env/local.secret.env` (git-ignored) and re-run `env:apply`. To find out what is
still missing, run `pnpm run env:check local`. See "Environment variables" below.

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

This project uses the Cloudflare Vite plugin (configured in `vite.config.ts`) and `wrangler.jsonc`. The worker is named `gather` in production and `gather-stg` for staging.

**CI is the normal path** — see `.github/workflows/deploy.yml`:

- **staging** — every merge to `main` deploys automatically.
- **production** — **Actions → Deploy → Run workflow** on `main`. The click is the gate; there is no separate approval step.

Both run `check` / `typecheck` / `test` first, then `convex deploy`, then `convex run seed:seedCatalog`, then `wrangler deploy`. Both build with `pnpm build`: staging runs the same production bundle prod does, and differs only in env vars (sample data and the test-login button are on for staging, absent from prod). Credentials live in the `stg` and `production` GitHub Environments (see the "CI / deploys / PR previews" section of `CLAUDE.md` for the secret layout).

**Dev is local.** There is no deployed dev environment — dev is `pnpm dev` against your own `convex dev` deployment. The `gather-dev` Worker and `deploy:dev` script below still work, but nothing automated touches them.

Deploying by hand is still possible and is what the npm scripts are for:

1. Authenticate: `pnpm exec wrangler login`
2. Deploy to prod: `pnpm run deploy:prod` (runs `convex deploy && convex run seed:seedCatalog --prod && pnpm run build && wrangler deploy`)
3. Deploy to dev: `pnpm run deploy:dev` (runs `convex dev --once && convex run seed:seedCatalog && pnpm run build:development && wrangler deploy --env dev`)

Both read `VITE_*` from your `.env.local`, and `deploy:dev` needs an interactive Convex login — which is why CI reimplements the pipeline instead of calling these.

There is deliberately no `deploy:stg` script, for the same reason: it would build against whatever `VITE_CONVEX_URL` your `.env.local` happens to hold. To reach staging by hand, export the staging `CONVEX_DEPLOY_KEY` and run the same steps `deploy.yml` does — `convex deploy --cmd-url-env-var-name CONVEX_URL --cmd '…pnpm build'`, then `wrangler deploy --env stg`.

Don't set Worker secrets or Convex env vars by hand — `pnpm run env:apply <environment>` writes both, along with the GitHub secrets and variables, from `env.manifest.ts`. `wrangler.jsonc` has no `vars` block: everything the client needs is a `VITE_*` var inlined into the bundle at build time, so a Worker runtime binding would never be read.

KV, D1, R2, and Durable Object bindings are configured in `wrangler.jsonc` — see https://developers.cloudflare.com/workers/wrangler/configuration/.

## Auth (Clerk + @appelent/auth)

Sign-in/sign-up/forgot-password forms, the account profile panel, appearance
settings, and the header user menu all come from the shared `@appelent/auth`
package (`src/routes/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`,
`_app/account.tsx`, `components/app/Topbar.tsx`). `src/integrations/clerk/provider.tsx`
wraps the app in a plain `<ClerkProvider>`.

1. Sign up at [clerk.com](https://clerk.com) and create an application
2. Copy the **Publishable Key** from the Clerk dashboard and set it in `.env.local`:
   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```
3. Visit `/sign-in` once `pnpm dev` is running

Routes under `src/routes/_app/*` are protected: `src/routes/_app.tsx` redirects
to `/sign-in` when there's no authenticated Convex session. In dev, setting
`VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` (alongside a `pk_test_...` key)
shows a "Dev: log in as test user" button on the sign-in screen.

## Setting up Convex

- Every developer has their own Convex dev deployment. Set `CONVEX_DEPLOYMENT` and `CONVEX_URL` in `env/local.public.env` to yours, then `pnpm run env:apply local`.
- Run `pnpm exec convex dev` to start the Convex server (or `pnpm dev:watch` to run Convex and Vite together).
- Backend functions live in `convex/` (`recipes.ts`, `groups.ts`, `users.ts`, `lib/sharing.ts`); schema is in `convex/schema.ts`.

## Environment variables

`env.manifest.ts` is the single source of truth. An entry declares **who reads**
a value — the Vite build, a Worker server function, a Convex function, the
workflow — and which environments need it; a table in that file derives *where*
it has to be written. Nothing else lists variable names: `src/env.ts` derives its
schemas from the manifest and `.env.example` is generated from it.

```bash
pnpm run env:check                 # manifest consistency + .env.example freshness
pnpm run env:check local           # what's missing, and where
pnpm run env:apply local           # write it everywhere it belongs
pnpm run env:generate              # regenerate .env.example
```

Values live in `env/<environment>.public.env` (committed — a Clerk publishable
key and a Convex URL are not secrets) and `env/<environment>.secret.env` (never
committed). `apply` never writes an empty value and never deletes anything
without `--prune`, so running it on a machine that lacks some secrets is safe:
it applies what it has and tells you the rest.

Adding a variable means adding it to the manifest — there is nowhere else. Two
mistakes the types refuse: marking a value the Vite build reads as `secret`
(the build inlines it into a public bundle), and giving it a name without the
`VITE_` prefix (Vite would never deliver it).

Read `env.ts` values as usual:

```ts
import { env } from '../env'

console.log(env.VITE_CONVEX_URL)
```

See [ADR 0014](./docs/adr/0014-a-variable-declares-its-consumer-not-its-destination.md).

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing under `src/routes/`. After adding or renaming a route file, run `pnpm run generate-routes` to regenerate `src/routeTree.gen.ts`.
