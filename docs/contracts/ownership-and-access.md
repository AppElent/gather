---
type: contract
description: Read when changing who owns, sees, writes to, or is refused Group content or a Personal record, or how the Current Group is chosen.
version: 1.0.0
status: current
---

# Ownership and access

Every user-owned record belongs to one Group, and a Group's membership is the
only thing that decides who sees it and who may change it
([ADR-0030](../adr/0030-groups-are-the-only-user-owned-scope.md)). Terms are
defined in the [glossary](../../GLOSSARY.md).

## Behavior

- **Group-scoped content is either Private to its home Group or Public to
  other Groups.** Privacy comes from Group membership; a person does not own a
  private subset inside a Group
  ([ADR-0019](../adr/0019-public-recipe-collections-are-group-settings.md)).
- **The Current Group is selected by the person and validated against their
  memberships.** Web and mobile use the same ambient selection model; no hidden
  default determines ownership or access
  ([ADR-0031](../adr/0031-the-current-group-is-ambient-on-web-and-mobile.md)).
- **Whether you may change something follows its home Group from anywhere.**
  The Current Group is the destination for ordinary writes, and authorization
  still checks that the person is a Member of it
  ([ADR-0007](../adr/0007-a-write-happens-at-the-address-that-names-its-group.md)).
- **A refusal inside a Group never says which refusal it is.** "No such
  record" and "not in this Group" are one answer; refusing the Group itself is a
  separate, distinct one
  ([ADR-0009](../adr/0009-a-refusal-inside-a-group-never-says-which-refusal-it-is.md)).
- **A Personal record snapshots what it references.** Provenance is
  permission-checked on read and safe to dangle. A **Combo** is the deliberate
  exception and says why: it is a shortcut for what will happen rather than a
  record of what did, so it holds references and reads their current figures
  ([ADR-0012](../adr/0012-a-combo-is-a-personal-shortcut-and-not-a-recipe.md)).

## Acceptance

- A record outside the caller's Groups and a record that does not exist return
  the same refusal; an unknown Group and a Group the caller is not a Member of
  return different ones.
