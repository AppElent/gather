---
type: runbook
description: Read when changing the PR preview workflow, its secrets, or what a preview seeds.
version: 2.0.0
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
| Worker | `gather-pr-<N>`, URL posted as a PR comment |
| Repo-scoped names | Carry the `PREVIEW_` prefix (`PREVIEW_CONVEX_DEPLOY_KEY`, `PREVIEW_VITE_CLERK_PUBLISHABLE_KEY`, `PREVIEW_VITE_TEST_USER_*`, `PREVIEW_VITE_SENTRY_*`, `PREVIEW_SENTRY_AUTH_TOKEN`, `PREVIEW_GITHUB_ISSUES_TOKEN`) so they cannot shadow or be shadowed by `stg`/`production` Environment values |
| Test login | `VITE_TEST_USER_*` are build-time only and inlined into the client bundle, so the test user lives on the Clerk *test* instance |

## Hazards

- **`--preview-run` takes no arguments.** `seedPreview` therefore hardcodes the
  Clerk test user's subject as `PREVIEW_TEST_USER` in `convex/seed.ts`. If that
  Clerk user is ever recreated, update the constant or previews seed a
  household nobody can sign into.
- **`preview.yml` declares no `environment:`.** That is what keeps preview,
  `stg` and `production` values apart; giving the job one would point every PR
  preview at a real backend without failing.
- **A preview backend inherits no Convex variables** — server values come from
  preview defaults ([environment](environment.md#hazards)).
- The `|| secrets.<old name>` fallbacks in the workflow are a transition shim;
  they go once `pnpm env:check preview` reports no missing values.

## Verify

- The PR comment links a Worker where test login lands in a populated Sample
  household.
