# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Gather is a household app: web (`src/`), Convex backend (`convex/`), Expo phone
app (`apps/mobile/`), shared `@gather/core` (`packages/core/`). pnpm, always.

Before the task, read the matching project doc:

| When you are… | Read |
| --- | --- |
| Adding a Module, a nested web route, a Convex table with `groupId`, a `_storage` column, a photo size, or a message key | [Add a Module](docs/runbooks/add-a-module.md) — every registry it must reach |
| Changing who owns, sees, or may write Group content, a refusal, or how the Current Group is chosen | [Ownership and access](docs/contracts/ownership-and-access.md) |
| Changing seeds, the Catalog, or the Sample household | [Seed data](docs/contracts/seed-data.md) |
| Storing, replacing, or deleting a photo or file | [Stored files](docs/contracts/stored-files.md) |
| Deleting a Group, an account, or rows a Group owns | [Account deletion](docs/contracts/account-deletion.md) |
| Adding a Convex table, or changing what "Export your data" contains | [Data export](docs/contracts/data-export.md) |
| Touching the share sheet, a Drop, or `expo-share-intent` | [Drop](docs/contracts/drop.md) |
| Writing user-visible text, in either app | [Localization binding](CODING_STANDARDS.md#localization) |
| Adding web navigation, breadcrumbs, or back links | [Navigation](docs/contracts/navigation.md) |
| Writing, running, or retiring a migration, backfill, or compatibility shim | [Active migrations and their commands](docs/migrations/README.md), [one-shot code rule](CODING_STANDARDS.md#one-shot-code) |
| Running checks or verifying a web change | [Verification](docs/runbooks/verification.md) |
| Building, running, or verifying the phone app | [Mobile verification](docs/runbooks/mobile-verification.md) |
| Publishing an over-the-air update or a store build | [Mobile releases](docs/runbooks/mobile-releases.md) |
| Adding or changing an environment variable or secret | [Environment](docs/runbooks/environment.md) |
| Deploying, or changing the deploy or preview workflows | [Deploy](docs/runbooks/deploy.md), [Previews](docs/runbooks/previews.md) |
| Changing error reporting (web or phone), the privacy scrubber, source maps, or the `*_SENTRY_*` variables | [Sentry](docs/runbooks/sentry.md) |
| Upgrading dependencies | The `upgrade-dependencies` skill; never weaken or skip a test to make an upgrade pass — stop and report |
| Watching a pull request through CI and review | The `babysit-pr` skill |
| Reviewing the running app, alone or in a session the owner drives | The `review-app` skill, with [Verification](docs/runbooks/verification.md) for how to run it |

Domain terms: [GLOSSARY.md](GLOSSARY.md). Decisions: [ADR index](docs/README.md#decisions).
Adding, moving, or finding docs: [docs map](docs/README.md). Issues are GitHub
Issues on `AppElent/gather`; engineering skills read [docs/agents/](docs/agents/issue-tracker.md).

## Factory workflow

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth. Work is a Linear issue with an app label and a blast radius.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <bot or fallback>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one). Do not merge the PR yourself.

End your report with a **Leftover work** heading listing everything found but left out of scope, without fixing it.

Blast radius (`low` / `med` / `high`, also `blast-radius:low|med|high` on the PR):
- low: UI, copy, tests, refactors within one module, docs.
- med: data model changes with migration and rollback, new dependencies, CI/workflows, shared behaviour across several screens.
- high: auth, payments, production config, secrets, deleting data, permissions, anything affecting other users without a way back.

Agents never merge med or high PRs. Never read or change production secrets, and never approve production deployments.
