# Active migrations and maintenance tools

Only unfinished work belongs in this index. A release owner records command output in the named migration record, then archives the completed record with its date, result, removed code, and related ADR/Git links.

| ID | Status | Owner | Code | Required operation | Retirement condition |
| --- | --- | --- | --- | --- | --- |
| 0005 | active: dev and production apply outstanding | release owner with Convex production access | `maintenance:backfillFoodSearchText` | run dry and `{"apply":true}` on dev and production | both results are recorded; delete mutation/test and require `foods.searchText` |
| 0006 | active: production table-clear and deploy outstanding | release owner with Convex production access | `maintenance:backfillFoodServings` | follow the production clear/deploy record; use the backfill only for a preserved legacy deployment | production result is recorded; remove the unused legacy route/test/schema compatibility |
| 0007 | active: production apply outstanding | release owner with Convex production access | `migrations:declineByOmission` | run dry and `--prod`, recording `{ total, migrated, skipped }` | dev and production results are recorded; delete mutation and `babies.trackedTypes` |

## `convex/maintenance.ts` audit

| Export | Classification | Owner | End condition |
| --- | --- | --- | --- |
| `cleanUserDocuments` | active operational repair | release owner | retain while schema-rejected user rows can exist; archive its run result before retirement |
| `mergeDuplicateUsers` | active operational repair | account-data owner | retain while duplicate Clerk subjects require owner-directed repair; retire after an invariant check replaces it |
| `backfillGroupSlugsAndPersonalGroups` | retired migration | release owner | remove only after its completed deployment record is archived |
| `backfillFoodSearchText` | active migration 0005 | release owner | 0005 retirement condition |
| `backfillFoodServings` | active migration 0006 | release owner | 0006 retirement condition |
| `wipeRecipes` | retired migration | release owner | remove only after its completed deployment record is archived |
| `verifyBabyLogScope` | active operational verification | baby-log owner | retain while owner-directed Group-scope moves are supported |
| `moveBabyToGroup` | active operational repair | baby-log owner | retain while owner-directed Group-scope moves are supported |
