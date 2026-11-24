---
type: contract
description: Read when changing the share sheet, a Drop, its destinations, host rules, or expo-share-intent.
version: 1.5.0
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
  same path a tapped notification takes; navigating in the same tick as the
  switch would be undone by the switch's unwind of the tab stacks.
- **Every arrival opens the chooser on top.** A share closes any open
  `NativeSheet` or keyboard composer first, the way its Close does (`onClose`
  runs once), because both are presented above the stack and would hide the
  chooser (`src/components/openSheets.ts`). Nothing a share closed reopens
  what was under it: Repeat does not bring its composer back.
- **A share waits for a prompt.** An OS dialog cannot be closed from JS, so the
  chooser waits until a `usePrompt` prompt is answered; the answer lands in the
  form, which is then closed and kept like any other. The wait also ends when
  the form that asked is gone. There is no time limit, which would lose what is
  being typed. Outside iOS a prompt does nothing and holds nothing. A
  share also waits, at most five minutes (`ALERT_HOLD_MS`), for an alert whose
  answer opens a sheet (`showAlert` with `holdsShare`: the calendar's
  unsaved-changes questions). Any other alert stays in front of the chooser and
  loses nothing.
- **There is one chooser.** The chooser route is singular
  (`app/(app)/drop/_layout.tsx`): a second share, or `gather-dev://drop`, while
  one is open brings it back to the top and does not stack another. It shows
  the Drop pending now, so a replacing share replaces what it showed.
- Arrivals are counted for the whole session, so a share after a finished or
  abandoned one opens the chooser again.
- **A share keeps what was typed.** The person did not ask for that close,
  so every sheet form with input keeps it, in memory, per account and Group
  ([editors](../standards/editors.md), APP-622). A form whose state lives in
  the sheet uses `useSheetDraft` (`src/ui/sheet-drafts.ts`, on the composer
  draft store) and opens on the draft next time. A finance screen holds its
  sheet's state itself, so it uses `useSheetResume`, which keeps the values in
  the same store and puts them back instead of seeding. A close the person chose (Cancel, Close, a swipe) still
  discards, as before. Nothing is kept while a save is on its way, unless that
  save then fails, and a save that lands late closes nothing opened since. No form needed to ask instead. Covered:
  - **Tasks:** quick sheet task line (`QuickAddTask`, APP-618), New list,
    Rename task or list, Labels, Sections (new section, rename), Reminder, Repeat.
  - **Baby log:** Quick log (types, fields, notes, time, photos), quick to-do
    or question.
  - **Calendar:** new calendar name; the event editor opened from an event
    resumes its kept draft, a copy or a failed save included (it was already
    kept from the calendar screen). The calendar keeps one draft per Group: an
    event edited next replaces it. A draft being saved is locked.
  - **Kitchen:** Add to groceries (ticks, retyped lines, list, servings or
    days), Pick (search, filters, quick meal), Plan my week, Swap (wish, chip,
    and the answers already paid for), a planned meal's changes (a share saves
    nothing; any other close still saves).
  - **Tasting:** the subject picker's typed name, a vocabulary's search.
  - **Finances:** Add savings goal, saved so far and monthly, Add recurring
    cost, its amount, note and split, Add holding, Add transaction, Update
    price, buying-cost values, house and calculation fields, loan-part
    fields, Duplicate calculation, Add payment and Save scenario, New
    house, Add asset or liability.

  A photo a form uploaded belongs to its draft: a reopened form takes up the
  upload its closed row started, and the upload is forgotten with the draft, so
  a new or discarded draft never takes up an earlier one (`photo/uploads.ts`,
  APP-734). Add to groceries keeps its ticks, retyped lines and open editor
  under the ingredient's own text, not its position, so a reordered recipe
  leaves each on its own row (`ingredientKeys`).

  Not forms, so nothing to keep: pickers and menus whose taps apply at once.
  Custom allocation edits the Split screen's own state, which lives as long as
  that screen. The keyboard composer (task, note, event, grocery item) keeps its
  own draft on every close, a share included.
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

- Link and text Drops are verified through the `gather-dev://drop` harness
  when nothing is open. A real share is driven on the iOS simulator with
  `agent-device`: open Safari, tap its Share button, then tap Gather's row with
  coordinate taps, because the share sheet's accessibility refs report stale
  frames. That is how a Drop over an open sheet or prompt is checked. Image
  Drops are verified by sharing a photo from the Photos app by hand
  ([mobile verification](../runbooks/mobile-verification.md#verifying-a-drop)).
