# Planned dinners reference Recipes, with a fallback

Status: implemented (2026-08-25)

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
