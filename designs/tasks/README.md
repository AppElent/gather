# Tasks redesign — design study (APP-291)

Lists you make yourself, smart lists across all lists, and a task form with
who, repeat, subtasks and a reminder. The phone leads; the web follows with the
same functions (APP-308).

**Canvas:** https://claude.ai/artifact/SBLnxdBz5WDKEMLMxPQ9ex ("Gather — Tasks").
**Approved:** all pages, by Eric, 18 November 2026 ("alle tabbladen zien er goed
uit … alle functionaliteiten … zou ik zo willen zien"). The Tasks index uses
direction **B, Today-first** (the recommendation; Eric did not pick A). A stays
here as the round's record.

**What "nieuwe lijsten" means** (Eric, 18 Nov): above all, that people can
create their own to-do lists in the app. Today only the web can
(`src/components/tasks/AddListFlow.tsx`); the phone cannot. Build New list
first.

Builds on the 16 September decisions (ADR-0034,
`docs/records/2026-09-16-notes-tasks-calendar-redesign.md`). Those still hold
where this study is silent.

## Files

| File | Artboard | Issue |
| --- | --- | --- |
| `Main.dc.html` | Shared phone part; props `screen`, `theme`, `size`. Default: Tasks index B, light | APP-301 |
| `IndexB-Dark.dc.html` | Index B, dark | APP-301 |
| `IndexB-SE.dc.html` | Index B, iPhone SE (375×667) | APP-301 |
| `IndexA.dc.html` | Index A, tiles (not chosen) | APP-301 |
| `Upcoming.dc.html` | Gepland / Upcoming, grouped by day | APP-301 |
| `NewList.dc.html` | New list sheet | APP-306 |
| `Chores.dc.html` | A Chores list with sections | APP-306, 302, 303 |
| `Packing.dc.html` | A Packing list | APP-306 |
| `Detail.dc.html`, `Detail-Dark.dc.html` | Task form | APP-302, 303, 304, 305 |
| `Repeat.dc.html` | Repeat sheet | APP-303 |
| `QuickAdd.dc.html` | Quick add with recognised chips | APP-307 |
| `canvas.json` | Positions, titles, sticky notes (the brief and rationale) | |

The artboards are a visual reference. Build from this companion and the phone's
own tokens and components (`apps/mobile/DESIGN_SYSTEM.md`), not from the
artboards' markup. Everything is Tiles & Today: `ground`, `surface` inset lists,
`home` group for the Tasks Module.

## Design system proposal (approved with the study)

A list has a **tile colour** chosen from the four group fills (home, kitchen,
tasting, money) and an **icon** from a short SF Symbol set. The colour appears
only on that list's tile (list rows on the index, the list's `WashHeader`
tile, the quick-add list chip). Never on rows or text. The list screen's wash
stays the Tasks Module's `home-wash`. Update the Gather Design System artifact
(ModuleTile guideline) and `apps/mobile/DESIGN_SYSTEM.md` in the change that
adopts it (APP-306).

## 1. Tasks index (APP-301, direction B)

Wash screen: `washScreenOptions('Taken' / 'Tasks')`, `WashHeader` with the
Tasks tile and summary `{n} open · {m} lijsten` / `{n} open · {m} lists`.
Bar button right (glass, `…`): menu with *Show or hide smart lists* (per device,
like the All arrangement). Sections top to bottom:

1. **Vandaag / Today**: tasks due today or overdue, from every list, tickable
   in place (the current strip in `TaskListsScreen.tsx`). Section aside
   `{n} te laat` / `{n} overdue` in `danger` when any are overdue. Row meta:
   overdue first (`Te laat · gisteren` / `Overdue · yesterday`, `danger` 600),
   then the source list name. Repeat glyph before the meta when the task
   repeats. Assignee coin trailing. Empty: today's existing `todayEmpty` copy.
2. **Slimme lijsten / Smart lists**: inset rows with a `tile-s` home tile, title,
   subtitle, count, chevron:
   - Mijn taken / My tasks — "Aan jou toegewezen" / "Assigned to you"
   - Gepland / Upcoming — "Komende 7 dagen" / "Next 7 days"
   - Niet toegewezen / Unassigned — "Nog niemand pakt ze op" / "Nobody has picked these up"
   Today is not repeated here; it is section 1. A hidden smart list drops out.
3. **Lijsten / Lists**: every list, ordered by `order`. Row: the list's own tile
   (colour + icon), name, subtitle = type name for typed lists (Klusjes,
   Paklijst, Boodschappen, Verlanglijst) or `Gekoppeld · {provider}` for linked
   lists (tile `surface-2` with an `ink` link glyph), trailing count (`{n}
   open`, packing `{done} van {total}` / `{done} of {total}`, existing
   not-loaded copy for failed providers). Last row: **Nieuwe lijst / New list**
   (`InsetAddRow`) opens the New list sheet.

Smart list screens (Mijn taken, Gepland, Niet toegewezen) are Wash screens with
their glyph on the home tile, back to Taken. **Gepland** groups by day:
`Te laat` (aside count, `danger`), `Vandaag · woensdag 18 november`, `Morgen ·
donderdag 19 november`, then `{weekday} {d} {month}`; days without tasks are
left out; 7 days ahead. Rows show the source list, repeat glyph, subtask
progress `1 van 3` / `1 of 3`, assignee coin. Completing, opening, swiping and
the hold menu behave exactly as in a normal list.

Not chosen: **A**, the four smart lists as a 2×2 grid of `surface` cards
(tile-m, count in `numeral-l`) above Lists.

## 2. New list (APP-306)

`NativeSheet`, large detent. Bar: `Annuleren` / `Cancel` (left), title
`Nieuwe lijst` / `New list`, `Maak` / `Create` (right, Module primary button;
disabled until a name exists or a type with a default name is chosen).

1. **Name card**: `tile-l` preview in the chosen colour and icon, then a text
   field (`title-2`, autofocused) whose placeholder is the type's default name.
   Empty name + Create uses the placeholder.
2. **Soort lijst / List type** (radio rows, `tile-s` on `surface-2`, check in
   `home-text` on the chosen row):

   | Type | NL title / subtitle | EN title / subtitle | Default name | Starts with |
   | --- | --- | --- | --- | --- |
   | `plain` | Gewone lijst / Leeg, voor alles wat moet | Plain list / Empty, for anything | Nieuwe lijst / New list | nothing |
   | `chores` | Klusjes / Vaste taken die terugkomen, met wie | Chores / Recurring jobs, with who does them | Huishouden / Household | 8 starter chores in Keuken, Badkamer, Overal, each repeating |
   | `packing` | Paklijst / Afvinken en later alles weer uitvinken | Packing list / Tick off, then reset for next time | Vakantie / Trip | 18 starter items in Kleding, Toilettas, Kinderen |
   | `groceries` | Boodschappen / Per afdeling, met recepten en hoeveelheden | Groceries / By aisle, with recipes and amounts | Boodschappen / Groceries | opens the grocery setup (APP-292) |
   | `wishlist` | Verlanglijst / Met link en prijs per item | Wishlist / With a link and price per item | Verlanglijst / Wishlist | nothing |

   Footnote under the list explains what the chosen type starts with, e.g.
   `Begint met 18 voorbeelditems in Kleding, Toilettas en Kinderen. Weghalen kan
   altijd.` / `Starts with 18 sample items in Clothes, Toiletries and Kids. Remove
   any of them.` Starter items exist in NL and EN; the Group's language decides.
3. **Kleur / Colour**: four swatches (home, kitchen, tasting, money), radio,
   selected ring `ink` with a `surface` gap. Labels: Amber, Groenblauw/Teal,
   Pruim/Plum, Blauw/Blue.
4. **Icoon / Icon**: the type's own icon first, then four more (house, gift,
   papers, cart). Selected: `ink` disc with `onInk` glyph.

Create: the sheet closes and the new list opens (review-and-save lands you on
what you made). Type change resets the icon to the type's icon.

## 3. Lists by type (APP-306, 302, 303)

All are Wash screens: back `Taken`, `…` menu (Rename, Colour and icon,
Sections, Reorder, Delete list), the list's own tile in the `WashHeader`.

- **Sections**: a list may have sections. Each section is a labelled inset
  list; tasks move between sections by drag in Reorder mode and via *Move to
  section* in the hold menu. The last section holds the `Taak toevoegen` /
  `Add task` row (opens quick add for this list) and `Afgerond (n)` /
  `Completed (n)`.
- **Chores** (`Huishouden`): summary `{n} open · hele huishouden`, subline
  `Klusjes · per ruimte`. Row meta: `{date} · {repeat}` (e.g. `Vrijdag · elke 2
  weken`, `Over 3 weken · 3 mnd na afvinken`), overdue in `danger` 600.
  Completed tasks go into Completed as today.
- **Packing** (`Vakantie Texel`): a progress card above the sections:
  `{done} van {total}` in `numeral-l` + `ingepakt` / `packed`, an 8 pt bar
  (`surface-2` track, `home-text` fill). **Checked items stay in place**,
  title `muted` with a strike-through; no Completed section. Below the last
  section: secondary pill button `Alles uitvinken` / `Uncheck all` with
  footnote `Voor de volgende reis. De items blijven staan.` / `For the next
  trip. The items stay.` Uncheck all is reversible with Undo.
- **Wishlist**: an item shows its link and price under the title (fields in the
  task form, shown only for this type).
- **Groceries**: designed in the groceries round (APP-292).

## 4. Task form (APP-302, 303, 304, 305)

One form for new and edit, explicit Save (16 Sept). Bar: `Annuleren` /
`Cancel` (glass), title `Taak` / `Task`, `Bewaar` / `Save` (Module primary).
Unchanged closes at once; changed asks Keep editing or Discard.

1. Title (`title-2`) and Notitie / Notes in one `surface` card.
2. Fields inset list (glyph `muted`, label, value `muted`, chevron):
   - **Wie / Who**: native menu of current Members plus `Niemand` / `Nobody`;
     shows the coin + name. Assigning someone else notifies them:
     `{name} gaf je een taak: {title}, {date}` / `{name} gave you a task:
     {title}, {date}` (needs APP-298 push).
   - **Datum / Date**: native date picker; none = `Geen` / `None`.
   - **Herhalen / Repeat**: pushes the Repeat sheet; value e.g. `Elke week, za`
     / `Every week, Sat`, `3 dagen na afvinken` / `3 days after done`, `Nooit`
     / `Never`.
   - **Herinnering / Reminder**: native date-time picker; a due date alone sets
     none. Recipient is yourself (16 Sept).
   - **Lijst / List**: native menu of lists, then section: `Huishouden ·
     Badkamer`.
   - **Labels**: as today.
3. **Subtaken / Subtasks** (aside `{done} van {total}`): full task rows (own
   check, own assignee and date), one level deep, plus `Subtaak toevoegen` /
   `Add subtask`. Footnote: `Bij herhalen gaan de subtaken weer open. Vink je de
   taak af met open subtaken, dan vragen we of die ook af mogen.` / `When the
   task repeats, its subtasks reopen. Completing the task with open subtasks
   asks whether to complete them too.` In lists the parent shows `1 van 3`.
4. `Taak verwijderen` / `Delete task` in `danger`, confirms (deletes are hard).

### Repeat sheet (APP-303)

`NativeSheet` with `Klaar` / `Done`. Native segmented control: `Niet` /
`Never`, `Vast schema` / `Fixed schedule`, `Na afvinken` / `After done`.

- Fixed: row `Elke` / `Every` with a native interval picker (n × day, week,
  month, year); for weeks a row of seven day toggles (`ma … zo`, 44 pt, on =
  `ink` fill); monthly on the 31st uses the last day (16 Sept).
- After done: row `Na afvinken` / `After done` with an interval picker (`3
  dagen` / `3 days`).
- A `home-wash` card **Volgende keer / Next** previews the next dates, e.g.
  `Na za 21 nov: za 28 nov, za 5 dec, za 12 dec`.
- Footnote: `Er staat steeds één keer open. Mis je hem, dan blijft hij als te
  laat staan; er komen geen kopieën bij. Subtaken gaan weer open.` / `One
  occurrence is open at a time. Miss it and it stays overdue; no copies pile
  up. Subtasks reopen.`

## 5. Quick add (APP-307)

The keyboard-anchored composer (16 Sept) over the list. As you type, recognised
parts are highlighted inline (`home-wash` behind the word, 600) and appear as
chips under the field: date (`Morgen, do 19 nov`), repeat (`Elke week`),
Member (`Daan`), label. Each chip's × removes the recognition; the word stays in
the title as plain text. First chip: the target list with its tile and a
chevron (native menu to pick another list). Send button: Module primary disc
with an up arrow (`Bewaar` / `Save` label for VoiceOver). Hint line `Datum,
herhalen, @lid en #label worden herkend` / `Dates, repeats, @member and #label
are recognised`, trailing `Meer details` / `More details` opens the full form
with the parsed values. Parsing is local (`@gather/core`), no network, no AI.

## States to build and check

Light and dark; iPhone SE and a large phone; NL and EN; largest text size
(rows wrap, counts stay visible). Empty states: no lists (only New list row);
smart list with nothing (`nothing here for you` kind: a line, no button);
Gepland with nothing in 7 days. Linked lists show their last fetched rows
(ADR-0021). Offline: lists and tasks follow the module's existing offline
behaviour; Create and Save fail visibly when offline writes are not allowed.

## Open runtime questions

- Native menu for Wie in `@expo/ui` with avatars: check the installed version;
  fall back to text-only items.
- Day toggles at the largest text size may need two rows.
