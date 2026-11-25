# Five Modules on the web — final

Approved by Eric on 24 Nov 2026 (decision card, "Goed, zo bouwen").

- **Issues:** APP-308 Tasks, APP-322 Meal planner, APP-344 Calendar, APP-351 Notes, APP-329 Shared costs. Settings behind the gear: APP-800.
- **Canvas:** https://claude.ai/artifact/QMNRpfdSrcGN3DXiHxKz8m, page `Modules: web-pariteit (ronde 1)`.
- **Source:** [`web-modules_final/`](web-modules_final/). Every artboard imports `Mod.dc.html` (props `screen` taken|weekmenu|agenda|notities|kosten, `theme` light|dark, `size` desktop|phone). `M-*` are 1280 px desktop boards, `MP-*` are 390 px.
- **Builds on:** the web look and Module page ([`../web-shell/web-shell_final.md`](../web-shell/web-shell_final.md), APP-636..640) and the list-and-detail layout from Groceries ([`../groceries/web.md`](../groceries/web.md), APP-316/APP-300). Everything not stated here follows those two companions.
- **Behaviour** comes from each Module's phone study and contract; this companion only says how it lands on the web. No schema change and no web-only backend: every screen uses the Convex functions the phone uses.

The artboards are a visual reference. Build with the web tokens and the Module page parts in `src/components/app/` (WashHeader, InsetList/InsetRow/SectionLabel, RowMenu, CompletedSection, EmptyState, Dialog), not from the artboards' markup. Sample data (Willow Street: Sam, Nora, Test User) is illustration only.

## Shared rules

| Rule | Decision |
| --- | --- |
| Header | The wash header in the Module's group colour: Tasks, Calendar and Notes `home`; Meal planner `kitchen`; Shared costs `money`. Search (APP-613 web equivalent: the command palette preset to the Module), then the gear where the phone has a settings page (Tasks, Meal planner, Calendar; APP-800), then the primary action. |
| Layout | ≥ 1024 px: list left, panel right (380 px; Calendar 340 px), selection in the URL so a reload and Back keep it. Notes reverse it (below). < 1024 px: the panel is its own page with a back link, as Groceries. |
| 390 px | The wash header becomes the compact form on the boards: back link, search, gear, a round primary button (label from the desktop primary), large title. The phone's tab bar from APP-638 stays at the bottom. |
| Keyboard | Esc closes the panel and returns focus to the selected row. `N` focuses the add field where a Module has one (Tasks). Arrow keys move between rows in a list. |
| States | Each Module has loading (skeleton rows), empty (the phone's empty-state wording), error (retry), and a selected-but-deleted record (panel shows "Not found" with a link back). |
| Copy | From `packages/core/src/messages` (EN and NL), the same keys the phone uses; new web-only strings get both languages. |

## Tasks (APP-308) — `M-Taken`, `MP-Taken`

- **Index** stays the approved APP-636 `D-Taken` board (Today, Smart lists, Lists). Hidden smart lists follow the phone's Tasks settings (APP-800).
- **A list:** add field at the top ("Nieuwe taak, bijv. …", the phone's quick-add grammar: date, repeat and `@member` parsed as on the phone, `N` focuses it); sections as section labels with their own inset list; completed under "Afgerond (n)". A row: check ring in `home` text colour, title, footnote (date in words, overdue in `danger` 600, repeat), subtask count `1/3` when there are subtasks, assignee coin, `⋯` on hover/focus (move, duplicate, delete).
- **Panel:** check ring and title (editable in place), close button; a grouped field list on `ground`: List and section, When, Repeat, Who, Reminder (each opens the phone's choices as a popover on desktop, a sheet below 1024 px); Subtasks ("Subtaken · n van m", one level deep, add row); note; footnote "Reminders arrive on the phone" plus who added it and when.
- **Linked lists** (Todoist, Notion) keep the provider's write rules (ADR-0021); fields a provider can't store are hidden, not disabled.

## Meal planner (APP-322) — `M-Weekmenu`, `M-Weekmenu-Donker`, `MP-Weekmenu`

- **Header:** primary "Plan mijn week" (spark glyph, starts the phone's plan sheet as a dialog); secondary "Naar boodschappen" (the week-to-list sheet as a dialog). Gear: Meal preferences.
- **Week:** prev/next week and "Deze week"; days as cards in two columns (one column below 1024 px), Monday first, one row per enabled meal slot (slot, meal, how many eat). Empty slot reads "Kies iets" and opens Pick. A day's sub-line carries what the calendar says (late home, sport) as on the phone.
- **Proposal (direction A):** a dashed bar above the week ("Voorstel voor n avonden …", Discard, Take all); drafted meals in italics with a dashed "voorstel" pill. Accept or discard one draft from its panel.
- **Panel (a meal):** recipe photo or the kitchen tile (no placeholder picture), day and slot, title; Who eats (pills), Servings stepper, Move to (seven day buttons; this is also the keyboard path for drag-to-move), actions Open recipe, Something else (swap sheet), To groceries; "Van het menu halen" as text-style destructive.
- **Drag** a meal row onto another day's slot to move or swap, as the phone; the move buttons are the accessible equivalent.

## Calendar (APP-344) — `M-Agenda`, `M-Agenda-Donker`, `MP-Agenda`, `MP-Agenda-Donker`

- **Toolbar** under the header: Today, prev/next, the period title; on the right the calendar filter chips (colour dot + name, toggle) and the Month/Week/Agenda switch. Desktop opens in Month, 390 px in Agenda; the choice is remembered per browser. The gear opens Calendar settings (APP-627 content).
- **Month:** a 7 × 5/6 grid card; a day shows up to two event pills in its calendar's colour (light tint) and "+n meer"; today has the `home` wash and a filled date. Clicking a day selects it.
- **Panel:** the selected day's events (colour bar, time or "hele dag", title, calendar), "+ Afspraak op deze dag". Clicking an event replaces the panel with the event, as a Groceries item; Back returns to the day. Events from a subscribed (iCal) calendar are read-only and say so.
- **Week** view: seven day columns with the events stacked by time (no hour grid in round 1); **Agenda**: the 390 px list, days as section labels.
- **New event:** the primary opens the phone's event composer as a dialog (sheet below 1024 px).

## Notes (APP-351) — `M-Notities`, `M-Notities-Donker`, `MP-Notities`

- **Reversed layout:** a 340 px list on the left (Pinned, then Recent, each row title + when + first line), the note itself wide on the right. A note is a document, so it gets the room.
- **The note:** top row with "Bewerkt door {name} · {when} · Opgeslagen" and pin and `⋯` (delete) buttons; title as a large field; body as plain text (the `body` column is a string; no formatting toolbar until Notes gets rich text, APP-296). No edit mode: typing saves (debounced, the phone's save path), "Opgeslagen" confirms.
- **New note:** the primary creates an empty note and focuses its title. 390 px: the list; a note opens as its own page.
- No gear: Notes has no settings page on the phone.

## Shared costs (APP-329) — `M-Kosten`, `MP-Kosten`

- **The phone's split calculator** (ADR-0025, `SplitScreen`), not pots or balances: nothing is stored unless the person saves the split, and a saved split is immutable (duplicate to change).
- **Left:** the notice ("Gather bewaart dit niet …"); a card with What for, Who paid (rows: coin, member, for what, amount; "+ Betaling toevoegen"), Split between (member pills; Equally / Custom switch; Custom shows an amount or share per member with the phone's validation copy).
- **Right:** the outcome (per person, total over n people, "Verrekenen" rows "{from} betaalt {to}" with amounts or "Niets te verrekenen"), "Dit bewaren" (asks a name), the immutability note; below it "Bewaarde verdelingen" (name, date, total) which open read-only with Duplicate.
- **390 px:** one column; the outcome sits in a glass bar above the tab bar with "Dit bewaren".
- No gear.

## Out of scope

- Web push and web-only reminders (reminders stay on the phone).
- A week view with an hour grid in Calendar.
- Rich text in Notes (APP-296), images in notes (APP-349).
- Recurring costs and Savings goals on the web (APP-83).

## Build order

APP-316 (Groceries, builds the shared layout) first; then Tasks (APP-308), Notes (APP-351), Calendar (APP-344), Meal planner (APP-322), Shared costs (APP-329). Each issue flips its `features.ts` entry to `parity` and its `modules.ts` status to `live`.
