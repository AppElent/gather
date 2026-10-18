---
type: contract
description: Read when changing the share sheet, a Drop, its destinations, host rules, or expo-share-intent.
version: 1.1.0
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
- Confirming switches the app's Group to the chosen one and, once that Group
  is on screen, lands the person on what they made: the screen changing is the
  confirmation. The switch and the landing go through `useOpenInGroup`, the
  same path an old `/g/<slug>` link takes; navigating in the same tick as the
  switch would be undone by the switch's unwind of the tab stacks.
- **The commit clears the Drop.** A target that has not written by the time it
  navigates declares `keepsDrop` (today only `recipe-import`): its screen is
  pushed over the chooser with the Drop still pending, so Back still has
  somewhere else to put it, and that screen's own successful save clears the
  Drop the way every other commit does. The Group a Drop is aimed at is held
  as a Group id, and stage two lists and writes into that same Group.
- **A Drop is native surface.** `expo-share-intent` is a config plugin, so
  touching it moves the fingerprint and the change cannot ship over the air
  ([ADR-0029](../adr/0029-a-javascript-change-ships-over-the-air-and-a-native-one-does-not.md)).
- **`expo-share-intent` is the only way in.** `expo-sharing` is installed to
  share *out* ([data export](data-export.md)) and its config plugin is kept
  out of `app.json`: its share-into half would register a second receiver for
  the same intents and extension.

## Acceptance

- The share sheet cannot be driven by `agent-device`: link and text Drops are
  verified through the `gather://drop` harness, image Drops by sharing a photo
  by hand ([mobile verification](../runbooks/mobile-verification.md#verifying-a-drop)).
