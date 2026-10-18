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
| Adding a Module, a nested web route, a Convex table with `groupId`, a `_storage` column, a photo size, or a message key | [Add a Module](docs/runbooks/add-a-module.md) — four registries fail silently |
| Changing who owns, sees, or may write Group content, a refusal, or how the Current Group is chosen | [Ownership and access](docs/contracts/ownership-and-access.md) |
| Changing seeds, the Catalog, or the Sample household | [Seed data](docs/contracts/seed-data.md) |
| Storing, replacing, or deleting a photo or file | [Stored files](docs/contracts/stored-files.md) |
| Deleting a Group, an account, or rows a Group owns | [Account deletion](docs/contracts/account-deletion.md) |
| Touching the share sheet, a Drop, or `expo-share-intent` | [Drop](docs/contracts/drop.md) |
| Writing user-visible text, in either app | [Localization binding](CODING_STANDARDS.md#localization) |
| Adding web navigation, breadcrumbs, or back links | [Navigation](docs/contracts/navigation.md) |
| Writing, running, or retiring a migration, backfill, or compatibility shim | [Active migrations and their commands](docs/migrations/README.md), [one-shot code rule](CODING_STANDARDS.md#one-shot-code) |
| Running checks or verifying a web change | [Verification](docs/runbooks/verification.md) |
| Building, running, or verifying the phone app | [Mobile verification](docs/runbooks/mobile-verification.md) |
| Publishing an over-the-air update or a store build | [Mobile releases](docs/runbooks/mobile-releases.md) |
| Adding or changing an environment variable or secret | [Environment](docs/runbooks/environment.md) |
| Deploying, or changing the deploy or preview workflows | [Deploy](docs/runbooks/deploy.md), [Previews](docs/runbooks/previews.md) |
| Upgrading dependencies | [`upgrade-deps`](.claude/commands/upgrade-deps.md); never weaken or skip a test to make an upgrade pass — stop and report |

Domain terms: [GLOSSARY.md](GLOSSARY.md). Decisions: [ADR index](docs/README.md#decisions).
Adding, moving, or finding docs: [docs map](docs/README.md). Issues are GitHub
Issues on `AppElent/gather`; engineering skills read [docs/agents/](docs/agents/issue-tracker.md).
