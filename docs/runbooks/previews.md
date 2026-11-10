---
type: runbook
description: Read when changing the PR preview workflow, its secrets, or what a preview seeds.
version: 3.0.0
---

# Previews

Binds the shared [previews](../standards/previews.md) standard. A same-repo PR
labelled `preview:web` gets its own Convex backend and Worker.

## Project facts

| Fact | Value |
| --- | --- |
| Workflow | `.github/workflows/preview.yml` |
| Trigger | Opt-in: adding the `preview:web` label deploys, pushes redeploy while it stays; removing the label or closing the PR deletes the Worker |
| Backend | `convex deploy --preview-create pr-<N> --preview-run seed:seedPreview` |
| Worker | `gather-pr-<N>`, built with `CLOUDFLARE_ENV=pr` (the route-free Wrangler env), URL posted as a PR comment |
| Repository-scope names | `PREVIEW_<name>`, written by `pnpm env:apply preview --only github` from Infisical `staging`, so they cannot shadow or be shadowed by `staging`/`production` Environment values. The workflow maps each back to `<name>`: secrets from `secrets.`, public values from `vars.` |
| Worker runtime values | The issue reporter's token and repository name land on `workflow` for preview too; the `Apply Worker runtime values` step writes them to the per-PR Worker with `env.mjs apply preview --ci --only worker --pr <N>`. `GITHUB_REPOSITORY_OWNER` is the runner's own |
| Auth | Clerk development instance (`pk_test_`), because previews are short-lived: `clerk-publishable-key` and `clerk-jwt-issuer-domain` in Infisical `staging` reference the `dev` values. Test-user values never reach previews, because `VITE_*` is public in the bundle, so the test-login button stays hidden |

## Hazards

- **`--preview-run` takes no arguments.** `seedPreview` therefore hardcodes the
  Clerk test user's subject as `PREVIEW_TEST_USER` in `convex/seed.ts`. That
  user lives on the development instance previews sign in through; enter its
  credentials by hand to reach the seeded household.
- **`preview.yml` declares no `environment:`.** That is what keeps preview,
  `staging` and `production` values apart; giving the job one would point every
  PR preview at a real backend without failing.
- **The preview backend must trust the development issuer.** Its
  `CLERK_JWT_ISSUER_DOMAIN` is a Convex preview default, written from
  `clerk-jwt-issuer-domain` (Infisical `staging`) by
  `pnpm env:apply preview --only convex`.
- **A preview backend inherits no Convex variables** — server values come from
  preview defaults ([environment](environment.md#hazards)).

## Verify

- The PR comment links a Worker where a development-instance Clerk account,
  such as the test user, signs in.
- `jq .routes dist/server/wrangler.json` after a preview build shows no routes.
