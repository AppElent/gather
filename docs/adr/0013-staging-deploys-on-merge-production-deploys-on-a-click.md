# Staging deploys on merge, production deploys on a click

Status: accepted (2026-08-06)

`main` deploys itself to **staging**. Production deploys from the same workflow,
from the same branch, through the same steps — but only when somebody presses
**Run workflow**. There is no promotion pipeline, no release branch, and no
approval step behind the click.

**Dev is not a deployed environment.** Dev is `pnpm dev` against your own
`convex dev` deployment, on your own machine. The `gather-dev` Worker and
`deploy:dev` script still exist as a manual escape hatch, but no automation
touches them and nothing depends on them.

Credentials live in two **GitHub Environments**, `stg` and `production`, holding
the same secret names with different values. The job picks one with a single
expression on `github.event_name`.

## Why staging rather than a deployed dev

The first version of this pipeline deployed `main` to a dev environment backed by
the shared dev Convex deployment. That deployment is also somebody's `convex dev`
target, so every merge to `main` would push schema out from under whoever was
running the app locally. An environment that breaks a developer's session as a
side effect of someone else's merge is not an environment; it is a shared
mutable variable.

Staging has no such second owner. Nobody develops against it, so the only thing
that ever writes to it is the workflow.

## Why a named deployment rather than a second project

Convex's docs suggest a separate project for a permanent staging environment, and
that would work. A named deployment inside the existing project keeps schema,
functions, and dashboard in one place, and the CLI supports it directly — its own
help text uses this exact case as the example:

```
npx convex deployment create staging --type prod
```

`--type prod` is the load-bearing part. It yields a `prod:` deploy key, which
`convex deploy` accepts without qualification — unlike a `dev:` key, whose
behaviour under `convex deploy` is documented ambiguously enough that we would
have been guessing.

The trap is `--default`. Passing it would make `staging` the project's default
production deployment, and `pnpm run deploy:prod` on somebody's laptop would
then quietly deploy to staging while reporting success. It is deliberately
omitted, and that is the one setup step worth verifying afterwards rather than
assuming.

## Why staging builds in production mode

Both targets run `pnpm build`. Staging could have run `build:development` —
unminified, readable stack traces, easier to debug — but then staging would never
exercise the bundle production actually ships, and a minifier or tree-shaking bug
would reach production unseen. The point of staging is to be wrong in the same
ways production would be.

What differs between the two is env vars, not build mode. That is also what makes
the workflow a single job: one `pnpm build`, one set of steps, and four
expressions selecting values.

## Why the click is the gate

A required reviewer on `production` protects against a mis-click. The dispatch
*is* the click: choosing the workflow, choosing the branch, and pressing the
button is already three deliberate acts, and a ref guard fails the run if the
branch is not `main`. On a household app with one maintainer, an approval step
would be the same person approving their own action seconds later — ceremony that
teaches you to click through it.

This is the assumption most likely to expire. It expires the moment a second
person can deploy.

## Why the environments rather than suffixed secrets

`CONVEX_DEPLOY_KEY_STG` / `_PROD` at repo level would have worked, and would have
been fewer moving parts. Environments buy three things that matter more: the
workflow reads one name and stays a single job rather than two near-duplicates;
the Actions UI gains a deployment history per target, which is the only place
anyone will look when asking "what is on prod right now"; and a required reviewer
becomes a settings change rather than a workflow change if the dispatch click
ever stops feeling like enough.

The cost is a shadowing rule that is invisible in the file: an environment secret
wins over a repo secret of the same name. Three different `CONVEX_DEPLOY_KEY`
values now coexist — staging's, production's, and the repo-level `preview:` key —
and they stay apart only because `preview.yml` declares no `environment:`. Giving
it one would point every PR preview at a real backend without failing. That trap
is called out in `CLAUDE.md` and in `deploy.yml` itself, because nothing enforces
it.

## Why CI does not call `deploy:dev` / `deploy:prod`

The npm scripts and the workflow do the same four things in the same order —
Convex deploy, Catalog seed, build, Worker deploy — and it is genuinely annoying
that they are written twice.

They cannot be shared. Both scripts read `VITE_CONVEX_URL` from `.env.local`,
whereas CI has to *learn* the URL from the deploy it just performed — which is
what `convex deploy --cmd-url-env-var-name CONVEX_URL --cmd '…'` is for, and that
flag only makes sense wrapped around the build. `deploy:dev` additionally starts
with `convex dev --once`, which needs an interactive Convex login CI does not
have. Making one script serve both would mean making the local path worse to
match a constraint only CI has.

So the scripts stay the manual escape hatch and the workflow owns the automated
path. There is deliberately no `deploy:stg` script: it would read a
`VITE_CONVEX_URL` from `.env.local` that points somewhere else entirely, and
deploy a staging Worker built against a developer's own backend.

## Consequences

`ci.yml` no longer runs on push. It had been declaring `push: [master]` against a
branch that never existed, so in practice nothing changes except that the
declaration now matches reality — `deploy.yml`'s `checks` job is what gates
`main`, and it runs the same suite.

The Catalog seed is a step between the Convex deploy and the Worker deploy, for
the reason [ADR 0004](./0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)
gives: Convex has no post-deploy hook outside previews. It is still not atomic
with the deploy. A failed seed now leaves a deployed backend and an un-flipped
Worker, which is a slightly better failure than the local scripts produce.

The staging deployment inherits nothing. It is prod-*type*, so the preview-type
env var defaults do not reach it, and `CLERK_JWT_ISSUER_DOMAIN` and
`ENABLE_SAMPLE_DATA` have to be set on it explicitly. `ENABLE_SAMPLE_DATA` being
safe here is not a contradiction of the standing "never on production" rule —
that rule is about the deployment holding real households, not about the type
label.

`VITE_ENABLE_SAMPLE_DATA` and the test-user credentials are set on the staging
build and deliberately absent from the production one. Vite inlines every `VITE_*`
var into the client bundle, so "absent from production" is the whole mechanism —
there is no runtime check to fall back on.
