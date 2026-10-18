# Gather docs

The only index. Rules for placing, naming and formatting documents:
[documentation standard](standards/documentation.md). Each typed folder has a
managed `.template.md` to copy, and every document's `description` says when to
read it: `grep -r "^description:" docs/contracts docs/runbooks docs/adr docs/records docs/standards`.

| Folder | Type | Lifetime |
| --- | --- | --- |
| `standards/` | `standard`: shared rules | Managed by developer-tools; never edited here |
| `contracts/` | `contract`: intended behavior per area | Living, versioned |
| `adr/` | `decision`: hard-to-reverse trade-offs ([index below](#decisions)) | Immutable; superseded |
| `runbooks/` | `runbook`: project facts for a repeatable task | Living, versioned |
| `records/` | `record`: dated evidence cited by a contract, ADR or code; follow-ups are GitHub issues | Frozen |
| `migrations/` | Active one-shot migrations and their retirement conditions ([ledger](migrations/README.md)) | Until retired |
| `agents/` | Pointers engineering skills look up by path | — |

Vocabulary: [GLOSSARY.md](../GLOSSARY.md). Project rules:
[CODING_STANDARDS.md](../CODING_STANDARDS.md), [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).
Design studies: [designs/](../designs/).

## Decisions

Two numbers are each held by two accepted ADRs: 0013 and 0014. They are left as
they are — renumbering an accepted ADR would silently retarget every `ADR-0013`
/ `ADR-0014` already written in code comments and docs — so cite either pair by
filename, not by number alone. A new ADR takes the number after the highest
(0036 next).

| ID | Decision | Status | Domain | Key implementation references |
| --- | --- | --- | --- | --- |
| [0001](adr/0001-groups-are-not-clerk-organizations.md) | Groups are not backed by Clerk Organizations | accepted | identity | `convex/groups.ts`, `convex/users.ts` |
| [0002](adr/0002-the-group-is-explicit-in-the-url.md) | The Group is explicit in the URL | superseded | web navigation | `src/lib/groupPaths.ts`, `src/routes/_app/g/$groupSlug/` |
| [0003](adr/0003-three-scopes-personal-group-and-personal-records.md) | Three scopes: Group, Personal, Catalog | superseded | data ownership | `convex/schema.ts`, [GLOSSARY.md](../GLOSSARY.md) |
| [0004](adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md) | Catalog entries are read-only and the seed always wins | accepted | catalog | `convex/seed.ts`, `convex/lib/seed/` |
| [0005](adr/0005-pins-belong-to-a-person-in-a-group.md) | Pins belong to a person in a Group | accepted | navigation | `convex/memberships.ts`, `packages/core/src/pins.ts` |
| [0006](adr/0006-any-member-invites-only-an-admin-removes.md) | Any Member invites; only an admin removes | accepted | authorization | `convex/groups.ts` |
| [0007](adr/0007-a-write-happens-at-the-address-that-names-its-group.md) | A write happens at the address that names its Group | accepted | authorization | `convex/lib/groupAccess.ts` |
| [0008](adr/0008-the-activity-stream-is-derived-from-rows-that-testify.md) | The activity stream is derived from rows that testify | accepted | activity | `convex/activity.ts` |
| [0009](adr/0009-a-refusal-inside-a-group-never-says-which-refusal-it-is.md) | A refusal inside a Group never says which refusal it is | accepted | authorization | `convex/lib/groupAccess.ts` |
| [0010](adr/0010-a-photo-is-stored-as-prepared-never-as-chosen.md) | A photo is stored as prepared, never as chosen | accepted | files | `packages/core/src/photoPresets.ts`, `convex/lib/storedFiles.ts` |
| [0011](adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md) | The UI is English at the source, and translations are typed dictionaries | accepted | i18n | `packages/core/src/messages/`, `src/lib/i18n/` |
| [0012](adr/0012-a-combo-is-a-personal-shortcut-and-not-a-recipe.md) | A Combo is a Personal shortcut, and not a kind of Recipe | accepted | nutrition | `convex/combos.ts` |
| [0013](adr/0013-staging-deploys-on-merge-production-deploys-on-a-click.md) | Staging deploys on merge, production deploys on a click | accepted | deployment | `.github/workflows/deploy.yml` |
| [0013](adr/0013-a-nested-page-carries-its-own-trail.md) | A nested page carries its own trail, and back is an address | accepted | web navigation | `src/components/app/Breadcrumbs.tsx` |
| [0014](adr/0014-a-variable-declares-its-consumer-not-its-destination.md) | A variable declares its consumer, not its destination | accepted | environment | `env.manifest.ts`, `scripts/env.mjs` |
| [0014](adr/0014-the-phone-is-a-clerk-generation-ahead-of-the-web.md) | The phone is a Clerk generation ahead of the web | accepted | mobile auth | `apps/mobile/src/auth/` |
| [0015](adr/0015-the-group-is-addressed-on-the-web-and-ambient-on-the-phone.md) | The Group is addressed on the web and ambient on the phone | superseded | mobile navigation | `apps/mobile/src/group/GroupProvider.tsx`, `apps/mobile/app/g/` |
| [0016](adr/0016-shared-code-crosses-as-a-package-with-no-dependencies.md) | Shared code crosses as a package with no dependencies | accepted | workspace boundary | `packages/core/package.json`, `packages/core/tsconfig.json` |
| [0017](adr/0017-the-phone-owns-its-look-and-shares-its-words.md) | The phone owns its look and shares its words | accepted | mobile design | `apps/mobile/src/theme/`, `packages/core/src/moduleTints.ts` |
| [0018](adr/0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md) | Mobile tabs are app destinations, and one of them is a verb | accepted | mobile navigation | `apps/mobile/app/(app)/(tabs)/`, `apps/mobile/src/components/QuickActionSheet.tsx` |
| [0019](adr/0019-public-recipe-collections-are-group-settings.md) | Public recipe collections are Group settings | accepted | recipes | `convex/groups.ts`, `convex/recipes.ts` |
| [0020](adr/0020-external-module-backends-are-authoritative.md) | External Module Backends are authoritative and Gather caches them | accepted | integrations | `convex/lib/taskProviders/` |
| [0021](adr/0021-task-backend-capabilities-and-manual-sync.md) | Task backends expose capabilities and reconcile manually | accepted | tasks | `convex/taskLists.ts`, `convex/integrations.ts` |
| [0022](adr/0022-a-module-is-configured-by-its-content-not-by-a-switch.md) | A Module is configured by its content, not by a switch | accepted | mobile modules | `apps/mobile/src/modules/baby/` |
| [0023](adr/0023-modules-live-inside-the-tab-stacks.md) | Modules live inside the tab stacks | accepted | mobile navigation | `apps/mobile/app/(app)/(tabs)/`, `apps/mobile/src/modules/` |
| [0024](adr/0024-a-tasting-catalog-is-a-picker-and-tasting-it-makes-it-yours.md) | A Tasting catalog is a picker, and tasting it makes it yours | accepted | tasting | `convex/tastings.ts`, `packages/core/src/tastingKinds.ts` |
| [0025](adr/0025-money-is-shared-and-manual-first.md) | Money is shared and entered by hand | accepted | finances | [GLOSSARY.md](../GLOSSARY.md), ADR-0026 |
| [0026](adr/0026-portfolio-overviews-are-information-not-advice.md) | Portfolio overviews are information, not advice | accepted | finances | [GLOSSARY.md](../GLOSSARY.md) |
| [0027](adr/0027-planned-dinners-reference-recipes-with-a-fallback.md) | Planned dinners reference Recipes, with a fallback | accepted | meal planning | [GLOSSARY.md](../GLOSSARY.md) |
| [0028](adr/0028-a-drop-is-nothing-until-a-person-names-its-destination.md) | A Drop is nothing until a person names its destination | accepted | mobile sharing | `apps/mobile/src/drop/`, `packages/core/src/dropRules.ts` |
| [0029](adr/0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md) | A JavaScript change ships over the air, and a native one does not | accepted | mobile release | `apps/mobile/app.json`, `apps/mobile/eas.json` |
| [0030](adr/0030-groups-are-the-only-user-owned-scope.md) | Groups are the only user-owned scope | accepted | data ownership | `convex/schema.ts`, `convex/groups.ts`, [GLOSSARY.md](../GLOSSARY.md) |
| [0031](adr/0031-the-current-group-is-ambient-on-web-and-mobile.md) | The Current Group is ambient on web and mobile | accepted | navigation | `packages/core/src/groups.ts`, [GLOSSARY.md](../GLOSSARY.md) |
| [0032](adr/0032-an-account-is-deleted-in-the-app-and-takes-its-solo-groups-with-it.md) | An account is deleted in the app, and takes its solo Groups with it | accepted | account lifecycle | `convex/accounts.ts`, `convex/cascade.ts`, `convex/lib/groupCascade.ts` |
| [0033](adr/0033-the-phones-all-screen-is-arranged-on-the-device.md) | The phone's All screen is arranged on the device | accepted | mobile navigation | `apps/mobile/src/prefs/moduleArrangement.ts`, `packages/core/src/moduleArrangement.ts` |
| [0034](adr/0034-notes-tasks-and-calendar-remain-separate-modules.md) | Notes, Tasks and Calendar remain separate Modules | accepted | modules | `packages/core/src/modules.ts` |
| [0035](adr/0035-money-tools-are-separate-modules.md) | Money tools are separate Modules | accepted | money modules | `packages/core/src/modules.ts`, `apps/mobile/src/modules/finances/` |
