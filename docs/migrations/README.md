# Active migrations and maintenance tools

Only unfinished work belongs in this index. A release owner records command output in the named migration document. Once it has run everywhere, the document moves to `docs/records/` (dated, with its result, removed code, and related ADR/Git links) when a contract, ADR or code comment cites it, and is deleted otherwise; git keeps it.

| ID | Status | Owner | Code | Required operation | Retirement condition |
| --- | --- | --- | --- | --- | --- |
| 0007 | active: production apply outstanding | release owner with Convex production access | `migrations:declineByOmission` | run once on dev and once with `--prod` (it has no dry mode), recording `{ total, migrated, skipped }` | dev and production results are recorded; delete mutation and `babies.trackedTypes` |
| [0008](0008-retire-nutrition.md) | active: production apply outstanding | release owner with Convex production access | `maintenance:retireNutrition` | after the production deploy, run dry, then `{"apply":true}` until `more` is false, then confirm all counts are zero | production result is recorded; delete mutation/test and `users.nutritionTargets` |
| `removePersonalGroupSemantics` | active: dev and production apply outstanding | release owner with Convex production access | `maintenance:removePersonalGroupSemantics` | run dry and `{"apply":true}` in every deployment, then confirm `converted` is zero on a second run | both results are recorded; delete mutation/test and `groups.isPersonal` |
| `deleteFinanceSettings` | active: dev and production apply outstanding | release owner with Convex production access | `maintenance:deleteFinanceSettings` | run dry, then `{"apply":true}` in every deployment until `more` is false, then confirm `deleted` is zero on a further run | both results are recorded; delete mutation/test, the `financeSettings` table and its `GROUP_CONTENT` entry |
| `holdings.settings` | active: installed phones still read it by name | mobile release owner | `convex/holdings.ts` `settings`, which always answers euros (ADR-0040) | ship the OTA whose phone no longer reads it | after that OTA reached all installed builds, delete the query |
| `backfillRecipeShares` (APP-299) | active: dev and production apply outstanding | release owner with Convex production access | `maintenance:backfillRecipeShares` | right after the production deploy, run dry, then `{"apply":true}` (passing back `cursor` while `more` is true), then repeat the dry run from the start (passing back `cursor` while `more` is true) and confirm every page reports `created` and `removed` zero; until then the kitchen's recipe picker (old phones' `overview` too) omits recipes Shared in before the deploy, and their planned dinners show the stored title and prep time instead of the live recipe's | both results are recorded; delete mutation/test; then `recipes.list` and `destroyGroup` can read `recipeShares` instead of scanning |
| `kitchen.overview` (APP-299) | active: installed phones still call it | mobile release owner | `convex/kitchen.ts` `overview`, same arguments and result shape, read by index | ship the OTA that calls `kitchen.planner`, `kitchen.pantry` and `kitchen.groceries` | after that OTA reached all installed builds, delete `overview` and its tests |
| `kitchen` calendar aliases | active: installed phones still call `kitchen.*` by name | mobile release owner | `convex/kitchen.ts` aliases of `addCalendar`, `removeCalendar`, `addCalendarEvent`, `getCalendarEvent`, `removeCalendarEvent`, `setCalendarVisibility` | ship the OTA that calls `calendar.*` | after the next OTA reached all installed builds, delete the aliases and their test |

## `convex/maintenance.ts` audit

| Export | Classification | Owner | End condition |
| --- | --- | --- | --- |
| `cleanUserDocuments` | active operational repair | release owner | retain while schema-rejected user rows can exist; archive its run result before retirement |
| `mergeDuplicateUsers` | active operational repair | account-data owner | retain while duplicate Clerk subjects require owner-directed repair; retire after an invariant check replaces it |
| `retireNutrition` | active migration 0008 | release owner | 0008 retirement condition |
| `removePersonalGroupSemantics` | active migration | release owner | its retirement condition above |
| `deleteFinanceSettings` | active migration (retires `financeSettings`) | release owner | its retirement condition above |
| `backfillRecipeShares` | active migration (APP-299, fills `recipeShares`) | release owner | its retirement condition above |
| `verifyBabyLogScope` | active operational verification | baby-log owner | retain while owner-directed Group-scope moves are supported |
| `moveBabyToGroup` | active operational repair | baby-log owner | retain while owner-directed Group-scope moves are supported |
