---
type: decision
description: Read before changing when Gather deploys or publishes app updates, how a release is versioned, or the deploy and mobile update workflows.
version: 1.0.0
status: accepted
date: 2026-11-17
---

# Every merge ships, and the app updates daily

> Supersedes the click in [ADR 0013](./0013-staging-deploys-on-merge-production-deploys-on-a-click.md).
> Adopts the toolkit's release standard (`docs/standards/releases.md` in
> developer-home), which the owner approved on 17 Nov 2026.

## Decision

| Target | When it ships | Gate | Where |
| --- | --- | --- | --- |
| Web staging (`gather-staging`) | Every merge to `main` | CI `check` | `deploy.yml` → `deploy-web.yml` |
| Production Convex, seeds, Worker (`gather`) | Every merge, right after staging | Staging deployed and its smoke check passed | same run |
| Preview app (`preview` channel) | Every merge, after the production backend | Bundled files changed since `ota-preview`; runtime fingerprint matches a preview update or build | `mobile-update.yml` |
| Production app (`production` channel) | Daily, 06:17 UTC | Soaked 24 hours on preview, its Deploy run green, bundled files changed since `ota-production`, fingerprint matches | `mobile-update-production.yml` |
| Store build | Only for a native change, batched | The owner's decision card before submission | By hand ([mobile releases](../runbooks/mobile-releases.md)) |

- There is no click any more. The gate is the merge: a `high` change, or one
  that could break installed builds, waits for the owner's decision card
  before it merges. A manual **Run workflow** on Deploy redeploys `main`
  through the same chain.
- Staging still runs on the production Convex deployment
  ([ADR 0039](./0039-staging-is-a-frontend-on-the-production-backend.md)), so a
  backend change reaches users with the production job a few minutes after
  staging's frontend. Convex changes stay backward compatible
  (expand/contract): installed builds call production Convex for weeks.
- CI publishes app updates with `EXPO_TOKEN` from GitHub (repository scope for
  preview, the production Environment for production), so no update depends
  on a laptop or a personal Infisical login.

## Versioning

- `apps/mobile/app.json` `expo.version` is Gather's one SemVer. Bump `MINOR`
  for each store build, `PATCH` for a hotfix store build, `MAJOR` only for a
  deliberate break. Web deploys and OTA updates do not bump it. Build numbers
  stay with EAS (`appVersionSource: remote`).
- Each Worker answers `GET /version` with `version`, `commit`, `environment`,
  `deployedAt` and `release` (`src/lib/release/version.ts`). The deploy's smoke
  check fails unless `/version` reports the commit it built.
- The web Sentry release is `gather@<version>+<short sha>` (`vite.config.ts`).
- Tags: `v<version>` on each store build's commit; the workflows move
  `ota-preview` and `ota-production` after each publish.

## Why

Small, single-change deploys are the easiest to verify, attribute and roll
back; the click added a wait without adding a check, and the preview update
waited on whoever had Infisical open. The installed app is the exception: a
bad update sits on phones until it is replaced, so production gets one batch a
day of JavaScript that already ran on the owner's phone for a day.

## Consequences

- A backend change that is not backward compatible cannot merge without the
  owner's card, because nothing stops it between merge and production.
- A native change makes both update jobs skip that platform and say a build is
  due in the run summary, until a matching build exists on the channel.
- A local build is not recorded on EAS: after installing one, run
  `mobile-update.yml` by hand with `force` to seed the channel.
