# Keyboard composer — final (APP-587, APP-588, APP-589)

One composer, pinned to the top of the keyboard, for a new task, a new note
and a new event. Fast to start (one tap, one line), with details set before
saving, and room to write when a line is not enough.

**Canvas:** https://claude.ai/artifact/SBLnxdBz5WDKEMLMxPQ9ex ("Gather — Tasks"),
page `APP-587 Snelle composer: Taken, Notities, Agenda` (rounds and the not-chosen
directions A and C stay there).
**Approved:** direction **B, plus menu**, by Eric, 22 November 2026 ("Ziet er top
uit"), including the drag handle and expand button he added from a comment
composer he uses, and the Notes and Calendar variants he asked for.
**Final source:** `quick-add_final/`. `Compose.dc.html` is the shared part
(props `kind` task|note|event, `dir`, `start` closed|open|menu|filled|expanded,
`theme`, `size`); the `Q587-*` files are the approved artboards. The artboards
are a visual reference: build from this file, the phone's tokens and
components (`apps/mobile/DESIGN_SYSTEM.md`), not from their markup.

Reference: Eric's screenshots of a to-do app's quick add (composer above the
keyboard, list and date chips, a + menu of details) and a comment composer
(drag handle, expand top right). Taken from them: the hierarchy and controls.
Look, colour, type and icons are Gather's own (Tiles & Today, `home` group).

Builds on §5 Quick add (APP-307) in `README.md`: typed recognition stays and
fills the same chips.

## Where it opens

| Surface                                                 | Entry         | Preset                                                                                                                                    |
| ------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Tasks index, smart lists, a list screen (not groceries) | Add button    | List: that list, else the last used writable list (`quickAddTarget`). Date: today on Vandaag, none elsewhere. Assignee: me on Mijn taken. |
| Add tab's quick-actions sheet, Task (APP-206)           | existing tile | as today's `QuickAddTask`                                                                                                                 |
| Notes                                                   | Add button    | —                                                                                                                                         |
| Calendar                                                | Add button    | Calendar: the last used. Date: the selected day, else today. Time: none (all day off, no time chosen = "Tijd").                           |

Grocery lists keep their inline `TaskComposer` row with suggestions and aisle
choice (APP-311, APP-524). The other lists drop the inline last-row composer in
favour of the add button; a list without tasks still shows its empty state.

**Add button:** 60 pt circle, Module primary (`home` fill, `home-on` plus,
2.6 stroke), 20 pt from the trailing edge, 16 pt above the tab bar / home
indicator, shadow as glass buttons. VoiceOver `Taak toevoegen` / `Add task`,
`Notitie maken` / `New note`, `Afspraak toevoegen` / `Add event`. Hidden while
the composer is open and on read-only (linked) lists.

## The composer (all kinds)

A `surface` card, 24 pt radius, 8 pt from the screen edges, sitting 8 pt above
the keyboard and moving with it (keyboard-tracking, not a sheet). Behind it a
dim scrim (`ink` at 28 %, dark 45 %); tapping the scrim closes.

Top to bottom:

1. **Drag handle**, 36 × 5 pt, `hair`, centred in a 20 pt band; the band is a
   button (`Groter maken` / `Expand`, `Kleiner maken` / `Collapse`).
2. **Title row:** title field (17–18 pt, 600, autofocused) and the **expand
   button** (36 pt, `muted` arrows; same labels as the handle).
3. **Body line** (note always; task and event once Beschrijving / Notitie is
   picked): 15 pt `muted` single line.
4. **Chip row** (36 pt chips, horizontal scroll, no scrollbar), then the send
   button at the end of the row: 40 pt disc, Module primary when there is a
   title, `surface-2` + `muted` arrow when empty (`Bewaar` / `Save`).

**Chips.** The list/calendar chip: `surface-2`, tile in the list's colour (20 pt,
6 pt radius) and name. A detail chip: unset `surface-2` + `muted` icon + its name;
set `home-wash` + `home-text` icon + its value. Tapping any chip opens a native
menu (`MenuView`) or the native picker, so the keyboard stays up. A set chip's
menu ends with `Weghalen` / `Remove`.

**+ button** (task, event): 36 pt circle, `hair` outline; opens a native menu
of the details not always shown, a check on the set ones, a separator, then
`Alle details` / `All details` (opens the full form with everything typed and
chosen). Picking an item sets it and adds its chip.

**Save.** Return or the send button saves. The composer stays open and
empty, focus in the title, the preset list/date kept, other details cleared.
The new row appears where it belongs, briefly in `home-wash` (Reduce Motion: no
flash). Haptic `itemSaved`. A failed save keeps everything and shows the
existing `failed` line under the chips.

**Close.** Scrim tap, swipe down past the small size, or the keyboard's own
dismiss. A non-empty draft (title, body or a set chip) is kept per surface
until saved or the app is killed and reappears next time; no confirm.

**Expand.** Handle up, or the expand button: the card grows to 8 pt under the
status bar, keyboard still up. The body becomes a multi-line field filling the
space (`Beschrijving, links, wat er nodig is…` / `Description, links, what's
needed…`; note `Begin met typen…` / `Start typing…`; event `Notitie: wat mee te
nemen, adres…` / `Note: what to bring, address…`), and the chip row wraps and
shows every detail of the kind, unset ones as unset chips. Handle down or the
button collapses; nothing typed or chosen is lost. Spring, no bounce;
Reduce Motion: cross-fade.

## Task (APP-587)

Always: **List**, **Datum / Date**. Behind +: **Beschrijving / Description**,
**Prioriteit / Priority**, **Wie / Who**, **Herinnering / Reminder**, **Label**,
**Herhalen / Repeat**.

| Chip        | Menu / picker                                                                             | Field          |
| ----------- | ----------------------------------------------------------------------------------------- | -------------- |
| List        | writable lists (`quickAddLists`), tile + name, check on current                           | `listId`       |
| Datum       | Vandaag, Morgen, Dit weekend, Volgende week, Kies datum… (native date picker), Geen datum | `dueDate`      |
| Prioriteit  | Hoog, Middel, Laag, Geen                                                                  | `priority` 1–3 |
| Wie         | Group Members + Niemand (as in the task form)                                             | `assigneeId`   |
| Herinnering | Kies tijd… (native date-time) ; no reminder from a date alone                             | `reminder`     |
| Label       | the Group's labels + Nieuw label…                                                         | `labels`       |
| Herhalen    | Niet, Elke dag, Elke week, Elke maand, Aangepast… (opens the Repeat sheet)                | `repeat`       |

Typing "stofzuigen morgen elke week @Daan #keuken" sets Datum, Herhalen, Wie and
Label exactly as tapping would (APP-307 parser); the recognised words stay
highlighted in the field. Removing such a chip leaves the words in the title.
Placeholder `Taaknaam` / `Task name`.

## Note (APP-588)

Title (`Titel` / `Title`) and body (`Begin met typen…` / `Start typing…`; Return
in the title moves to the body). One chip: **Vastpinnen / Pin** (toggle, set =
`Vastgepind` / `Pinned`). No + button. Save creates `{ title, body, pinned }`;
save needs a title or a body line; how an untitled note is shown follows the note screen's current rule (check `NoteScreen.tsx`).
The new note appears at the top of the list. Editing an existing note stays on
the note screen. Formatting and images arrive with APP-345 / APP-349 as more
chips.

## Event (APP-589)

Title `Wat ga je doen?` / `What's happening?`. Always: **Agenda / Calendar**
(calendar colour tile), **Datum / Date**, **Tijd / Time**. Behind +: **Wie /
Who** (multi-select, `Iedereen` / `Everyone` when all), **Locatie /
Location** (text field in an alert), **Notitie / Note**.

Tijd's menu: Hele dag / All day, Kies tijd… (native time range: start, end
defaults to +1 h). `Alle details` opens `CalendarEditorSheet` with the draft.
Repeat and reminders join the + menu with APP-330 / APP-333.

## Copy (new keys)

| Key                    | NL                                    | EN                                 |
| ---------------------- | ------------------------------------- | ---------------------------------- |
| composer.expand        | Groter maken                          | Expand                             |
| composer.collapse      | Kleiner maken                         | Collapse                           |
| composer.more          | Meer details                          | More details                       |
| composer.allDetails    | Alle details                          | All details                        |
| composer.remove        | Weghalen                              | Remove                             |
| composer.save          | Bewaar                                | Save                               |
| composer.addTask       | Taak toevoegen                        | Add task                           |
| composer.addNote       | Notitie maken                         | New note                           |
| composer.addEvent      | Afspraak toevoegen                    | Add event                          |
| composer.taskBody      | Beschrijving, links, wat er nodig is… | Description, links, what's needed… |
| composer.noteBody      | Begin met typen…                      | Start typing…                      |
| composer.eventTitle    | Wat ga je doen?                       | What's happening?                  |
| composer.eventBody     | Notitie: wat mee te nemen, adres…     | Note: what to bring, address…      |
| composer.date.weekend  | Dit weekend                           | This weekend                       |
| composer.date.nextWeek | Volgende week                         | Next week                          |
| composer.date.pick     | Kies datum…                           | Pick a date…                       |
| composer.date.none     | Geen datum                            | No date                            |
| composer.time.allDay   | Hele dag                              | All day                            |
| composer.time.pick     | Kies tijd…                            | Pick a time…                       |
| composer.pin / pinned  | Vastpinnen / Vastgepind               | Pin / Pinned                       |

Reuse `tasks.quickAdd.*` (failed, noList, listChip, remove, reminderFailed) and
the task form's field names (Prioriteit, Wie, Herinnering, Label, Herhalen).

## Build notes

- One component, `src/components/KeyboardComposer.tsx` (shared shell: handle,
  expand, title/body, chip row, send, scrim, draft), with per-kind chip
  configs in each Module. Task first (APP-587); Notes (APP-588) and Calendar
  (APP-589) reuse it.
- Keyboard tracking: check what the installed Expo SDK (58) and Reanimated
  (4.7) offer (`useAnimatedKeyboard` / `KeyboardAvoidingView`); no new
  dependency without noting it in the PR (blast radius stays med).
- Drag: `react-native-gesture-handler` (3.3) pan on the handle band; snap points
  small / expanded / closed.
- Menus: `@expo/ui` `MenuView`, as the list chip already does.
- Draft per surface in memory (module store); not persisted across a kill.
- No schema change; all fields exist on `tasks`, `notes`, `calendarEvents`.

## States to build and check

Per kind: closed (add button), open empty (send disabled), typing with
recognised parts (task), menu open (task, event), details set, expanded,
collapsed after expanding with the draft intact, save → empty and still open,
save failed, closed with a draft and reopened, offline (save fails visibly
where offline writes are not allowed). Light and dark; iPhone SE (composer and
expanded size with a 216 pt keyboard) and a large phone; NL and EN; largest
text size (chips grow, row still scrolls; expanded title wraps). VoiceOver:
handle, expand, + and every chip are buttons with the labels above; the scrim
is `Sluiten` / `Close`.

## Open runtime questions

- Keyboard-tracking smoothness on device with the installed SDK; fall back to
  `KeyboardAvoidingView` if the animated keyboard stutters.
- Whether the chip row should start scrolled to the newest chip when it
  overflows (check on SE).
