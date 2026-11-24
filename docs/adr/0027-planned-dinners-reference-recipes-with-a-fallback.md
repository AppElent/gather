---
type: decision
description: Read before changing how planned dinners reference Recipes.
version: 1.2.0
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
copy migration with nothing to gain. Each row gained these fields, optional at
first so the change was expand-only:

- `slot`: which meal of the day. Optional while rows from before slots existed
  (all dinners) were backfilled; required since APP-371.
- `eaterIds`: who eats along. Absent means the Group's default eaters for that
  slot, minus whoever an evening calendar event takes out of dinner. Storing
  only a deliberate choice keeps the default live when the calendar changes.
  The choice belongs to that day: a meal moved or swapped to another day drops
  it and starts from the new day's defaults.
- `servings`: absent means as many as eat along.
- `note`: free text, such as "make extra for lunch".

The week view reads and writes through `convex/mealPlan.ts`. The dinner-only
`kitchen.planner`, `kitchen.setDinner` and `kitchen.clearDinner` that phones from
before slots called are gone (APP-371). Replacing a meal keeps that moment's
servings, note and eaters; only the recipe or quick meal changes.

Removing a meal answers what it was, and undo puts that snapshot back with
`mealPlan.restore`, even when its Recipe or quick meal has gone since. Undo is
the app's own, so connected apps cannot call `restore`. "Something
else" replaces the meal by id, not by whatever is in its slot by then. Agents
plan through `plan_meal` with an `idempotencyKey`, like every create (ADR-0046).

Which slots a Group plans, its default eaters and its servings live in the
Group's meal preferences (APP-318), not on the planned meal.
