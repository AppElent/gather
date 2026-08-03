# A write happens at the address that names its Group

Status: accepted (2026-08-03)

Whether you *may* change a piece of content is answered by membership of its home
Group, from wherever you are reading it. **Where** you change it is answered by
the URL. A page addressed to a Group that is not the content's home offers a link
to the home address instead of the write controls.

## Why

`recipes.get` computes `canEdit` from membership of the recipe's home Group, and
that is right: writing follows the home Group and not the shared list, so a
household may fix its own typo and a Group that was merely shown the recipe may
not touch it. Nothing here changes that rule, and the backend enforces it
unchanged.

But the controls were being drawn wherever `canEdit` was true, which produced
three things that ADR-0002 exists to prevent. Delete removed a recipe from the
household while the address said `cooking-club`, and then returned the reader to
the club's list — the Group that lost something was never named on screen. Edit
navigated to `/g/cooking-club/recipes/<id>/edit`, so the slug that is readable
*precisely so you notice where a write lands* was readable and wrong. And the
sharing panel offered to unshare the Group being stood in, which destroys the
page it is drawn on.

ADR-0002 pays for a human-readable slug with global uniqueness, collision
suffixes and a reserved-segment list, on the grounds that the Group you are
acting in has to be noticeable. A write that lands somewhere other than the Group
in the address spends that safety property and returns nothing.

## Consequences

A Member of the home Group standing at a guest address gets one link — the home
Group named, and the way there — where Edit, Delete, Move and Unshare would
otherwise be. One extra click on the fix-a-typo path, which is the right price
for never deleting under an address that does not name the Group losing content.

A reader who is *not* in the home Group is told where the content lives, which
they could not previously see at all: `homeGroupName` was passed only to the
sharing panel, and so reached only the people who already knew.

**Copy is a Recipes affordance, not a Group verb.** The boundary has exactly two
verbs — Share and Move — and both mean the same thing for a recipe, a task list
and a child. Copy does not: cloning a child is meaningless and cloning a task
list raises questions about its tasks that nobody has asked. So a guest who wants
a recipe copies it into a Group of their own, and that lives in Recipes rather
than in the vocabulary every Module must answer for. The copy is independent and
carries a provenance-style reference to what it came from — snapshotted, checked
on read, allowed to dangle, exactly as ADR-0003 already defines for Personal
records.

**Unshare stops meaning "take it back."** Once a recipe can be copied, withdrawing
a Share removes only the sharer's copy from view; the Group that copied it keeps
an independent one and the home Group cannot reach it. This is accepted rather
than designed around: any Member of that Group could always have retyped the
recipe, and a Share that can be un-rung is a promise the app cannot keep.
