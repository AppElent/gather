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

Copy `.env.example` to `.env.local` and fill in the values, then:

```bash
pnpm install
pnpm dev
```

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

This project uses the Cloudflare Vite plugin (configured in `vite.config.ts`) and `wrangler.jsonc`. The worker is named `gather` in production and `gather-dev` for the dev environment.

1. Authenticate: `pnpm exec wrangler login`
2. Deploy to prod: `pnpm run deploy:prod` (runs `convex deploy && vite build && wrangler deploy`)
3. Deploy to dev: `pnpm run deploy:dev` (runs `convex dev --once && vite build --mode development && wrangler deploy --env dev`)

For production env vars, run `wrangler secret put MY_VAR` for each secret listed in `.env.example`. Public (non-secret) vars go in `wrangler.jsonc` under `vars`. Convex-side vars (e.g. `CLERK_JWT_ISSUER_DOMAIN`) are set separately with `pnpm exec convex env set`.

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

- Set the `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT` environment variables in your `.env.local`. (Or run `pnpm exec convex init` to set them automatically.)
- Run `pnpm exec convex dev` to start the Convex server (or `pnpm dev:watch` to run Convex and Vite together).
- Backend functions live in `convex/` (`recipes.ts`, `groups.ts`, `users.ts`, `lib/sharing.ts`); schema is in `convex/schema.ts`.

## Typed environment variables

`src/env.ts` uses [`@t3-oss/env-core`](https://env.t3.gg/) to validate environment variables. Add new vars to its `server`/`client` schemas, then use them via:

```ts
import { env } from '../env'

console.log(env.VITE_APP_TITLE)
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing under `src/routes/`. After adding or renaming a route file, run `pnpm run generate-routes` to regenerate `src/routeTree.gen.ts`.
