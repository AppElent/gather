# Architecture decision index

| ID | Decision | Status | Domain | Key implementation references |
| --- | --- | --- | --- | --- |
| 0001 | Groups are not backed by Clerk Organizations | accepted | identity | `convex/groups.ts`, `convex/users.ts` |
| 0002 | The Group is explicit in the URL | superseded | web navigation | `src/lib/groupPaths.ts`, `src/routes/_app/g/$groupSlug/` |
| 0003 | Three scopes: Group, Personal, Catalog | superseded | data ownership | `convex/schema.ts`, `CONTEXT.md` |
| 0004 | Catalog entries are read-only and the seed always wins | accepted | catalog | `convex/seed.ts`, `convex/lib/seed/` |
| 0005 | Pins belong to a person in a Group | accepted | navigation | `convex/memberships.ts`, `packages/core/src/pins.ts` |
| 0006 | Any Member invites; only an admin removes | accepted | authorization | `convex/groups.ts` |
| 0007 | A write happens at the address that names its Group | accepted | authorization | `convex/lib/groupAccess.ts` |
| 0008 | The activity stream is derived from rows that testify | accepted | activity | `convex/activity.ts` |
| 0009 | A refusal inside a Group never says which refusal it is | accepted | authorization | `convex/lib/groupAccess.ts` |
| 0010 | A photo is stored as prepared, never as chosen | accepted | files | `packages/core/src/photoPresets.ts`, `convex/lib/storedFiles.ts` |
| 0011 | The UI is English at the source, and translations are typed dictionaries | accepted | i18n | `packages/core/src/messages/`, `src/lib/i18n/` |
| 0012 | A Combo is a Personal shortcut, and not a kind of Recipe | accepted | nutrition | `convex/combos.ts` |
| 0013 | A nested page carries its own trail, and back is an address | accepted | web navigation | `src/components/app/Breadcrumbs.tsx` |
| 0014 | The phone is a Clerk generation ahead of the web | accepted | mobile auth | `apps/mobile/src/auth/` |
| 0015 | The Group is addressed on the web and ambient on the phone | superseded | mobile navigation | `apps/mobile/src/group/GroupProvider.tsx`, `apps/mobile/app/g/` |
| 0016 | Shared code crosses as a package with no dependencies | decided | workspace boundary | `packages/core/package.json`, `packages/core/tsconfig.json` |
| 0017 | The phone owns its look and shares its words | accepted | mobile design | `apps/mobile/src/theme/`, `packages/core/src/moduleTints.ts` |
| 0018 | Mobile tabs are app destinations, and one of them is a verb | decided | mobile navigation | `apps/mobile/app/(app)/(tabs)/`, `apps/mobile/src/components/QuickActionSheet.tsx` |
| 0019 | Public recipe collections are Group settings | accepted | recipes | `convex/groups.ts`, `convex/recipes.ts` |
| 0020 | External Module Backends are authoritative and Gather caches them | accepted | integrations | `convex/lib/taskProviders/` |
| 0021 | Task backends expose capabilities and reconcile manually | accepted | tasks | `convex/taskLists.ts`, `convex/integrations.ts` |
| 0022 | A Module is configured by its content, not by a switch | decided | mobile modules | `apps/mobile/src/modules/baby/` |
| 0023 | Modules live inside the tab stacks | decided | mobile navigation | `apps/mobile/app/(app)/(tabs)/`, `apps/mobile/src/modules/` |
| 0024 | A Tasting catalog is a picker, and tasting it makes it yours | decided | tasting | `convex/tastings.ts`, `packages/core/src/tastingKinds.ts` |
| 0025 | Money is shared and entered by hand | decided | finances | `CONTEXT.md`, `docs/adr/0026-portfolio-overviews-are-information-not-advice.md` |
| 0026 | Portfolio overviews are information, not advice | decided | finances | `CONTEXT.md` |
| 0027 | Planned dinners reference Recipes, with a fallback | decided | meal planning | `CONTEXT.md` |
| 0028 | A Drop is nothing until a person names its destination | decided | mobile sharing | `apps/mobile/src/drop/`, `packages/core/src/dropRules.ts` |
| 0029 | A JavaScript change ships over the air, and a native one does not | decided | mobile release | `apps/mobile/app.json`, `apps/mobile/eas.json` |
| 0030 | Groups are the only user-owned scope | decided | data ownership | `convex/schema.ts`, `convex/groups.ts`, `CONTEXT.md` |
| 0031 | The Current Group is ambient on web and mobile | decided | navigation | `packages/core/src/groups.ts`, `CONTEXT.md` |
| 0032 | An account is deleted in the app, and takes its solo Groups with it | decided | account lifecycle | `convex/accounts.ts`, `convex/cascade.ts`, `convex/lib/groupCascade.ts` |
