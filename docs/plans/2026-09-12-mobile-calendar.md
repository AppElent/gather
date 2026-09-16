# Mobile calendar: definitive design and implementation plan

Status: implementation handoff, 12 September 2026.
Repository inspected at `38122d0c`; re-check paths and contracts if HEAD changes.
Origin: [issue #213](https://github.com/AppElent/gather/issues/213).

The user chose the fluid calendar header, WHO marks, and card editor; requested
continuous scrolling across days; and confirmed **explicit saving with ✓** and
**mobile first, web later**. This document turns that direction into a bounded
first delivery. The detailed defaults below are implementation decisions made
for this handoff, not additional quotations from the user.

## How to execute

Read the root `AGENTS.md`, `CLAUDE.md`, calendar entries in `CONTEXT.md`, and
`docs/mobile-interaction.md` first. Read the applicable Convex skill before backend
edits, and agent-device instructions before device work. Use pnpm. Preserve
unrelated changes. Check the Appelent catalog before extracting any cross-app
capability; this plan calls for a Gather calendar, not a new shared package.

Implement milestones 1–8 in order. Each has a completion check. A new session
should read this document and inspect the actual diff before resuming the first
unfinished milestone. Report completed milestones, files, checks, and remaining
failures at handoff. Check boxes below are execution status, not a checklist to
mark based on reading the plan.

This plan authorizes implementation and relevant local/dev verification. It does
not request a production deploy, release update, sample-data reset, or PR merge.
Preserve Labs as a design reference. Implement production code outside `src/labs`.

## Delivery boundary

Ship mobile local calendars with: Month / Week + agenda / Agenda presentations;
continuous dates; synchronized selection; fluid header; calendar colours; multiple
assignees; private calendar and people filters; create/edit/duplicate/delete;
all-day or same-day timed events; location and notes; recovered local drafts.

Deferred: web UI, recurrence, reminders, external feeds/sync, cross-module agenda
entries, attachments, event drag-to-reschedule, multi-day/overnight events, and
offline mutation queues. Render no disabled placeholders for deferred features.
Keep Calendar's web availability metadata unchanged until the web is implemented.

The September 2 prototype brief remains historical. This plan supersedes its
live-save rule, three-mark cells, horizontally scrolling chip strip, recurrence
instructions, and single-day body. One screen may use separate small components;
sharing state and domain logic is what prevents drift, not keeping one giant file.

## Product contract

### Calendar surface and navigation

- First visit: Week + agenda, anchored to today. Subsequent visits restore the
  Member's preferred presentation. Returning from an editor preserves position;
  a fresh app launch starts at today in the preferred presentation.
- Header: localized month/year, Today, native view/options menu, and Add. Menu:
  Month, Week + agenda, Agenda, Calendars…, People…. All controls have translated
  accessibility labels. Show an active-filter indicator whenever filters narrow
  the content. Calendars/People open native sheets.
- Month and Week show the same agenda under different header heights. Agenda
  hides the date grid. Switching presentation preserves the active date and row.
- One `activeDate` drives selection, the header month/week, and Add's default
  date. During scrolling it is the date of the first content row below the sticky
  day heading. During a deliberate jump it remains the requested target until
  that jump finishes or the user interrupts it.
- Today changes `activeDate` and scroll position together without changing layout
  or filters. Recompute today on foreground/resume and local midnight; never
  reinterpret stored event times when the device timezone changes.
- Tap a date to jump to that date's agenda heading, even when empty. Tap the
  month/year title to open a date navigator for distant dates. Paging the month
  inside this navigator previews it; choosing a day performs the jump.
- Sideways header swipe moves activeDate by seven days when compact. When
  expanded, it moves one month, clamping the day to that month's last day.
  A compact week always contains seven real dates, including adjacent months.
- Expanded month is Monday-first. Use existing `monthGrid`; omit a trailing
  all-null row on the main screen, preserve six rows in the date picker.
- Hold an event opens the native action menu; swipe left reveals Delete which
  must be tapped and confirmed. Hold a date opens a menu containing Add event.
  Add remains available without a hold. Do not assign event dragging to hold.

### Continuous agenda and gestures

| Gesture | Required result |
| --- | --- |
| Upward agenda movement with expanded header | Consume movement to collapse header, then use remaining movement to scroll events in the same gesture |
| Downward agenda movement | Scroll toward earlier dates; keep a compact header compact |
| Vertical drag on header or its handle | Follow the finger between Month and Week, settle according to position and velocity |
| Sideways drag on header | Page week/month; retain platform edge-back gestures |
| Tap header handle | Toggle Month/Week; accessible alternative to dragging |
| Scroll across a month boundary | Update grid/month label/selection without resetting list momentum |

One gesture coordinator owns header displacement and list handoff. Capture the
current presentation value when interrupted, track continuously, and pass release
velocity to the settling spring. Header expansion/collapse preserves the first
visible agenda row and its relative offset. Automatic collapse does not overwrite
the saved view preference; explicit menu/handle choices and header drags do.
Keep `preferredView` separate from the current header presentation: the menu
checkmark reflects the visible presentation, while a fresh launch restores the
saved preference. Thus auto-collapse may show Week while preserving Month as the
next launch's preference.

Use a virtualized list with stable keys for headings, events, empty days, gaps,
and loading boundaries. All-day events precede timed events; timed events sort by
start time, then localized title, then ID as a stable tie-breaker. Day headings
stick immediately below the calendar header. Rows show time/all-day, title,
calendar name, assigned-person badges, and location when set. Notes stay in editor.

Empty runs of 1–6 days get compact dated “Nothing planned” rows. Runs of 7+ days
become a compact row with explicit start/end dates, e.g. “No events · 12–20 Sep”.
Keep today and an explicitly selected day individually visible, splitting a gap
around them. A gap's active date is its first date. Tapping it expands its days
until the user navigates away from that loaded month. Never describe unloaded
dates as empty or silently skip a date selected in the grid.

### WHO, calendar colour, and filters

- A cell shows one mark plus `+n`. Each event contributes one mark per assignee,
  or one coloured dot if unassigned. Count overflow in marks, not events. Repeated
  appearances of the same person on different events remain separate marks.
  Example: a two-person event plus an unassigned event = 3 marks = badge + `+2`.
- Derive initials from the Member name. Use one initial where unique; use the
  first two letters of the name where first initials collide (Eric → ER, Emma →
  EM). If those also collide, retain two letters and rely on full names in rows,
  accessibility labels and the picker; do not create tiny numeric identifiers.
- Calendar colour uses the existing four `ModuleGroup` tint names: `home`,
  `kitchen`, `money`, `tasting`. Reuse colours when there are more calendars;
  calendar names remain visible. No four-calendar cap or palette expansion.
  Existing calendars without a colour use `home` consistently. New calendars
  default to the least-used tint, ties resolved in the order above.
- Today uses a filled date marker; selection uses an outline/tile. Both can be
  present on the same date. Preserve Gather theme tokens in light and dark.
- WHO means involved Members, not authorship. It supports zero or many current
  Members, and never defaults to the event creator. New events start unassigned.
- People filter: Everyone (reset), individual Member selections, and Unassigned.
  Match any selected person OR Unassigned, then intersect with visible calendars.
  No selection means show none, not Everyone. Default is Everyone.
- Filters and preferred layout belong to the caller's membership. Hiding a
  calendar never changes Group data or somebody else's preference. Clear filters
  is available from a filtered-empty state. Month marks use the same filters as
  the agenda. The UI says “No matching events” when filters cause emptiness.

### Card, expanded sheet, and explicit saving

The compact card is a deliberate calendar-specific overlay above the keyboard.
The expanded presentation uses the existing `NativeSheet`. Both operate on one
draft owned above their presentation components. Switching presentation never
saves, clears, reinitializes, or duplicates that draft. Only one editor is visible.

Create: title focused first, selected date, all-day initially, unassigned, first
visible calendar sorted by name/ID. If none is visible, require a calendar choice;
if none exists, offer Create calendar before an event can be saved. Choosing Time
requires a valid start/end pair. Remember unsaved time values if All day is toggled
on and back off during the same editing session; omit times in the saved all-day
payload.

Edit: tap event opens card with all stored fields. Initially keep the keyboard
closed so WHO/time are immediately usable; tapping the title opens it. Show a
labelled expand control and “More details”, either of which opens the full sheet.
The compact card keeps Date, Time/All day, Who, Calendar visible with wrapping.
The sheet exposes the same fields plus Location and Notes, in that order. It has
Save, Close, and a collapse control. Date/time pickers temporarily take the
keyboard's space. If the title was focused before opening a picker, refocus it
after the picker closes; otherwise leave the keyboard closed.

At large text sizes or when keyboard plus card would leave less than 48 logical
points for context, open the scrollable expanded sheet instead. The editor must
remain usable on short screens and Android with either navigation-bar mode.

| Action | Local draft | Backend |
| --- | --- | --- |
| Type/change a field | Update and retain | No write |
| Expand/collapse/picker change | Preserve | No write |
| Close/scrim/back/swipe-dismiss | Retain recoverable dirty draft; return to calendar | No write |
| ✓ / sheet Save / title keyboard Done | Validate; lock duplicate submit; keep open while pending | One create or complete edit |
| Successful save | Clear draft; close | Record exists with all fields together |
| Save failure | Keep input and display translated inline error | No false success |
| Discard draft | Confirm when dirty, then clear | No write |
| Duplicate | Open a create draft with copied fields and fresh identity | No write until Save |
| Delete | Native confirmation; clear this event's draft only after success | Delete existing event |

Save only when valid, changed (for edits), connected, and not already submitting.
On a confirmed save of a new event or a changed date, jump to its saved date. For
an edit on the same date, preserve the agenda position. If filters hide the saved
event, keep filters and show “Saved; hidden by your filters” with Show all.

Store one dirty draft per signed-in user and Group locally, using the existing
`expo-sqlite/kv-store` mechanism, with a schema version, event ID (if editing), and
base revision. Show a “Resume draft” row on returning to the calendar. Opening
that same event resumes its draft. Starting another operation while a different
draft exists offers Resume, Discard and continue, or Cancel; never overwrite it
silently. An untouched create/unchanged edit needs no retained draft.

Persist after changes with a short debounce, flush on dismissal/background, and
keep active memory state until persistence succeeds. Storage errors must be
visible; the best-effort preference writer that swallows errors is unsuitable for
promising draft recovery. Namespace keys by authenticated user ID and immutable
Group ID, not slug. Sign-out removes this user's drafts; lost membership prevents
display and clears that Group's draft once membership loss is confirmed. Temporary
connection loss is not membership loss. Corrupt/unknown-version data produces a
recoverable “Draft could not be restored” message without crashing the screen.

Respect ADR-0031: switching Group with an open dirty editor asks confirmation
(Keep draft and switch / Stay). On forced access loss close it; never render the
old Group's draft or event under the new Group. A dismissed, successfully retained
draft does not block subsequent navigation.

Concurrent edits: send the event's base revision on Save. If another Member saved
first, preserve the draft and show that the event changed, with Reload latest
(confirm replacing dirty draft) and Keep editing. Keep editing does not update
the base revision or silently overwrite the other Member. A deleted event offers
Save as new or Discard; it must not be silently resurrected by update.

## Data and API contracts

### Backward-compatible storage

Existing rows and already-installed mobile clients must remain valid. New fields
are optional in the schema; new code normalizes them on reads. This first delivery
needs no destructive migration or data wipe. Keep compatibility defaults until a
separate migration records complete backfill and retirement of old clients.

| Table | Addition | Absent value means |
| --- | --- | --- |
| `calendars` | `color?: ModuleGroup` | `home` |
| `calendarEvents` | `allDay?: boolean` | true when both existing time fields are absent |
| `calendarEvents` | `assigneeIds?: Id<'users'>[]` | `[]` |
| `calendarEvents` | `location?: string`, `notes?: string` | empty |
| `calendarEvents` | `revision?: number` | `0` |
| `memberships` | `calendarView?: 'month' \| 'week' \| 'agenda'` | `week` |
| `memberships` | `calendarPeopleFilter?: { userIds: Id<'users'>[]; includeUnassigned: boolean }` | Everyone |

Keep `hiddenCalendarIds`, ownership through `calendarId`, `createdBy`, and the
existing `by_calendar_date` index. Use user IDs because `groups.members` already
returns `{userId, name, role}`. Validate every newly selected assignee against
current membership in the event calendar's Group. Existing departed/deleted IDs
remain readable as “Former member” without looking up private user details; allow
unchanged legacy IDs on edit or their removal, but never newly add them. They do
not match Unassigned while still stored. No global account-deletion redesign.

Dates are valid `YYYY-MM-DD` civil dates, never ISO timestamp conversions. Timed
events require integer `0 <= startMinutes < endMinutes < 1440`; all-day clears
both fields. Validate actual dates (reject February 30), nonblank trimmed titles,
title <= 200 characters, location <= 500, notes <= 10,000, and unique assignee IDs.
Location/notes clear explicitly: the complete edit payload uses `null` for empty
optional values; the mutation removes the corresponding stored fields. These
limits are handoff defaults, applied consistently on server and client.

### Backend surface

Keep existing `api.kitchen` exports/callers working. Put shared calendar validation
and access helpers in `convex/lib/calendar.ts`; production-specific new functions
in `convex/calendar.ts`. Use generated server imports, args/returns validators,
and existing `requireGroupBySlug`. Resolve Group membership before returning a
record; missing and foreign-Group records receive identical refusals (ADR-0009).

| Function | Contract |
| --- | --- |
| `calendar.listCalendars` | `{groupSlug, paginationOpts}` → paginated calendars, indexed by Group |
| `calendar.preferences` | `{groupSlug}` → normalized view, hiddenCalendarIds, people filter for caller |
| `calendar.listEvents` | `{groupSlug, calendarId, from, toExclusive, paginationOpts}` → paginated normalized events using `by_calendar_date`; bound range to one calendar month, page size <= 100 |
| existing `kitchen.addCalendar` | Accept optional colour; retain old call shape; validate nonblank name; return ID |
| `calendar.updateCalendar` | `{groupSlug, id, color}` → null; same Group access policy as add/remove |
| existing `kitchen.addCalendarEvent` | Accept optional new fields; preserve title/date/time legacy shape; normalize omitted allDay/assignees; create revision 0; return ID |
| `calendar.updateEvent` | `{groupSlug, id, expectedRevision, title, calendarId, date, allDay, startMinutes, endMinutes, assigneeIds, location, notes}` → `{id, revision}`; nullable fields follow the complete-edit contract above; validate and write all fields atomically, increment revision |
| existing `kitchen.getCalendarEvent` | Add normalized fields, calendarId, colour and revision; retain existing fields; return null for missing/foreign event after Group access check |
| existing remove/visibility mutations | Preserve behavior and Group authorization; keep translated UI confirmation and error handling |
| `calendar.setPreferences` | Partial patch of view/people filter only, caller membership only; `peopleFilter: null` resets Everyone, omitted preserves; validate selected current Group users |

Use `groups.members({slug})` for Member names. Reuse existing auth/access helpers;
do not replace Clerk or introduce a generic authorization framework. Validate
source and destination calendars on an event move; both must be in Current Group.
Increment revision for every future event update path. A no-op update returns
without changing revision. Translate structured calendar error codes at the UI.
The core module owns pure field validation; `convex/lib/calendar.ts` calls it and
adds authorization, membership and database checks rather than copying its rules.
For create, adapt nullable empty fields to the existing optional-argument API;
for update, send explicit nulls so clearing a property cannot become omission.

### Loading and scroll state

The old `kitchen.overview` reads meals, recipes, pantry and all calendar events
before filtering. Keep it for its existing callers; the new screen uses only the
calendar functions above. Date-bounded pagination avoids collecting event history.

Use one query-source component per visible-calendar/month pair. Each calls
`usePaginatedQuery` at its own top level, publishes keyed results to the parent,
and loads subsequent pages until that month's results are complete. Do not call
hooks in a variable-length loop. Paginate calendar metadata too. Keep the current,
previous and next month subscribed; prefetch the next month in the direction of
travel when within seven dates of the loaded boundary. Allow at most five loaded months during transition,
then evict distant months after scrolling settles. This deliberately trades a
few subscriptions for keeping the existing calendar ownership/index schema.

Merge/deduplicate by event ID, then sort within dates. A move between two loaded
calendar sources must never produce two copies; when transitioning sources report
the same ID, prefer its higher revision. Hidden calendars are skipped by
the screen, not unauthorized by the server. Filters apply consistently to the
merged results. Mark a date empty only after all relevant sources are complete;
pending/error boundaries have a retry affordance and retain existing content.

Maintain `{rowKey, offsetWithinRow, date}` as the visual anchor before prepend,
eviction, filter changes, reactive updates or text-size changes. Restore it after
layout; if the event disappeared, anchor its date heading. Distant date jumps
load around the target instead of walking through intervening months. Suppress
viewability-driven selection during programmatic jumps, releasing suppression
on success, interruption, or failure. Cancel stale jump requests on Group change.
For variable-height rows, handle `onScrollToIndexFailed`: scroll to the estimated
offset, wait for measurement and retry the still-current jump. Stop on user
interruption or missing data; do not use fixed arbitrary delays or a retry loop
that can pull the list back after the user starts scrolling.

## Implementation milestones

### 1. [ ] Build the pure calendar model and translated vocabulary

Create `packages/core/src/calendar.ts` and export it as `@gather/core/calendar`
from `packages/core/package.json`. Own normalization, civil-date validation,
field validation returning message keys, marks/overflow, initials, filtering,
event ordering and agenda row construction here. Keep React, Convex and native
imports out. Generic string IDs in the pure model are fine; validate branded IDs
at the backend boundary. Reuse the behavior of task date helpers, without making
core depend on a mobile file or refactoring Tasks in this change.

Add `packages/core/src/messages/{en,nl}/calendar.ts`, wire both locale index files,
and expose `calendar: coreEn.calendar` / Dutch equivalent from
`apps/mobile/src/i18n/messages/{en,nl}.ts`. Production code uses `t.calendar`, not
Labs strings. Include all field, empty/loading, filter, draft, validation and
conflict messages. Visible labels include names; initials are only compact marks.

Completion: `packages/core/src/__tests__/calendar.test.ts` covers leap dates,
month/week boundaries, DST-safe date arithmetic, time limits, field clearing,
duplicate initials, mark overflow, filtered emptiness, 6-vs-7-day gaps and a
selected date inside a gap. Core typecheck and focused tests pass.

### 2. [ ] Prove continuous scrolling and header handoff on device

Create `apps/mobile/src/modules/calendar/CalendarScreen.tsx`,
`CalendarHeader.tsx`, `CalendarAgenda.tsx`, and `calendarNavigation.ts` with its
pure state tests. Add a dev-only Labs entry for this production component using
injected fixture data; preserve the existing variant screen for comparison.
Keep fixture adapters in Labs so production does not import them.

Build one `FlatList` of typed rows, the stable-anchor mechanism, date jumps and
header gesture coordinator. Reuse theme, `MonthGridView`, date helpers, native
menus, and installed Reanimated/Gesture Handler. Verify the exact installed API
types before coding gestures. Use transform/clipping during the drag; reconcile
layout at settle so the last row is reachable with no invisible overlay or
permanent blank footer. Measure header height with current font size.

The header/list handoff must follow the product contract. Reduced Motion removes
spring overshoot/automatic travel while preserving direct finger tracking and
the explicit Month/Week controls. Preserve native scroll momentum. No haptics
for passive scrolling or dates crossed during a fling.

Completion: on Android, demonstrate a single gesture collapsing Month and
continuing across at least three dates; scroll backward across a month boundary;
jump to an empty date; reverse a header drag mid-settle; access the last loaded
row; prepend/evict months without an anchor jump. Record the flow and assert
date headings with agent-device. If this checkpoint fails, fix it before editor
or backend wiring. Typecheck or a screenshot cannot complete this milestone.

### 3. [ ] Add schema, API and backend tests

Implement the storage/API contracts in `convex/schema.ts`, `convex/calendar.ts`,
`convex/lib/calendar.ts`, and the targeted existing functions in
`convex/kitchen.ts`. Update existing return validators and seed/type consumers
where necessary. Do not hand-edit generated API files; regenerate using the
project's Convex workflow. Confirm the dev target without printing secrets before
`pnpm exec convex dev --once`; never substitute a production target.

Add `convex/calendar.test.ts`, using `test/convexHarness.ts` and
`convex/kitchen.test.ts` as references. Verify old add-event callers, legacy rows,
actual date/time validation, all-day clearing, multiple assignees, same-Group
calendar moves, departed-member retention, cross-Group reads/writes/assignments,
non-member access, private preferences, revision conflicts, deleted records,
pagination across >100 events, date-range boundaries and removal cleanup.

Completion: schema validates on populated dev data, generated types are current,
focused backend tests pass, and a realistic dev create/read/update/read verifies
that all fields persist together. Remove only the test records created by that
check, using ordinary authorized app mutations. Existing kitchen tests stay green.

### 4. [ ] Connect paginated data and private filters

Create `useCalendarData.ts`, `CalendarEventSource.tsx`, `CalendarFilters.tsx`, and
`CalendarManagementSheet.tsx` under the production calendar directory. Implement
the query-source/window/anchor contracts above. The calendar list retains create,
colour selection and confirmed removal; removal copy explicitly says it deletes
the calendar's events. People selections and visibility remain private.

Use `useAvailability().serviceActionsEnabled` for service writes and the app's
existing disconnected presentation. Retain loaded content on query transitions;
show boundaries as loading rather than blank calendar days. Filter/view writes
may update local presentation immediately, but failure restores the saved choice
and shows an error. Resolve Member names only through the current Group response.

Completion: a second Member sees shared event edits but keeps independent view
preferences; five calendars work despite four tints; large event pages are fully
reachable; toggling filters preserves date context; moving an event between
loaded calendars produces one row; returning to an evicted month reloads it.

### 5. [ ] Implement draft lifecycle before editor presentation

Create `calendarDraft.ts`, `calendarDraftStore.ts`, and `useCalendarEditor.ts` in
the production directory. Use a discriminated create/edit draft and preserve all
fields plus `baseRevision`. Keep serialization/validation and reducer transitions
pure; the storage adapter alone imports `expo-sqlite/kv-store`. This uses the
existing store, without adding a new persistence dependency or general framework.

Hook operations: openNew, openEdit, changeField, expand, collapse, dismiss,
resume, discard, save, duplicate, delete. `save` is the sole create/update path;
it validates, checks availability, guards re-entry, awaits the mutation, then
clears only the matching draft. Scope async completions to captured user/Group/
draft identity so a late result cannot alter another editor or Group. Preserve
pending save state through transient disconnects; do not send a second mutation
while the first promise is unresolved or build a separate retry queue.

Integrate draft cleanup with existing sign-out/access-loss lifecycle. For Group
switch confirmation inspect `GroupSwitcherSheet.tsx` and `GroupProvider.tsx`;
add a narrowly scoped dirty-calendar guard if no existing guard exists. Do not
refactor all forms or navigation. Keep a retained draft accessible from the
calendar after a route unmount and app restart.

Completion: pure tests prove no mutation on change/dismiss/expand, one in-flight
submit, preserved failed saves, conflict handling, deleted-event Save as new,
recovery after remount, user/Group isolation, corrupted storage handling and
storage-write failure. Test API effects through injected callbacks, not native
component imports in the Node suite.

### 6. [ ] Build card and expanded sheet on the same editor

Create `CalendarEditor.tsx`, `CalendarEditorCard.tsx`, and
`CalendarEditorSheet.tsx`. Reuse `NativeSheet`, `NativeContextMenu`,
`SwipeableRow`, `MonthGridView`, and the app haptics wrapper. Consult installed
sheet/keyboard APIs; the existing wrapper does not automatically provide a
card-to-sheet morph. Explicitly hand presentation from overlay to native sheet,
preserving draft ownership. A short native transition is sufficient; avoid
stacking two editors or delaying useful work for a custom morph.

Implement the complete editor contract, persistent labels, wrapping fields,
Save/Close/Discard behavior, inline validation and keyboard handling. Android
Back closes an open picker/keyboard first, then dismisses and retains the editor;
iOS sheet dismissal retains it too. Block double-save while showing progress.
Use a single success haptic after an acknowledged save, error feedback on failure.

Completion: add with title/date/time/two people/calendar/location/notes; expand,
collapse and save; reopen and verify every field. Modify title/date/person then
dismiss: shared event unchanged, draft recoverable. Discard restores the stored
record. Repeat with keyboard open, large text, dark theme and a short viewport.

### 7. [ ] Wire real routes, detail entry and representative sample data

Point `apps/mobile/app/(app)/(tabs)/all/calendar/index.tsx` to the new screen.
Remove the superseded `CalendarScreen` block from
`apps/mobile/src/modules/kitchen/KitchenScreens.tsx`, cleaning only imports/helpers
made unused by that removal. Preserve unrelated kitchen screens and API callers.

Retain `apps/mobile/app/(app)/(tabs)/all/calendar/[eventId].tsx` as the record
destination for Search/deep links. Update its `CalendarEventScreen` implementation
to show all normalized fields with Edit/More actions using the same editor.
Read-only detail entry does not focus the keyboard. Its Back target is Calendar
when opened cold. Keep `useRecordRecent` behavior; opening an event in the new
inline editor should also record it. No duplicate standalone edit form.

Update `convex/lib/seed/sampleHousehold.ts` and its application in
`convex/lib/seed/apply.ts`: multiple calendar colours, all-day and timed events,
two assignees, unassigned events, long title, location/notes, past/future dates,
month boundary and a 7+ day empty run. Resolve fixture author/member keys to real
user IDs; retain seed tracking/cascade behavior. Do not reset shared sample data
as an incidental test. Use isolated fixtures/dev test records for destructive QA.

Update the calendar glossary and add the specific compact-card/explicit-save
convention to `docs/mobile-interaction.md`. Link this plan from the old build
brief with a short superseded notice; retain historical prototype decisions.

Completion: ordinary navigation, Search, cold event route, Group switching and
back navigation all reach the production calendar correctly. Labs remain isolated.
The old calendar screen has no remaining imports; shared kitchen modules compile.

### 8. [ ] Complete regression and device acceptance

Run the root CI command set, fixing task-related failures without weakening tests:

```text
pnpm check
pnpm typecheck
pnpm --filter @gather/core typecheck
pnpm --filter @gather/mobile typecheck
pnpm --filter @gather/mobile lint
pnpm test
pnpm build
```

For focused iteration use `pnpm exec vitest run --project core`, `--project
convex`, or `--project mobile` with the relevant test path. The mobile Vitest
project runs `.test.ts` in Node; do not treat it as a native renderer or invent
a new test runner to replace device checks.

Use the development build and agent-device following `apps/mobile/README.md`.
Android app: `com.appelent.gather`; AVD: `Pixel_9_Pro`. Start Metro with
`pnpm --filter @gather/mobile start:dev-client`. Rebuild via
`pnpm --filter @gather/mobile devbuild:android` only when necessary for native
changes or a missing development build. Consult current agent-device help for
gesture command syntax rather than copying guessed commands.

Add stable test IDs: `calendar-screen`, `calendar-today`, `calendar-new`,
`calendar-view-menu`, `calendar-header-handle`, `calendar-day-YYYY-MM-DD`,
`calendar-agenda-day-YYYY-MM-DD`, `calendar-event-ID`, `calendar-editor-card`,
`calendar-editor-sheet`, `calendar-title`, `calendar-save`, `calendar-expand`,
`calendar-collapse`, `calendar-resume-draft`, `calendar-discard-draft`.

| Device scenario | Observable pass condition |
| --- | --- |
| Scroll through 3 days, a week, a month and backwards | Heading, active date and header agree; momentum has no per-day stop |
| Full month → upward list drag → compact week | Same gesture continues into agenda; no dead zone or blank footer |
| Header drag interrupted/reversed; sideways paging | Tracks current position; final date and menu state agree |
| Select empty date inside long gap; Today | Exact requested heading appears; no snap to next event |
| Load >100 events / prepend / evict months | No missing/duplicated rows; same visual anchor survives |
| Create, expand, collapse, Save | One event; all fields survive requery and app restart |
| Edit, dismiss, reopen, Discard | No backend change before Save; draft resumes; discard leaves original |
| Explicit edit Save, clear notes/location, toggle all-day | One complete persisted edit; cleared fields and times stay cleared |
| Two Members edit same revision | Second save reports conflict and retains input |
| Other Member deletes event or calendar while editing | No resurrection; draft remains actionable with clear error |
| Disconnect during editing/save | Existing availability rules apply; no false success or second pending save |
| Filters and layout in two Member sessions | Shared records agree; private choices stay independent |
| Sign out/in as different user; switch/lose Group | No previous user's or Group's draft/content appears |
| EN/NL, light/dark, large text, keyboard, Reduced Motion | Controls and titles readable; Save and Close reachable; no clipping |
| Search/cold route/open then Back | Valid calendar parent; original list position retained when available |

Use `open`, then `press`/`fill`/`scroll --settle` and inspect each UI diff; assert
end states with `wait text`, ID-based queries or equivalent supported checks.
Record the full gesture/keyboard flow: screenshots prove layout, not motion.
Run iOS checks on a physical device/Mac environment; Windows Android evidence
does not establish iOS behavior. Profile scrolling on a release build with a
busy fixture: target steady 60 fps and no blank rows during flings. Report device,
build mode and results; distinguish measured performance from dev-build feel.

Completion: all automated checks pass and the device matrix has recorded outcomes.
If iOS/release hardware is unavailable, report exactly that remaining verification
gap; do not label it passed or claim release readiness. No recurrence/sync/web work
is required to finish this delivery.

## Suggested prompt for the implementing agent

> Implement `docs/plans/2026-09-12-mobile-calendar.md` in milestone order. Read the
> repository instructions and inspect existing changes first. Preserve the approved
> design: continuous mobile agenda, fluid Month/Week header, WHO marks, card plus
> expanded native sheet, and explicit Save. Complete each milestone's checks,
> including the early device gesture checkpoint. Keep new production code separate
> from Labs. Do not expand into recurrence, sync, reminders or web. At handoff,
> report completed milestones, tests/device evidence and any remaining failures.
