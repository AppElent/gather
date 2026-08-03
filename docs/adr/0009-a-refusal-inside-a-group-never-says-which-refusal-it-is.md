# A refusal inside a Group never says which refusal it is

Status: accepted (2026-08-03)

"No such record" and "that record is not in this Group" are the same answer, so
neither can be used to discover the other. Refusing the **Group** is deliberately
the opposite: `unknown-slug` and `not-a-member` stay distinct all the way to the
UI. Whether a mutation refuses out loud or silently is decided by idempotency,
not by secrecy.

## Why this is written down

Three ticket reviews arrived at the first rule independently, each arguing it from
scratch, and it now lives as near-identical comments in `babyAccess`, `taskAccess`
and `recipes`. Three comments agreeing with each other is how a rule quietly stops
being followed: the fourth Module has nothing to inherit, and any drift is a leak
rather than an inconsistency. The two levels also look contradictory to a reader
encountering them cold, which invites somebody to harmonise them and break one.

## The three layers

**A record inside a Group: identical refusals.** `findBabyInGroup` returns null for
a child that does not exist and for a child in another Group alike. `recipes.get`
does the same. The page cannot be used to learn that something exists somewhere
else.

**The Group itself: distinct refusals.** `GROUP_REFUSAL_MESSAGES` keeps "No group
has that slug" and "Not a member of that group" apart. Collapsing them into the
permission answer would tell a stranger that a slug exists; collapsing them the
other way would show somebody a permission error for mistyping their own
household's name, which in a four-person app is overwhelmingly the likelier event.

**Mutations: idempotency decides.** `recipes.remove` and `integrations.disconnect`
return silently, because deleting a thing that has gone lands where the caller
asked. `recipes.move`, `share` and `unshare` throw `'Recipe not found'`, because
they had work to do and could not do it. Both satisfy the first rule — neither
message distinguishes missing from forbidden — and the distinction is *not* "a
mutation you may not make is a silent no-op", which would turn a genuine error
into silence.

## Consequences

**Group slugs are enumerable, and that is accepted.** Because the boundary's
refusals stay distinct, anyone signed in can type `/g/jansen-household` and learn
from the answer that such a Group exists — and slugs are derived from names and
globally unique (ADR-0002), so that amounts to "this household uses Gather".
Every record inside is protected; the existence of the boundary is not. Knowing a
slug buys nothing, because joining needs a code, and the alternative punishes the
common case for the sake of an attacker who has learned a family name.
