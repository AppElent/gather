---
type: decision
description: Read before changing how planned dinners reference Recipes.
version: 1.1.0
status: accepted
date: 2026-08-25
---

# Planned dinners reference Recipes, with a fallback

Implemented when recorded.

A planner needs both the Recipes a Group can cook and quick dinners that will
never deserve a Recipe. We will not manufacture a second Meal row for every
Recipe: a Planned dinner references any Recipe visible in its Group, while a
quick dinner carries its own name and preparation time. This prevents duplicate
titles and preparation times from drifting while still making a short entry such
as “Penne carbonara” immediately plannable.

The planner reads a referenced Recipe's current title and preparation time. If
the Recipe is deleted or ceases to be visible in the Group, the Planned dinner
keeps the last known title and time as a plain-text snapshot, rather than
silently becoming blank or retaining a broken link. This preserves an
intelligible weekly plan without pretending the Recipe remains available.

## Meal slots (APP-317, 18 Nov 2026)

A Group can plan breakfast and lunch too, so a planned dinner became a
**Planned meal**: one per Group, date and **Meal slot** (`breakfast`, `lunch`,
`dinner`). The table keeps its name, `plannedDinners`; renaming it would be a
copy migration with nothing to gain. Each row gains optional fields, so the
change is expand-only:

- `slot`: absent means dinner. `maintenance:backfillMealSlots` writes `dinner`
  on the rows planned before slots existed (docs/migrations/README.md).
- `eaterIds`: who eats along. Absent means the Group's default eaters for that
  slot, minus whoever an evening calendar event takes out of dinner. Storing
  only a deliberate choice keeps the default live when the calendar changes.
- `servings`: absent means as many as eat along.
- `note`: free text, such as "make extra for lunch".

The week view reads and writes through `convex/mealPlan.ts`. Installed phones
still call `kitchen.planner`, `kitchen.setDinner` and `kitchen.clearDinner`;
those act on the dinner slot only, so an old phone never draws a lunch as that
day's dinner. They stay until the OTA that calls `mealPlan` has reached every
installed build.

Which slots a Group plans, its default eaters and its servings live in the
Group's meal preferences (APP-318), not on the planned meal.
