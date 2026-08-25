/**
 * Writes this canvas's artboards and its canvas.json.
 *
 *   node _build.mjs
 *
 * The `.dc.html` files and `canvas.json` are the deliverable; the `_*.mjs`
 * files are the source they are generated from, kept so a later change is an
 * edit rather than a rewrite. See `_kit.mjs` for why the chrome is shared.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import indexScreens from './_screens-index.mjs'
import listScreens from './_screens-list.mjs'
import mixScreens from './_screens-mix.mjs'
import notesScreens from './_screens-notes.mjs'
import taskScreens from './_screens-task.mjs'

const OUT = dirname(fileURLToPath(import.meta.url))
const screens = {
  ...indexScreens,
  ...mixScreens,
  ...listScreens,
  ...taskScreens,
  ...notesScreens,
}

const COL = 470 // 390pt artboard + 80px gutter
const at = (col, y) => ({ x: col * COL, y })

/* Row 0 — THE MIX. Rows below are one open question each. */
const MIX = 0
const S1 = 1200 // the lists index
const S2 = 2760 // one list, whole
const S3 = 4320 // the task detail and the edit modes
const S4 = 5880 // Notes
const brief = (y) => y - 200
const verdict = (y) => y + 890

const artboards = [
  { file: 'Main.dc.html', title: 'THE MIX — Tasks', ...at(0, MIX) },
  { file: 'MixList.dc.html', title: 'THE MIX — Household', ...at(1, MIX) },
  { file: 'MixGestures.dc.html', title: 'THE MIX — The two swipes', ...at(2, MIX) },
  { file: 'MixHold.dc.html', title: 'THE MIX — Press and hold', ...at(3, MIX) },
  { file: 'MixLinked.dc.html', title: 'THE MIX — A Todoist list', ...at(4, MIX) },
  { file: 'MixTask.dc.html', title: 'THE MIX — Task', ...at(5, MIX) },
  { file: 'MixNotes.dc.html', title: 'THE MIX — Notes', ...at(6, MIX) },
  { file: 'MixNote.dc.html', title: 'THE MIX — One note', ...at(7, MIX) },

  { file: 'ListsA.dc.html', title: 'A — Rows with open counts', ...at(0, S1) },
  { file: 'ListsB.dc.html', title: 'B — Cards with a peek', ...at(1, S1) },
  { file: 'ListsC.dc.html', title: 'C — Lists are a filter', ...at(2, S1) },

  { file: 'ListA.dc.html', title: 'A — The Checklist, adopted', ...at(0, S2) },
  { file: 'ListB.dc.html', title: 'B — Rich rows', ...at(1, S2) },
  { file: 'ListC.dc.html', title: 'C — Grouped by when', ...at(2, S2) },
  { file: 'ListReorder.dc.html', title: 'Reorder mode (shared)', ...at(3, S2) },

  { file: 'TaskA.dc.html', title: 'A — The screen owns everything', ...at(0, S3) },
  { file: 'TaskB.dc.html', title: 'B — Read-only + edit sheet', ...at(1, S3) },
  { file: 'TaskC.dc.html', title: 'C — The row is the editor', ...at(2, S3) },
  { file: 'QuickAdd.dc.html', title: 'The Add tab’s task row', ...at(3, S3) },

  { file: 'NotesA.dc.html', title: 'A — Notes index', ...at(0, S4) },
  { file: 'NoteA.dc.html', title: 'A — One note', ...at(1, S4) },
  { file: 'NotesB.dc.html', title: 'B — Notes index', ...at(2, S4) },
  { file: 'NoteB.dc.html', title: 'B — One note', ...at(3, S4) },
  { file: 'NotesC.dc.html', title: 'C — Notes index', ...at(4, S4) },
  { file: 'NoteC.dc.html', title: 'C — One note', ...at(5, S4) },
].map((a) => ({ ...a, w: 390, h: 844 }))

const annotations = [
  {
    id: 'mix',
    ...at(8, MIX),
    w: 440,
    text: `THE MIX — the chosen design, updated after your second pass. The lettered directions below are now the reasoning behind it rather than live options.

Tasks index — A's rows with open counts, plus a TODAY strip lifted off C: the tasks due today across every list, tickable in place. Tap one.

LINKED LISTS ARE NO LONGER SEPARATE. Work (Todoist) and Care notes (Notion) sit in the same card as the local lists, marked with their provider and nothing more — where a list is stored is not a reason to file it somewhere else. What that costs is on the fifth artboard.

One list — B's rich rows, but WHICH properties a row carries is now a setting rather than a decision made once for everybody. The ⋯ menu is open and live: turn Due dates, Priority and Labels off one at a time and watch the rows collapse to A's. That dissolves the A-vs-B argument below rather than settling it — both are the same screen at two settings.

Task detail — the screen owns everything, each attribute opening the platform's own sheet. Due date is now a CALENDAR with four shortcuts above it, not a list of presets. Tap Due date; the month arrows work.

Notes — unchanged, since you were happy with it: A's documents.

OPEN QUESTION the display setting creates: WHERE DOES IT LIVE? Per list is drawn (it is in that list's own ⋯ menu). Per person would mean a preferences row keyed by user and list; per device is free but silently differs between your phone and your tablet. Per list is the only one that needs no new table, and the only one where two people in a household see the same thing.`,
  },
  {
    id: 'mix-behaviour',
    ...at(9, MIX),
    w: 440,
    text: `THE THREE ARTBOARDS THAT ANSWER "IS IT INCLUDED?"

Yes — and here they are drawn, because a still artboard cannot be swiped or held.

THE TWO SWIPES. Swipe right does the row's main verb: complete. Swipe left reveals a red Delete you then have to TAP — it never fires on a full swipe, because a full swipe is something you do by accident while scrolling. The full-swipe-left slot stays empty: it is reserved for Archive, which gather does not have.

PRESS AND HOLD opens the system context menu — the screen blurs, the row lifts, its actions appear. Complete, Rename, Due date, Priority, Move to list…, Reorder, Delete. Everything in it is also on the task's own screen, which is the rule that direction C at the bottom of the canvas breaks.

Reorder is reachable from both this menu and the list's ⋯ — that was the open question last round, and having built both, offering both costs nothing and neither is a worse place to look.

A TODOIST LIST, OPENED — where "it behaves like a local list" stops being true, and I should flag that it is not true today at all. Both adapters are capabilities.write: false in convex/lib/taskProviders/, so gather can currently only READ Notion and Todoist. ADR-0021 requires such a list to say so and hide its composer rather than emulate the write locally, so the composer is gone and the reason is at the bottom of the card.

The other difference: pull-to-refresh exists on this list and nowhere else, because it is the only one Convex does not keep live.

If Todoist's adapter ever gains write, both differences vanish and the marker becomes purely cosmetic — which is the strongest argument for the change you asked for.`,
  },

  {
    id: 'brief-lists',
    ...at(0, brief(S1)),
    w: 760,
    text: `THE LISTS INDEX — what is the front door of Tasks?

Three answers to "what is this screen FOR", not three skins. Fixed in all three: the Group is Huize Jansen and the screen is reached from the All tab; hold a row for Rename / Reorder / Delete; a list gather cannot write to says so rather than offering a composer that fails on submit.

SETTLED: A wins, and linked lists are MARKED, NOT SEPARATED — they sit in the same card as the local ones with their provider's name beside them. See THE MIX at the top, and the Todoist artboard beside it for the two places that choice still shows.

Open question I did not decide for you: whether this screen needs a search field. None of the three has one, because none of them is long enough to need one until a household keeps fifteen lists.

C's filter chips are live — tap them.`,
  },
  {
    id: 'note-lists-a',
    ...at(0, verdict(S1)),
    w: 430,
    text: `A — Rows with open counts

Claim: a list index is a table of contents. Its job is to get you out of it and into a list, and a count is the only thing it owes you on the way.

For: cheapest to scan and cheapest to build — this is ListsScreen and SettingsCard, which both already exist. Nine lists still fit without scrolling. It is honest about being a signpost.

Against: a count is all you learn. "Is anything on fire?" means opening every list; an overdue P1 in Shopping looks exactly like three someday ideas.`,
  },
  {
    id: 'note-lists-b',
    ...at(1, verdict(S1)),
    w: 430,
    text: `B — Cards with a peek

Claim: the index should answer "what's in there" without making you open it. Each list shows its next few open tasks, overdue ones in red.

For: you can triage the household from the front door. The only direction where opening a list is optional rather than compulsory.

Against: two and a bit cards fit on a screen, so five lists scroll and nine are unusable. The peek shows the top few by manual order, which is not the same as the important few — and it looks stale the moment somebody ticks something.`,
  },
  {
    id: 'note-lists-c',
    ...at(2, verdict(S1)),
    w: 430,
    text: `C — Lists are a filter, not a place

Claim: a household has one pile of things to do, and lists are how you narrow it. The front door is the pile, grouped by when, with a chip strip for narrowing. The chips are live.

For: it answers the question people actually open the app with. Tasks stops being two taps deep, and the Today strip the other directions bolt on is simply the top of this screen.

Against: it deletes the middle level of the three this Module has. Renaming, reordering and deleting a list have nowhere to live, undated tasks — most of them — fall off the bottom, and a read-only Notion list cannot be mixed into a pile you tick things off in.`,
  },

  {
    id: 'brief-list',
    ...at(0, brief(S2)),
    w: 760,
    text: `ONE LIST, WHOLE — how much of a task fits on its row?

The web row shows a P-pill, label chips and a due date. 390 points does not have room for all three beside a title that is usually a sentence. These three spend the row differently.

Fixed in all three: completing an item puts it away — it leaves the active list and drops into a collapsed Completed (n). That is docs/mobile-interaction.md, and it is a change from the web, where convex/tasks.ts sorts completed tasks to the bottom and leaves them sitting there. Swipe right completes; swipe left reveals a Delete you then have to tap (B draws it). A list gather cannot write to hides its composer.

SETTLED: B's rows win, but as a SETTING rather than a fixed choice — the list's ⋯ menu turns Due dates, Priority and Labels on and off, and with all three off B becomes A exactly. So A and B stopped being rivals; they are the two ends of one control. THE MIX's list at the top is the live one.

REORDER MODE, the fourth artboard, is adopted as drawn and now carries the rich rows too — you rearrange by recognising a row, and stripping it back to its title makes that harder. It is entered from the row's hold menu AND the list's ⋯; having built both, offering both costs nothing.

Still open underneath all of it: if a household ends up wanting C's date grouping as well, manual order becomes decorative inside a date group and the column may not be worth keeping.`,
  },
  {
    id: 'note-list-a',
    ...at(0, verdict(S2)),
    w: 430,
    text: `A — The Checklist, adopted

Claim: this component already exists. apps/mobile/src/modules/baby/Checklist.tsx is a working task list — composer, optimistic toggle, collapsed Completed (n), ADR-0021 read-only handling — and its header comment says it was written to be adopted by this Module rather than replaced.

For: no new code and no new decisions. Honest about what a phone row can hold, and the only direction that could ship this week.

Against: it throws away every attribute the schema has. A P1 due Tuesday looks identical to "sort the loft boxes", and a household that uses due dates on the web will find the phone lost them.`,
  },
  {
    id: 'note-list-b',
    ...at(1, verdict(S2)),
    w: 430,
    text: `B — Rich rows

Claim: the row is where triage happens, so the row carries the evidence — a priority bar down the left, the due date in red once it has passed, labels as small chips.

For: you can sort your day without opening anything, and data the web already writes is visible where it was entered.

Against: 66px rows mean five fit where seven did, long titles truncate, and three colour systems (priority bar, overdue red, label grey) compete inside one row. It is also the most to build and the most to keep looking right in dark mode.`,
  },
  {
    id: 'note-list-c',
    ...at(2, verdict(S2)),
    w: 430,
    text: `C — Grouped by when

Claim: a to-do list is a calendar you cannot see. Group by Overdue / Today / This week / No date and "what now?" is answered at the top of the screen.

For: the most useful ordering of the four, for free, out of a column the schema already has.

Against: a household list is mostly undated, so the biggest section is "No date" and the grouping sorts almost nothing. Manual order stops meaning anything inside a date group, and the composer has to leave the card — pinned above the tab bar here — because there is no one list to append to.`,
  },
  {
    id: 'note-list-reorder',
    ...at(3, verdict(S2)),
    w: 430,
    text: `Reorder mode — shared by all three

What the mode does: drag handles replace the checkboxes, completing and swiping are off, Completed is hidden (nobody arranges the order of finished things), and the nav bar's only action is Done.

Named, not decided: what enters it; whether the same mode reorders the lists on the index screen, which have their own order column; and whether a list grouped by date should offer it at all.`,
  },

  {
    id: 'brief-task',
    ...at(0, brief(S3)),
    w: 760,
    text: `WHAT THE DETAIL SCREEN OWNS — the question that was in flight when the last session handed off.

Three answers, and they are not cosmetic. A and B disagree about whether editing needs a Save at all; C denies the screen should exist.

SETTLED: THE MIX's answer — the screen owns everything, each attribute opening a native sheet — and the due-date sheet is now a CALENDAR with Today / Tomorrow / Weekend / None above it, rather than the list of presets it was. Tap Due date on the mix's task at the top; the month arrows work.

The line all three answer to is in docs/mobile-interaction.md: "A menu is never the only way to reach something. Everything in it is also on the row's detail screen." A satisfies it by construction. B satisfies it. C breaks it deliberately, and its Against says so.

The fourth artboard is a different question with the same shape: the Add tab's task-new quick action. It already exists in src/shell/quickActions.ts as kind: 'row', and QuickActionSheet currently fakes it into local state and writes nothing at all. WHICH LIST DOES AN UNTARGETED TASK LAND IN? Drawn as the last list you added to, with a picker one tap away — the alternatives (a designated Inbox list per Group, or refusing to add until a list is chosen) are both defensible and neither is drawn.

A's priority segment, calendar and labels are live. B's Edit opens the sheet. C's Rename turns the row into the field.`,
  },
  {
    id: 'note-task-a',
    ...at(0, verdict(S3)),
    w: 430,
    text: `A — The detail screen owns everything, inline

Claim: a task has five fields. They fit on one screen, and a sheet stacked on top of a screen you pushed into is one level too many to reason about.

For: one place, one model, deep-linkable. Every edit applies as you make it, so there is no Save, no Cancel and no draft to lose. The hold-menu rule is satisfied without anyone having to think about it.

Against: it is a form, and a form is the wrong shape for the case that happens 90% of the time, which is ticking something off. With no Save there is also no undo boundary — a stray tap on the calendar silently moves a due date for the whole household.`,
  },
  {
    id: 'note-task-b',
    ...at(1, verdict(S3)),
    w: 430,
    text: `B — Read-only screen, edit in a sheet

Claim: reading and editing are different acts. The screen is a legible summary; editing is a form, and on a phone a form belongs in a sheet with Cancel and Save.

For: an accidental tap changes nothing. It is the same sheet the composer's "Add with details" opens, so one form exists instead of two — one set of validators, one set of message keys.

Against: two taps to change a due date, and the sheet covers the thing you are editing. It also invents a read-only state the data does not have: everything on that screen IS editable, and the screen is pretending otherwise.`,
  },
  {
    id: 'note-task-c',
    ...at(2, verdict(S3)),
    w: 430,
    text: `C — No detail screen; the row is the editor

Claim: the third level is a web habit. Hold the row, pick the field, edit it in place or in a small sheet. The Module stays two levels deep.

For: the fastest edit of the three, and it deletes a route, a screen and a back-stack from the app.

Against: it contradicts docs/mobile-interaction.md head-on — everything in a hold menu is supposed to also be on a detail screen, and here there is none. A link to one task has nowhere to land, which matters because "every deep-linkable screen must have a working parent when opened cold" is in the same document. Choosing C means amending that document, not making an exception in a component.`,
  },
  {
    id: 'note-quickadd',
    ...at(3, verdict(S3)),
    w: 430,
    text: `The Add tab's task row

What it does today: nothing. task-new is kind: 'row' in src/shell/quickActions.ts, QuickActionSheet grows the field, and what you submit goes into local state and is thrown away.

Drawn here: the field, plus a "Goes in" chip defaulting to the last list you added to, with a picker one tap away. Tap the chip.

Open question: last-used, a per-Group Inbox list, or no default at all. Last-used is drawn because it needs no schema change — but it is also the one that silently files things in the wrong place after you use a different list once.`,
  },

  {
    id: 'brief-notes',
    ...at(0, brief(S4)),
    w: 880,
    text: `NOTES — the Module that does not exist yet, and the question that decides its schema.

Nothing is being ported here. src/routes/_app/g/$groupSlug/notes.tsx is a six-line ModulePlaceholder, notes is status: 'placeholder' in packages/core/src/modules.ts, and there is no notes table in convex/schema.ts. The phone gets Notes first; the web tile stays a placeholder.

So these three do not disagree about layout. They disagree about WHAT A NOTE IS, and each one implies a different table. The implied schema is written at the end of each verdict below — that is the part worth judging, because it is the part that is expensive to change later.

Each direction is a PAIR: its index, then one note opened.

Open question none of them settle, because it is orthogonal to all three: PER-GROUP OR PER-PERSON? Every other Module in gather is scope: 'group' and all three are drawn that way. But Notes is the one Module where a person plausibly wants a private one, and a notes table with an optional userId is a very different thing to query, to share and to seed than one without.

B's checkboxes and colour swatches are live.`,
  },
  {
    id: 'note-notes-a',
    ...at(0, verdict(S4)),
    w: 860,
    text: `A — A note is a document

Claim: a note is the long thing that has no other home — the wifi codes, your mum's appeltaart, what the builder actually said. Title, body, searchable, and that is the whole idea.

For: it is what people already mean by "notes", so nothing needs explaining. One text column is one unambiguous schema, one editor and one search index. It is the only one of the three that does not overlap something gather already has.

Against: writing long text on a phone is miserable, so this is the direction most likely to be built and then not used. And it competes head-on with Notes.app and Keep, which are already on the phone and already better at it.

Implied schema: notes { groupId, title, body, updatedBy, updatedAt } plus an index on groupId. Nothing else — the cheapest of the three by a wide margin.`,
  },
  {
    id: 'note-notes-b',
    ...at(2, verdict(S4)),
    w: 860,
    text: `B — A note is a card you capture

Claim: notes are captured, not composed. You open this to dump something in under five seconds, a title is optional, and colour is how you find it again. Half of them turn out to be checklists.

For: the fastest capture of the three, and the checklist variant covers most of what people mean when they ask for notes. The colours are gather's own four Module tints, so a household builds a shared visual memory of its own board rather than learning a new palette.

Against: a checklist note is a task list wearing a hat. gather already has task lists — with an order column, sharing rules and provider adapters — and this quietly builds a second, weaker one that none of that applies to. A two-column board is also a different visual language from every other screen in this app.

Implied schema: notes { groupId, title?, body, color, pinned, items?: [{ text, done }] }. That optional items array is the fork in the road: answering "yes, a note can be a checklist" is the decision here, not the layout.`,
  },
  {
    id: 'note-notes-c',
    ...at(4, verdict(S4)),
    w: 860,
    text: `C — A note is attached to a thing

Claim: a household does not write notes, it leaves them for each other, about something. So a note hangs off a subject — a list, a child, a recipe, or the household itself — and reads as a short running thread rather than a document.

For: the only one of the three that is not a worse version of an app already on the phone. It makes Notes a layer over the other Modules instead of a twelfth tile, and it is the one that would actually get used, because leaving a line about the plumber is a five-second act with an obvious place to put it.

Against: the biggest commitment on this canvas. It needs a polymorphic subject reference, every Module has to opt in with its own Notes affordance, and the feature is useless until at least two of them have. Notes attached to nothing still need somewhere to live — the second group on the index — so you end up building A as well, and then you have two kinds of note.

Implied schema: notes { groupId, subjectType, subjectId?, entries: [{ body, authorId, at }] }. Note the entries array: appending rather than editing is what makes it a thread, and it is also what makes "fix that typo" a thing you have to design.`,
  },
]

for (const [name, html] of Object.entries(screens)) {
  writeFileSync(join(OUT, name), html)
}

const listed = new Set(artboards.map((a) => a.file))
for (const name of Object.keys(screens)) {
  if (!listed.has(name)) throw new Error(`${name} is not laid out in canvas.json`)
}
for (const a of artboards) {
  if (!screens[a.file]) throw new Error(`${a.file} is laid out but not drawn`)
}

writeFileSync(
  join(OUT, 'canvas.json'),
  `${JSON.stringify({ artboards, annotations, launch: { view: 'canvas' } }, null, 2)}\n`,
)

console.log(`${artboards.length} artboards, ${annotations.length} annotations`)
