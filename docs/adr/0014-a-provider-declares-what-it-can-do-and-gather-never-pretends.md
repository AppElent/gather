# A provider declares what it can do, and gather never pretends otherwise

Status: accepted (2026-08-10)

Every Task Backend advertises a **capability list** — can it create, edit,
complete, delete, reorder, nest? — and the Module reads that list rather than
the provider's name. An operation a Backend does not support is offered
disabled, with the reason, and is never carried out against the cache alone.

Companion to [ADR-0013](0013-an-external-backend-is-authoritative-and-gather-caches-it.md),
which settles who owns the records.

## Why not emulate

Emulating a missing operation locally produces a lie with a long half-life. A
task "completed" in gather that Notion never heard of looks completed until the
next refresh silently un-completes it, and in between, one Member has ticked
something the rest of the household still sees as open. The provider owns the
record; a change it did not accept did not happen, and the honest interface for
that is a control that says so before it is pressed rather than a change that
evaporates afterwards.

## Why capabilities and not `provider === 'todoist'`

The Module must not branch on provider identity. Branching on the name puts
provider knowledge in feature code, spreads on every new provider, and cannot
express the case that is actually common: **the same provider differing per
source**. A Notion database with no date property has no due dates whatever
Notion supports in general, and a capability list computed for a source can say
that where a provider name cannot.

Two levels, therefore: a baseline per adapter, narrowed per source where the
source itself is narrower.

## What is capable of what, at the time of writing

**Todoist** is writable: create, edit, complete and reopen, delete, and nested
subtasks. Ordering stays Todoist's, so gather does not offer to reorder.

**Notion** is read-only. Its property mapping is arbitrary per database, so a
write means deciding what to put in properties gather did not choose and does
not understand, and its sub-page model is not the subtask model the common Task
record has. That design is worth doing on its own and is not smuggled in here.

**Local** supports everything, being nothing but this app.

## The common Task record

Title, completion, due date, priority, labels, and nested subtasks. A field the
common record does not have stays at the provider, untouched — gather does not
round-trip what it cannot represent, and does not drop it either.

Subtasks are arbitrary depth in the domain model, bounded by whatever the
provider enforces; the bound is part of the capability list rather than a
constant in feature code.
