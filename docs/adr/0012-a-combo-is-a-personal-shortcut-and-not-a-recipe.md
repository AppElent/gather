# A Combo is a Personal shortcut, and not a kind of Recipe

Status: accepted (2026-08-06); amended in place (2026-08-10) by #99, which makes
saving take a **selection** of a meal's entries and put the Combo in their
place. Everything below reads as written except the section on how a Combo is
created, which was headed "Created by saving, never by authoring" and captured
a whole slot without disturbing it.

A **Combo** is a named, reusable set of things logged together — the same lunch,
again. It is **Personal** in the sense of
[ADR-0003](0003-three-scopes-personal-group-and-personal-records.md): it belongs
to a person, follows them into every Group, belongs to none, and no other Member
ever sees it.

## Why it is not a Recipe

A Recipe and a Combo look alike from a distance — both are a named list of
things — and they sit on opposite sides of the boundary this codebase is built
around. A Recipe is Group-scoped: shareable, copyable, moveable between Groups,
carrying instructions and servings and attribution. A Combo is one person's
shortcut for logging, with no instructions, no servings and nobody to attribute
it to. Making one a special case of the other would put a Personal record inside
the Group machinery or a Group record inside the Personal one; either way, half
the rules would have to be disabled by a flag.

A Combo may *contain* a Recipe. That is provenance, not containment of scope:
the reference is permission-checked on read and allowed to dangle, exactly as a
diary entry's is.

## Why "Combo"

**"Food group" was rejected**: it is an established nutrition term — grains,
dairy, protein — and would actively mislead in a nutrition app of all places.

**"Meal" was rejected**: that word already names the breakfast / lunch / dinner
/ snack slot throughout the schema, the messages and the UI. Taking it would
have forced a rename of the slot with no compensating benefit, and left every
sentence in the Module ambiguous in the meantime.

Dutch: *Combinatie*.

## References, not figures

A Combo's components store `foodId` / `recipeId` and an amount, never a copy of
the nutrition — except a one-off component, which has nothing behind it and so
keeps its own figures. Correcting a food's data therefore corrects every future
log of every Combo containing it.

This is deliberately the opposite of what a *diary entry* does. An entry
snapshots its nutrition at the moment of logging and never changes again
(ADR-0003). The difference is what each thing is: an entry is a record of
something that happened, a Combo is a shortcut for something that will.

A component keeps a `label` alongside its reference, so a reference that has
become unreachable still has something to render. That component is shown as
unavailable and simply is not logged; the rest of the Combo still logs. Losing
access to one thing does not break the whole shortcut.

## Created by saving, and saving takes the entries' place

There is no Combo builder. A filled-in meal slot gains a "Save as combo"
action; it asks which of that meal's entries go in, and those entries are then
replaced by the Combo's own expanded log for the same day and meal. Everything
else in the meal is untouched. That is the only way one is made, and the
curation is still a by-product of logging something you were logging anyway.

The alternative — a builder that opens empty and asks you to pick everything
again — is how a Combo becomes a second food library to maintain, with its own
staleness and its own reason to be abandoned. Choosing does not reopen that
door: there is still nothing to choose from but a meal you have already filled
in, and nothing to save when nothing is ticked.

Two narrower alternatives were rejected with it. **Capturing the whole slot**
was what shipped first, and it was wrong about what a meal is: the coffee is
not part of your usual lunch merely by having happened at the same hour, and
saying so cost a round of deleting and re-logging. **Leaving the originals in
place** cost that same round on every save — the first use of a shortcut being
more work than not having it.

What replaces them is the Combo's ordinary expansion and nothing special, so
the entries you are left with are the entries logging it tomorrow would give
you: figures re-read from the food or the Recipe, a one-off scaled from its
own. Creating the Combo, deleting the chosen entries and writing the expansion
are one Convex mutation, which is one transaction — there is no half of this to
land. A component that could not be logged back, a Recipe that has gone out of
reach, refuses the save outright rather than quietly costing somebody a diary
entry. That is the one place this differs from logging a Combo, which skips
such a component and logs the rest: there, nothing is being taken away.

## Logging one never edits it

Adjusting a component's quantity, or stepping it to zero to drop it, affects
only the entries written for that day. Afterwards, an unobtrusive offer to
update the saved Combo appears beside the confirmation. It is an offer: ignoring
it leaves the Combo exactly as it was.

Two alternatives were rejected. **Silent learning** — the Combo quietly
absorbing each day's adjustments — drifts without consent, and a Combo that
changes every time you have an extra slice stops being your usual. **An on-commit
modal** asking "save these changes to the Combo?" puts a decision in the middle
of the path this whole redesign exists to shorten.

## Consequences

`combos` and `comboItems` carry a `userId` and no `groupId`, and every function
in `convex/combos.ts` resolves the caller and reads only their own rows. There
is no Group argument to pass, which is what makes "reads the same in every
Group" true by construction rather than by care.

Sharing a Combo into a Group is out of scope and stays out until somebody wants
it: it would need its own permissions and its own answer to what happens when
the person who saved it leaves.

Expanding a Combo into diary entries is a pure function
(`convex/lib/combos.ts`), imported directly by the client and by `saveFromMeal`
on the way to writing a replacement, so what the expanded card shows and what
either mutation writes cannot drift apart.
