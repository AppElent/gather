# Three scopes: Group, Personal, Catalog

Status: accepted (2026-07-28); amended by
[ADR-0005](0005-pins-belong-to-a-person-in-a-group.md) (2026-08-02), which moves
Pins out of **Personal**. The three scopes stand; Pins were the wrong example of
one. Everything below reads as written except that "pins" is no longer among the
Personal records.

Data in Gather has exactly three owners, and the split is not the obvious one.
**Group-scoped** content belongs to a Group (recipes, tasks, a baby's log,
integration connections). **Personal** records belong to a person and follow
them across every Group (food diary, nutrition targets, pins). The **Catalog**
— the food database — belongs to nobody.

## Why not two

The tempting simplification is "everything is Group-scoped", using each person's
Personal group to hold whatever is private. It fails on the difference between
*content someone authored* and *records about someone*. A food diary is the
latter: it should survive deleting your Personal group, it should not be
inherited by a household if one is ever merged or renamed, and it should read
the same from inside any Group. Pinning it to a Group would make Nutrition work
only inside your Personal group and behave unlike every other Module.

The equally tempting simplification in the other direction is a `private` flag on
content. We rejected that too: it is a second visibility mechanism alongside
Groups, and every Module and every query then has to honour both. The Personal
group achieves the same result with no new concept — privacy is a consequence of
*which Group* something lives in.

## Consequences

Every user gets a Personal group at signup, so there is never a "create your
first Group" empty state and sign-in always has somewhere to land.

Personal records may reference Group-scoped content — a diary entry recording
which recipe it came from. Those references are **provenance**, not
dependencies: the record snapshots what it needs at write time, and the
reference is permission-checked on read and allowed to dangle. This is why a
diary entry stays readable forever even after you leave the Group whose recipe
it came from, and why nutrition is never recomputed from a recipe the owner can
no longer see.

Group-scoped content is owned by one Group and may additionally be **shared**
into others; the person who created it is recorded as **attribution** only.
Content created in the wrong Group is fixed by a *move* between Groups, not by
transferring ownership between people.
