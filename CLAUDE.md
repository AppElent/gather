# gather

Gather is a Space-centered household-management app. A Space is a Gather-owned
Clerk Organization plus a Convex `spaces` record. The current live module is
Recipes; additional catalog entries are available only when their availability
becomes `live` and a Space has enabled them.

- **TanStack React Start + Router** (file-based routing, `tsr generate`), SSR, Vite.
- **Convex** backend (`convex/`) with Space authorization and lifecycle functions.
- **Clerk** auth (`@clerk/clerk-react`), JWT-bridged to Convex.
- **Cloudflare Workers**, Biome, Vitest, Tailwind v4, Sentry, and pnpm.

## Space model and routing

- Space URLs use `/s/:spaceSlug/home`, `/s/:spaceSlug/modules`,
  `/s/:spaceSlug/:module`, and `/s/:spaceSlug/settings/*`.
- `/account` remains user-global for the Clerk account profile. Legacy global
  bookmarks redirect through `LegacySpaceRedirect`; they are not navigation
  destinations.
- `SpaceRouteGate` activates the matching marked Clerk Organization and refreshes
  the Convex token before Space data renders.
- Clerk owns Organization membership and role authority. Gather authorizes only
  `org:admin` and `org:member` for marked Gather Organizations.

## Shared Clerk application safety

This Clerk application may serve other webapps. Gather never treats all Clerk
Organizations or invitations as its own: Gather resources use the public metadata
markers documented in `docs/setup/clerk-shared-application.md`. Only backend
administration actions create or mutate Gather Organizations; do not use Clerk's
frontend `createOrganization()` helper.

Organizations must remain membership-optional, Personal Accounts remain enabled,
and automatic first-Organization creation remains disabled. Do not rename,
remove, remap, or restrict shared Clerk roles. Additive `org_id` and `org_role`
claims may be added to the shared `convex` JWT template only after every known
consumer has passed before-and-after authenticated smoke tests. A failed or
incomplete compatibility inventory blocks the shared Clerk change and rollout.

## Modules and widgets

A new module must register catalog metadata, Space authorization, lifecycle
cleanup, Space-scoped routes, and optional widget definitions/renderers. Module
visibility is controlled by the Space module state; coming-soon modules belong
only in the admin module settings. Register deletion cleanup in the Space module
lifecycle so permanent Space deletion remains retryable.

## Development configuration

Use pnpm for every package command. Generate routes with `pnpm run
generate-routes`; the committed route tree is generated output. Before a
production-style reset, explicitly confirm the target deployment: destructive
Convex resets are not part of ordinary development or automated verification.

Client environment values live in `.env.local` (see `.env.example`). Convex
deployment values are set with `convex env set` and are never committed:
`CLERK_JWT_ISSUER_DOMAIN`, `CLERK_SECRET_KEY`,
`CLERK_WEBHOOK_SIGNING_SECRET`, and optional `ANTHROPIC_API_KEY`. Never commit
keys, webhook secrets, JWT bodies, or token values.

## Scripts

Use `pnpm run <script>`: `dev`, `dev:all`, `dev:watch`, `generate-routes`,
`build`, `typecheck`, `test`, `format`, `lint`, `check`, `cf-typegen`,
`deploy:dev`, and `deploy:prod`.

## Appelent-managed project

Opted-in features are recorded in `appelent.json`. Before adding functionality
that could apply to multiple apps, check the Appelent feature catalog first.
