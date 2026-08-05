# Dev deploys on merge, production deploys on a click

Status: accepted (2026-08-05)

`main` deploys itself to the dev environment. Production deploys from the same
workflow, from the same branch, through the same steps — but only when somebody
presses **Run workflow**. There is no promotion pipeline, no release branch, and
no approval step behind the click.

Credentials live in two **GitHub Environments**, `dev` and `production`, holding
the same secret names with different values. The job picks one with a single
expression on `github.event_name`.

## Why the environments rather than suffixed secrets

`CONVEX_DEPLOY_KEY_DEV` / `CONVEX_DEPLOY_KEY_PROD` at repo level would have
worked, and would have been fewer moving parts. Environments buy three things
that matter more than that: the workflow reads one name and stays a single job
rather than two near-duplicates; the Actions UI gains a deployment history per
target, which is the only place anyone will look when asking "what is on prod
right now"; and a required reviewer becomes a settings change rather than a
workflow change if the dispatch click ever stops feeling like enough.

The cost is a shadowing rule that is invisible in the file: an environment
secret wins over a repo secret of the same name. Three different
`CONVEX_DEPLOY_KEY` values now coexist — `dev:`, `prod:`, and the repo-level
`preview:` key — and they stay apart only because `preview.yml` declares no
`environment:`. Giving it one would point every PR preview at a real backend
without failing. That trap is called out in `CLAUDE.md` and in `deploy.yml`
itself, because nothing enforces it.

## Why the click is the gate

A required reviewer on `production` protects against a mis-click. The dispatch
*is* the click: choosing the workflow, choosing the branch, and pressing the
button is already three deliberate acts, and the ref guard fails the run if the
branch is not `main`. On a household app with one maintainer, an approval step
would be the same person approving their own action seconds later — ceremony
that teaches you to click through it.

This is the assumption most likely to expire. It expires the moment a second
person can deploy.

## Why CI does not call `deploy:dev` / `deploy:prod`

The npm scripts and the workflow do the same four things in the same order —
Convex deploy, Catalog seed, build, Worker deploy — and it is genuinely annoying
that they are written twice.

They cannot be shared. `deploy:dev` starts with `convex dev --once`, which needs
an interactive Convex login that CI does not have. Both scripts read
`VITE_CONVEX_URL` from `.env.local`, whereas CI has to *learn* the URL from the
deploy it just performed — which is what `convex deploy --cmd-url-env-var-name
CONVEX_URL --cmd '…'` is for, and that flag only makes sense wrapped around the
build. Making one script serve both would mean making the local path worse to
match a constraint only CI has.

So the scripts stay the manual escape hatch and the workflow owns the automated
path. The duplication is real and will drift; the alternative was worse.

## Consequences

`ci.yml` no longer runs on push. It had been declaring `push: [master]` against
a branch that never existed, so in practice nothing changes except that the
declaration now matches reality — `deploy.yml`'s `checks` job is what gates
`main`, and it runs the same suite.

The Catalog seed is a step between the Convex deploy and the Worker deploy, for
the reason [ADR 0004](./0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)
gives: Convex has no post-deploy hook outside previews. It is still not atomic
with the deploy. A failed seed now leaves a deployed backend and an un-flipped
Worker, which is a slightly better failure than the local scripts produce.

The dev environment deploys to the **shared dev Convex deployment**, using a
`dev:` deploy key. That deployment is also somebody's `convex dev` target, so a
merge to `main` can push schema out from under a running local session. If that
becomes a problem the fix is a separate Convex project used as staging, which is
Convex's own recommendation for a permanent staging environment and which
changes only the value of a secret.

`VITE_ENABLE_SAMPLE_DATA` and the test-user credentials are set on the dev build
and deliberately absent from the production one. Vite inlines every `VITE_*` var
into the client bundle, so "absent from production" is the whole mechanism —
there is no runtime check to fall back on.
