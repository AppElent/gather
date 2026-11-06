---
type: decision
description: Read before giving staging a Convex deploy key or Convex variables, or adding sample data or test users to it.
version: 1.0.0
status: accepted
date: 2026-11-06
---

# Staging is a frontend on the production backend

`gather-stg` talks to the production Convex deployment. A merge to `main` builds
and ships that Worker and nothing else. `convex deploy` and the Catalog seeds run
only on the production click.

The owner chose one Convex deployment over the named staging deployment
[ADR 0013](./0013-staging-deploys-on-merge-production-deploys-on-a-click.md)
describes: a second one was never created, and a staging environment for a
one-maintainer household app does not earn its upkeep.

## Why a merge does not deploy the backend

The alternative was to hand stg the production deploy key and leave the workflow
alone. Every merge would then have changed the schema and functions real
households use while the production Worker stayed on the old build, with no click
in between. The workflow withholds the key from a stg job, which makes that impossible
rather than discouraged, even if a repo secret of the same name exists.

The cost is that staging cannot run a change that needs new Convex functions: such
a page fails there until production deploys. Staging tests frontend changes only.

## What follows from sharing the deployment

- **Staging reads and writes real data.** Anything done there is done to the real
  household.
- **No sample data or test user.** Their absence is what keeps fake households out
  of real data, so stg now omits them as production does.
- **Production owns the deployment's variables.** `destinationFor` has no Convex
  destination for stg, so no apply can set a staging value on real households.
- **Staging uses production Clerk.** The deployment trusts one issuer, and the
  production instance refuses origins outside `appelent.nl`, so the Worker gets the
  custom domain `gather-stg.appelent.nl` instead of relying on `workers.dev`.
