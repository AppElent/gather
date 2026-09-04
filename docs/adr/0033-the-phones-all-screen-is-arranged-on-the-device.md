# The phone's All screen is arranged on the device

Status: decided (2026-09-02)

The All tab lets a person pin, hide, reorder and collapse Modules, and choose
whether the screen is drawn as rows or as tiles. All of it is kept on the
handset. None of it reaches Convex, and the phone's pinned list is a **second,
separate list** from the one the web keeps on the membership row.

## Context

ADR-0005 put Pins on `memberships.pinnedModuleIds`, reached through
`users.myPins` and `users.setPins`, because a Pin is one person's choice *in one
Group*. The web has used them since; the phone never has.

Making the All screen arrangeable raised the question again, now with four more
fields beside it — a module order, a category order, a hidden list, a collapse
state — and one more that is not about a Group at all, the list-or-tiles view.

## Decision

- **The phone's All arrangement lives in `expo-sqlite/kv-store`**, one JSON blob
  per Group under `gather:all:arrangement:<groupSlug>`, plus one global
  `gather:all:view`. `apps/mobile/src/prefs/moduleArrangement.ts` is the only
  file that knows this.
- **The phone's pinned list is part of that blob.** It is not read from, and not
  written to, `users.myPins` / `users.setPins`.
- **The web is untouched.** Its Pins stay on the membership row, and ADR-0005
  continues to describe them.
- **The reconciliation is shared even though the storage is not.**
  `packages/core/src/moduleArrangement.ts` is pure and holds every rule about
  what a stored arrangement means, so the day the web adopts any of this it
  cannot answer "where does a new Module appear" differently.
- **Per Group, still.** ADR-0005's reasoning survives the move: a Pin answers
  *what do I reach for first **here***, so the key carries the Group slug, the
  way `babyChildKey` already does. The view is per *phone*, not per Group.
- **Hiding is a display choice and nothing else.** A hidden Module is still
  reachable from Search, from Home, and from every deep link. It is not
  disabled — ADR-0022 stands, and a Module is still configured by its content
  rather than by a switch.

## Consequences

**The two clients' pinned lists diverge, and that is accepted.** Pinning
Recipes on the phone does not pin it in the web sidebar, and vice versa. One
glossary word — Pin — now names two lists that do not agree. That is the real
cost of this decision, and it is written here rather than left for somebody to
find.

A reinstall forgets the phone's arrangement, and a second device starts from
the defaults. For a screen-layout preference that is a fallback rather than
data loss, and it lands on the same defaults a new install has.

Nothing on the All screen is a subscription any more, so the screen draws its
first frame from a synchronous read with no loading state and no query.

## When to reopen

- When the web wants the same arrangement, at which point the shared half is
  already in `@gather/core` and only the storage has to move.
- When the divergence between the two pinned lists is reported as a bug rather
  than experienced as two independent screens — that is the signal that this
  was the wrong call.
- When there is a general per-person, per-Group settings blob on the server that
  this could join without inventing four columns for it.

## Amends

ADR-0005 — Pins belong to a person in a Group. Its *what* and its *scope* stand;
its *where* is now client-specific.
