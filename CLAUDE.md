# gather

A household-management app (Recipes, groups, and a growing set of placeholder
modules — meal planner, groceries, pantry, finances, bills, tasks, calendar, notes,
cheeses, wines) built on the standard AppElent stack:

- **TanStack React Start + Router** (file-based routing, `tsr generate`), SSR, Vite.
- **Convex** backend (`convex/`) — functions: `recipes.ts`, `groups.ts`, `users.ts`,
  `lib/sharing.ts`. Schema in `convex/schema.ts`.
- **Clerk** auth (`@clerk/clerk-react`), JWT-bridged to Convex via `CLERK_JWT_ISSUER_DOMAIN`
  (Convex deployment env var, set with `convex env set` — not committed anywhere).
- **Cloudflare Workers** deploy via `wrangler.jsonc` — worker name `gather`
  (prod) / `gather-dev` (dev env block).
- **Biome** for lint/format (tab-free, 2-space, single quotes, semicolons as needed).
- **Vitest** + jsdom + Testing Library.
- **Tailwind v4**.
- **`@t3-oss/env-core`** for typed env validation (`src/env.ts`, currently minimal —
  not yet wired to the Clerk/Convex/Sentry vars actually in use).
- **Sentry** (`@sentry/tanstackstart-react`, wired via `instrument.server.mjs`).
- **Package manager: pnpm, always.**

## Dependency status

`@appelent/auth` is integrated: sign-in/sign-up/forgot-password forms, the account
profile panel, appearance settings, header user menu, and theme sync all come from
the shared package (see `src/routes/__root.tsx`, `src/routes/sign-in.tsx`,
`src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`,
`src/routes/_app/account.tsx`, `src/routes/_app/settings.tsx`,
`src/components/app/Topbar.tsx`). Per the package's own design, this app still owns
`src/integrations/clerk/provider.tsx` (plain `ClerkProvider`, with `signInUrl`/
`signUpUrl` pointed at gather's routes) and the Clerk↔Convex JWT bridge in
`src/integrations/convex/provider.tsx` — `@appelent/auth` does not export either of
those. `src/styles.css` overrides the package's `--auth-*` tokens to match gather's
sea/lagoon palette, and defines `.rm-panel`/`.rm-label` (used by `ProfilePanel`/
`AppearanceSettings` but not shipped in `tokens.css`) to match the app's
`.demo-panel`/`.demo-section-title` card styling.

Known limitation (not fixable from gather): `AppearanceSettings`'s copy hardcodes
"Choose how ArchStudio looks." regardless of `useAuthConfig().appName` — a bug in
the shared package itself, out of scope here.

## Scripts

Standard baseline set (`pnpm run <script>`): `dev`, `dev:all` (Convex once + Vite),
`dev:watch` (Convex watch + Vite via `concurrently`), `generate-routes`, `build`,
`build:development`, `preview`, `typecheck`, `test`, `format`, `lint`, `lint:fix`,
`check`, `cf-typegen`, `deploy` (= `deploy:prod`), `deploy:dev`, `deploy:prod`.
No `seed` script — `convex/seed.ts` doesn't exist.

## Env vars

Client (`.env.local`, see `.env.example` for the full documented list):
`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_TEST_USER_EMAIL`, `VITE_TEST_USER_PASSWORD`
(the latter two enable `@appelent/auth`'s dev-only test-login button when the
Clerk key is `pk_test_...`), `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`,
`VITE_SENTRY_DSN`, `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

Convex deployment (server-side, set via `convex env set` / `convex env default set`,
never in a committed file): `CLERK_JWT_ISSUER_DOMAIN` — set on dev, prod, and as the
default for preview deployments (PR previews create a fresh Convex backend per PR
that doesn't inherit dev/prod env vars).

## CI / PR previews

- `.github/workflows/ci.yml` — check/typecheck/test/build gate on push to `master`
  and on PRs.
- `.github/workflows/preview.yml` — per-PR Convex preview deployment + per-PR
  Cloudflare Worker (`gather-pr-<N>`) + PR comment + teardown on close. **This repo
  has no GitHub remote yet** — once pushed, set repo secrets: `CONVEX_DEPLOY_KEY`
  (Preview-kind deploy key), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `PREVIEW_CLERK_PUBLISHABLE_KEY`, optionally `NODE_AUTH_TOKEN`.

## Claude Code workflow layer

`.claude/skills/review-app`, `.claude/skills/review-session`, and
`.claude/commands/upgrade-deps.md`/`review-session.md` are project-local copies of
the global `~/.claude/skills/custom-review-app` / `custom-review-session` /
`~/.claude/commands/custom-upgrade-deps.md` / `custom-review-session.md` templates
(renamed to avoid the duplicate-skill collision). **The global copies are the source
of truth** — a non-project-specific fix made locally should be ported back to the
global file, not left to drift. `.claude/skills/verify/SKILL.md` is the one
exception: it's project-specific by design (gather's actual route→module map) and
has no global counterpart.

<!-- appelent-managed:start -->
## Appelent Managed Project

This repo follows the shared Appelent project baseline.

Source of truth:
- `C:\Users\ericj\.claude\appelent\projects.json`
- `C:\Users\ericj\.claude\appelent\capabilities.json`
- `C:\Users\ericj\.claude\skills`

Web/browser fallback:
- `.claude\appelent`
- `.claude\skills`

Before adding functionality that could apply to multiple apps, check whether it belongs in:
- an existing or new `@appelent/*` package
- `custom-bootstrap`
- a capability skill such as `add-cli` or `add-i18n`

When functionality lives in an `@appelent/*` package, that package's own README is the tool-agnostic source of truth for using it — Codex and humans read it, and skills are Claude-only pointers to it, never the source.

If you add, remove, or generalize cross-app functionality, update the Appelent registry files or explain why no registry change is needed.
<!-- appelent-managed:end -->
