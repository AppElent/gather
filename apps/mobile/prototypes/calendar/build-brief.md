# Calendar, on the phone — the build brief

**Canvas:** https://claude.ai/code/artifact/e9cd5258-d2ad-4ddc-9380-e606deb76c35
**Decided:** 2 September 2026. **Scope:** `apps/mobile`, local calendars only.

Fourteen artboards. The top row is the decision; the three rows below it are the
directions it was chosen from, kept because the argument is the useful part.
Sources are the `_*.mjs` files beside this one — `node _build.mjs` regenerates
every `.dc.html` and `canvas.json`.

---

## The three decisions

### 1. All three layouts, behind the switcher iOS already has

Month, Week + agenda, and Agenda all ship. They are not rival designs; they are a
preference, and the platform has a control for exactly that: an
`ellipsis.circle` in the nav bar opening a menu with a checkmark on the current
view — the same affordance Files, Mail and Photos use for "how should this be
displayed". Not a segmented control and not a custom toggle.

The menu also carries **Calendars…**, because a menu with one section reads like
a control that should have been a button.

The three mix artboards are one component at three starting views, which is how
they must be built too — one screen, `view` state, three bodies. Anything else
guarantees they drift.

**Where the preference lives: `memberships`.** Per device is free and silently
differs between a phone and a tablet; per person per Group is one column next to
`hiddenCalendarIds`, where `pinnedModuleIds` already sits. It is a person's
preference, not a household's, and the row already exists.

### 2. The cell says who — and a dot when nobody

C. Up to three marks per cell: an initial in a circle, tinted by its calendar,
for each person on an event. **An event with nobody on it is a dot in its
calendar's colour.**

That fallback is not an edge case. `calendarEvents` has no assignee column, so
on the day this ships *every* event is a dot, and the design only becomes itself
as households start using it. Anything that treats "no assignee" as unusual will
ship looking broken.

Day number: 12.5px, centred, muted — tint-filled circle for today. Selected day:
`tokens.tile` background with a 1.6px inset ring in the Module tint.

Overflow is `+n` counted in **marks**, not events: a two-person event is two
marks.

### 3. The composer is a card above the keyboard

B, re-cut around Todoist's iOS quick-add. What that reference actually settles:

- **Name field first and largest** — 21px semibold at the top of the card, caret
  already in it. Everything else is a 44pt chip beneath.
- **A card, not a sheet** — ~130pt, floating on a scrim, immediately above where
  the keyboard lands. It only ever grows *upward*, which kills the objection to
  a bottom sheet that resizes under your thumb.
- **The round button answers the Save question**, and better than either
  direction did on its own: **creating commits on the button** (grey until the
  name has a character in it, so a half-typed event never reaches the household
  calendar); **editing applies live** and the button becomes a ✓ that only
  dismisses. Create needs a commit; an edit does not. Same card, both jobs.
- **The `[+]` is where the long tail goes** — All-day, Where, Notes, and
  **Repeats…**, which is where recurrence lands without needing its own canvas.
- **Tapping the date chip opens the picker inside the card, and the card drops**
  to sit above the home bar — a picker dismisses the keyboard, so the space the
  card was avoiding is no longer there.
- **Not copied: Todoist's red.** The commit button and the set chips are the
  Calendar Module's own olive. One accent per Module.

The picker is `DueDateSheet`'s grid — Monday-first, six rows, Today / Tomorrow /
Weekend above it — **adopted, not redrawn**.

---

## Everything the canvas fixed, and must not be re-opened

- **Colour is the calendar. An initial in a circle is the person.** Two channels
  that do not compete.
- **A date is a `YYYY-MM-DD` string, never an instant.** No timezone conversion.
- **A person is an initial, never an avatar.** `convex/groups.ts` `members`
  returns a name and a standing and nothing else — there is no image field, by
  design.
- **A calendar's colour is a token name**, not a hex somebody picked. The
  swatches are `@gather/core/module-tints`.
- **Recurrence is a rule plus an `exceptions` array of skipped dates.** No
  per-occurrence overrides.

## What has to exist before any of it can be built

| Change | Blocks |
|---|---|
| `calendars.color` — a Module-tint token name | The whole colour channel |
| `calendarEvents.assigneeId` (or a small join) | The person channel; decision 2 |
| `kitchen.updateCalendarEvent` | Editing at all — it does not exist |
| `calendarEvents.allDay`, `location`, `notes` | The `[+]` chips |
| A view preference on `memberships` | Decision 1's switcher |

**Four calendar tints is a real ceiling.** A household with a fifth calendar has
no colour left. Nothing here answers that; it wants an answer before somebody
ships a colour picker.

## Costs accepted, written down so nobody rediscovers them

- **Initials collide.** Eric and Emma are both E. The fixture uses Mila to dodge
  it. Whatever disambiguates them is not designed.
- **The chip strip scrolls horizontally**, and a horizontally-scrolling row of
  controls is where people miss things. If "Where" turns out to matter it earns
  a permanent slot and something else goes behind the `[+]`.
- **Dismissal has to keep what you typed.** The scrim is tappable and the card
  dismisses to the calendar behind it; a dismissed draft that vanishes is the
  failure mode.

## One rule the drawing turned up

`monthGrid` always returns six rows so a sheet does not jump as you page it.
September 2026's sixth row is entirely empty. In the sheet that is right; on a
full screen it is 52 points of nothing. **The screen drops a trailing all-null
row; the sheet does not.**

## Deliberately not decided

- **The Outlook-style fluid header** — the week strip staying with you and
  growing into the month as you drag the agenda. A gesture question rather than a
  layout one, it wants a real device to judge, and it is complementary to the
  switcher rather than a rival. Its own canvas, later.
- **Which layout is the default** for a person who has never chosen. Week is
  drawn as `Main` because it answers the question people open the app with, but
  nothing rests on it.
- **External calendar subscription** (ICS / Google / Apple) — out of scope by the
  local-only line; still open on
  [#213](https://github.com/AppElent/gather/issues/213).
- **Per-occurrence edit of a recurring event.** Skipping one occurrence is a
  string in an array; moving one is an overrides table plus expansion logic in
  every query that reads events.
