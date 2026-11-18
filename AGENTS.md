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
| Deciding which platform a feature ships on, or adding, moving or removing a web or phone route | [ADR-0042](docs/adr/0042-the-phone-leads-and-the-web-is-where-a-household-is-managed.md), [ADR-0047](docs/adr/0047-six-modules-ship-on-the-web-and-the-phone-still-leads.md) for tasks, notes, calendar, groceries, meal planner and shared costs, and its entry in `packages/core/src/features.ts` |
| Changing who owns, sees, or may write Group content, a refusal, or how the Current Group is chosen | [Ownership and access](docs/contracts/ownership-and-access.md) |
| Changing the MCP server, its tools, OAuth scopes, or how a connected app is gated in Convex | [MCP](docs/runbooks/mcp.md), [ADR-0046](docs/adr/0046-agents-connect-through-clerk-oauth-and-name-the-group.md) |
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
Adding, moving, or finding docs: [docs map](docs/README.md). Work lives in
Linear (team AppElent, project Gather, label `app:gather`), not GitHub Issues.
Engineering skills read [docs/agents/](docs/agents/issue-tracker.md).

## Factory workflow

Linear (workspace `appelent`, team AppElent, key `APP`, project Gather, label `app:gather`) is the source of truth. New work lives in Linear, not GitHub Issues. A Gather issue has the app label and a blast radius.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <hub, grok, or claude-code>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one). Do not merge the PR yourself.

After opening the PR, review it by risk tier, in this same thread (state `Risk: low|med|high` with one line why in the PR body; when in doubt, pick the higher tier): **low** (copy, styling, small fixes, tests, docs) needs green CI and your own self-check against the acceptance criteria; **med** (new features, UI flows) needs one read-only code review by the other of Opus and Sol (Sol reviews Opus code, Opus reviews Sol or Codex code), answering `PROCEED` or `REVISE`, where `REVISE` needs a real blocker (bug, security or privacy, data loss, broken installed app, unmet acceptance criterion) and suggestions go to `## Leftover work`; **high** (Convex schema, auth, payments, data migrations, anything that can break installed mobile apps) needs `security-review` plus both Opus and Sol `PROCEED` and then waits for Eric. At most two review rounds; still `REVISE` after that goes to Eric. A council runs only when the issue has a `Council goal:` (see the developer-home RUNBOOK). The Codex GitHub review is advisory: address its comments, do not wait for it. Post the review as a PR comment, fix blockers, and end your final message with `Review verdict (<tier>): PROCEED` or `REVISE` with the open blockers. Do not start separate review or council threads.

UI changes: include screenshots in the PR (iOS simulator and web, light and dark, small screen); build with the app's design system tokens and components, no one-off styling; look up references (for example Mobbin) before a new screen; follow the Apple HIG and native controls on iOS. New screens or flows wait for Eric's approval of the screenshots before merge.

End your report with a **Leftover work** heading listing everything found but left out of scope, without fixing it.

Blast radius (`low` / `med` / `high`, also `blast-radius:low|med|high` on the PR):
- low: copy, styling, small fixes, tests, refactors within one module, docs.
- med: new features (for example a game), UI flows, new dependencies, shared behaviour across several screens.
- high: Convex schema, data migrations, deleting data, auth, permissions, payments, production config, secrets, CI or deploy config, and anything that can break the installed mobile apps or affect other users without a way back.

Coding agents never merge. The manager (the Claude Projects hub, the Grok fallback, or the Claude Code Chief of Staff thread) merges `low` and `med` after green CI, green QA, and the tier's review `PROCEED`; `high` and the changes the [factory runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md) lists as waiting for Eric stay open for Eric. Never read or change production secrets, and never approve production deployments.
