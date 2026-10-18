---
type: contract
description: Read when changing the share sheet, a Drop, its destinations, host rules, or expo-share-intent.
version: 1.0.0
status: current
---

# Drop

Gather takes one row in the phone's share sheet and opens on a chooser. What
arrives is a **Drop** — a link, some text, a photo — with no Group and no Module
until a person names them ([ADR-0028](../adr/0028-a-drop-is-nothing-until-a-person-names-its-destination.md);
glossary in [GLOSSARY.md](../../GLOSSARY.md)). *Share* is not the word for it:
that already means making Group content visible to a second Group.

## Behavior

- **`apps/mobile/src/drop/dropTargets.ts` is where a Module says what it
  accepts.** `DROP_TARGETS` is an exhaustive record keyed by `ModuleId`: a
  Module that accepts nothing declares an empty list, and a new Module fails
  `pnpm typecheck` until somebody answers. `DROP_ORDER` is the declared order
  per kind (`url`, `text`, `image`).
- **Host rules preselect and never restrict.** `packages/core/src/dropRules.ts`
  (`DROP_HOST_RULES`) may put a destination on top; it may never take one off
  the sheet. A stale rule then costs one extra tap rather than a dead end.
- Confirming switches the app's Group to the chosen one and lands the person on
  what they made: the screen changing is the confirmation.
- **A Drop is native surface.** `expo-share-intent` is a config plugin, so
  touching it moves the fingerprint and the change cannot ship over the air
  ([ADR-0029](../adr/0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)).

## Acceptance

- The share sheet cannot be driven by `agent-device`: link and text Drops are
  verified through the `gather://drop` harness, image Drops by sharing a photo
  by hand ([mobile verification](../runbooks/mobile-verification.md#verifying-a-drop)).
