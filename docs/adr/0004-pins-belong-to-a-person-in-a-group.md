# Pins belong to a person in a Group

Status: accepted (2026-08-02)

Supersedes the treatment of Pins in [ADR-0003](0003-three-scopes-personal-group-and-personal-records.md),
which listed them alongside the food diary and nutrition targets as a **Personal**
record — one set per person, reading the same from inside every Group.

A Pin is now one person's choice **in one Group**. It lives on their membership
row, which is already exactly the pair `(person, Group)`.

## Why the original call was wrong

ADR-0003 grouped Pins with the food diary because they are all "records about a
person rather than content they authored", and that much is still true. But it
carried a second claim along with it — that such records *should read the same
from every Group* — and Pins are the one member of that set where it does not
hold.

The diary and the nutrition targets are about a person's body. There is no
sense in which they differ by household, so making them follow the person is
the only coherent answer. A Pin is not about the person; it is about a *room*.
It answers "what do I reach for first **here**", and the honest answer differs:
a wine club wants Wines and Notes near the top and has no use for the Baby log;
a household wants Recipes, Tasks and the Baby log and will not open Wines this
year. One list forced across both is wrong in each of them, and the more Groups
somebody is in the wronger it gets.

That the storage happened to be a single field on the user row made the
constraint invisible. It read as a property of Pins; it was a property of where
they had been put.

## Why the membership row

A membership already exists for exactly one person in one Group, is already
created and destroyed at exactly the right moments, and is already the row every
Group-scoped authorisation resolves through. A separate `pins` table would
duplicate that pair, need its own index, and need its own cleanup on leaving.

It also gives a Pin the lifetime it should have. Pins describe a place. Leaving
a Group destroys the membership and takes the Pins with it, rather than leaving
choices about a room behind after the door is shut — and rejoining starts a
fresh membership, so it starts a fresh choice.

## What did not change

A Pin is still **one person's**, and still invisible to everybody else in the
Group. `setPins` reaches the caller's own membership, resolved from their own
identity and the Group in the URL, so it can touch no other person's row. A
Group still never enables or disables a Module for its Members: every live
Module remains available in every Group, and Pins only decide what one reader
sees first.

## Migration

Expand–contract, with no backfill.

`users.pinnedModuleIds` is no longer written. It is still *read*, as the seed
for a Group the reader has not chosen Pins in — so every Group opens with the
Pins they were used to, and nobody signs in to find their navigation reset. Once
that field has stopped mattering, the contract step drops it.

The reading order, resolved in `convex/users.ts` and finished in
`src/lib/pins.ts`:

1. this membership's `pinnedModuleIds`, if it has one — including an empty
   array, which is a real choice to pin nothing;
2. otherwise the person's pre-ADR-0004 list on the user row;
3. otherwise the default defined in code.

## Consequences

Every read of Pins now names a Group, so the shell asks for them only once it
knows which Group it is drawing — and asks for none at all on a route that names
no Group.

ADR-0003's three scopes stand. Pins simply leave the **Personal** column: they
are neither Group-scoped content nor a Personal record, but a person's own
setting *about* a Group. CONTEXT.md's glossary says so directly rather than
filing them under a heading that no longer fits.
