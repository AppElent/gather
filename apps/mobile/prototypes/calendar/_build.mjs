/**
 * Writes this canvas's artboards and its canvas.json.
 *
 *   node _build.mjs
 *
 * The `.dc.html` files and `canvas.json` are the deliverable; the `_*.mjs`
 * files are the source they are generated from, kept so a later change is an
 * edit rather than a rewrite. See `_kit.mjs` for why the chrome and the
 * fixture month are shared.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import cellScreens from './_screens-cell.mjs'
import eventScreens from './_screens-event.mjs'
import mixScreens from './_screens-mix.mjs'
import screenScreens from './_screens-screen.mjs'

const OUT = dirname(fileURLToPath(import.meta.url))
const screens = { ...mixScreens, ...screenScreens, ...cellScreens, ...eventScreens }

const COL = 470 // 390pt artboard + 80px gutter
const at = (col, y) => ({ x: col * COL, y })

/* THE MIX on top, then one row per question — now the reasoning behind the
 * mix rather than three live options. */
const MIX = 0
const Q1 = 1620 // what the calendar screen IS
const Q2 = 3180 // one cell, two channels
const Q3 = 4740 // adding and editing an event
const brief = (y) => y - 220
const verdict = (y) => y + 890

const artboards = [
  { file: 'Main.dc.html', title: 'THE MIX — Week', ...at(0, MIX) },
  { file: 'MixMonth.dc.html', title: 'THE MIX — Month', ...at(1, MIX) },
  { file: 'MixAgenda.dc.html', title: 'THE MIX — Agenda', ...at(2, MIX) },
  { file: 'MixNew.dc.html', title: 'THE MIX — New event', ...at(3, MIX) },
  { file: 'MixEdit.dc.html', title: 'THE MIX — Editing one', ...at(4, MIX) },

  { file: 'ScreenA.dc.html', title: 'A — The month grid', ...at(0, Q1) },
  { file: 'ScreenB.dc.html', title: 'B — A week, then the agenda', ...at(1, Q1) },
  { file: 'ScreenC.dc.html', title: 'C — Agenda first', ...at(2, Q1) },

  { file: 'CellA.dc.html', title: 'A — Dots', ...at(0, Q2) },
  { file: 'CellB.dc.html', title: 'B — Titled bars', ...at(1, Q2) },
  { file: 'CellC.dc.html', title: 'C — Who, not what', ...at(2, Q2) },

  { file: 'EventA.dc.html', title: 'A — A form, with a Save', ...at(0, Q3) },
  { file: 'EventB.dc.html', title: 'B — One sheet, no Save', ...at(1, Q3) },
  { file: 'EventC.dc.html', title: 'C — Compose on the day', ...at(2, Q3) },
].map((a) => ({ ...a, w: 390, h: 844, is_interactive: true }))

const annotations = [
  {
    id: 'mix',
    ...at(5, MIX),
    w: 440,
    text: `THE MIX — the chosen design, built from your verdict. The lettered rows below are now the reasoning behind it rather than live options.

ROW 1 — ALL THREE, BEHIND A SWITCHER. You were right that this is a preference rather than a decision, and iOS already has the control for it: an \`ellipsis.circle\` in the nav bar opening a menu with a checkmark on the current view. Not a segmented control, not a custom toggle — the same affordance Files, Mail and Photos use for "how should this be displayed".

The first three artboards are ONE component at three starting views, so they cannot drift. THE SWITCHER IS LIVE ON ALL THREE: tap the ⋯ and pick another view. The menu also carries Calendars…, because a menu with one section in it looks like a control that should have been a button.

ROW 2 — C, with the answer C didn't have to give. Initials tinted by the calendar, exactly as drawn. But: AN EVENT WITH NOBODY ON IT IS A DOT IN ITS CALENDAR'S COLOUR. That case is not an edge — \`calendarEvents\` has no assignee column at all, so on the day this ships EVERY event is a dot, and C only becomes C as people start using it. The mix fixture puts two of them in (Bins out, Big shop) so you can see the two marks side by side. That is the one change to the shared setup.

ROW 3 — B, re-cut around your Todoist screenshot. See the note to the right.

WHAT THE SWITCHER COSTS: a stored preference. Per device is free and silently differs between your phone and your tablet; per person per Group is a \`memberships\` column next to \`hiddenCalendarIds\`, which is where \`pinnedModuleIds\` already lives. I would put it there — it is a person's preference, not a household's, and the row already exists.

FOR A LATER CANVAS, noted and not built: the Outlook-style fluid header, where the week strip stays with you and grows into the month as you drag the agenda. It is a gesture question rather than a layout one, it wants a real device to judge, and it does not change anything decided here — the switcher and the fluid drag are complementary, not rivals.`,
  },
  {
    id: 'mix-composer',
    ...at(6, MIX),
    w: 440,
    text: `THE COMPOSER — B, re-cut around the Todoist card.

What the screenshot actually settles, and what I took from it:

TEXT FIRST AND LARGEST. The name field is 21px semibold at the top of the card with the caret already in it. Everything else is a 44pt chip underneath. Todoist is right about this: in the overwhelming majority of adds, the name is the whole event and every other field is already correct.

IT IS A CARD ABOVE THE KEYBOARD, NOT A SHEET. Roughly 130 points tall, floating on a scrim, immediately above where the keyboard lands. That kills the objection I made to B on its own artboard — a bottom sheet that resizes under your thumb — because this card only ever grows UPWARD, away from your hand.

THE ROUND BUTTON IS THE ANSWER TO THE SAVE QUESTION, and it is a better one than either A or B had. Creating commits on the button; it is grey until the name has a character in it, so a half-typed event never reaches the household calendar. Editing (the fifth artboard) applies as you change it and the button becomes a ✓ that only dismisses. Create needs a commit; an edit does not. Both are true, and the same card does both.

THE [+] IS WHERE THE LONG TAIL GOES. All-day, Where, Notes — and Repeats…, which is where recurrence lands without its own canvas row. Tap it.

WHAT I DIDN'T COPY: Todoist's red. The commit button and the set chips are the Calendar Module's own olive, because a household app with one accent per Module should not grow a second one for a button.

LIVE ON THE NEW-EVENT ARTBOARD: type a name and the button lights up. Tap "Wed 2 Sep" and the calendar opens INSIDE the card — the same grid DueDateSheet already draws, adopted rather than redrawn. Tap [+] for the second chip row. On the editing artboard, the ⋯ opens Duplicate / Delete.

TWO THINGS THIS DOESN'T SOLVE, flagged rather than smuggled past:
· The chip strip scrolls horizontally, and a horizontally-scrolling row of controls is where people miss things. The [+] hides four more. If "Where" turns out to matter, it earns a permanent slot and something else goes behind the [+].
· Todoist's card has a keyboard-attached toolbar because the field is always focused. Ours dismisses to the calendar behind it, so the scrim has to be tappable and dismissal has to keep what you typed.`,
  },

  /* ── Q1 ────────────────────────────────────────────────────────────── */
  {
    id: 'brief-screen',
    ...at(0, brief(Q1)),
    w: 760,
    text: `WHAT THE CALENDAR SCREEN IS — the most expensive question to reverse, and the one the other two rows sit inside.

Today the screen is a 42-cell grid with a composer bolted underneath (KitchenScreens.tsx:681). All three of these are better than that; they disagree about what a household opens the app to find out.

SETTLED: all three, kept, behind an iOS view menu in the nav bar. See THE MIX at the top — the three mix artboards are one component at three starting views, and the switcher is live on each. What is written below is why each layout deserved to survive, which is now the argument for keeping all three rather than for picking one.

Fixed in all three: reached from the All tab, so the back target is All. One "+" in the nav bar. Colour is the calendar, an initial is the person. Tapping a day changes what is below it.

LIVE — this is the row where the still artboards would lie:
· A's month arrows work. Page to August or October and watch the screen become useless, because the grid is the whole screen and there is nothing in those months. That is not a bug in the drawing; it is the direction's actual failure mode.
· B's month name is a button. Tap "September 2026" and the week strip expands into the full month, and collapses again. That gesture is the entire argument for B.
· C's calendar icon opens the month as a picker sheet.

The thing to judge is not which looks nicest. It is: WHEN A PERSON OPENS THIS, WHAT QUESTION ARE THEY ASKING? A answers "what does this month look like". B answers "what's on, and roughly what's coming". C answers "what's next". Only one of those is the reason somebody picks up their phone in a kitchen.`,
  },
  {
    id: 'note-screen-a',
    ...at(0, verdict(Q1)),
    w: 430,
    text: `A — The month grid, the day beneath

Claim: "calendar" means a month. The grid is the thing people can read without being taught, and finding a free weekend three weeks out is the one job only a grid does.

For: it is the shape every other calendar app has trained people on, and it is the smallest change from what is there today. Spatial memory works — "it was the Thursday in the middle" is a real way people remember things. It is also the only direction where the empty week reads as information rather than as absence.

Against: the grid eats 260 of 844 points and tells you almost nothing with them — five dots for five events, and you still have to tap. What is left over shows ONE day, so the screen answers "what is on the 2nd" and refuses to answer "what is on this week". Page to a month with nothing in it and the screen is 80% blank. It is the direction that spends the most space on the least content.`,
  },
  {
    id: 'note-screen-b',
    ...at(1, verdict(Q1)),
    w: 430,
    text: `B — A week strip, then the agenda

Claim: a household asks "what's on" far more often than "what does March look like". So the default is the content, and the month is one tap away rather than gone.

For: the most content per pixel of the three, without giving up the spatial view — tap the month name and the strip becomes the grid. The dots on the strip still say which days are loaded. It degrades well: an empty week is one line of nothing rather than a screenful. It is also what Apple Calendar and Fantastical both converged on for a phone, which is weak evidence but not no evidence.

Against: two things that scroll, and the expand gesture has to be discoverable or the month view is effectively missing. The agenda runs forward from the selected day, so looking backwards means selecting backwards — a small but real asymmetry. And the strip's dots are the same weak signal as A's, just seven of them instead of thirty-five.`,
  },
  {
    id: 'note-screen-c',
    ...at(2, verdict(Q1)),
    w: 430,
    text: `C — Agenda first, month demoted to a picker

Claim: the grid is a paper metaphor. What a household needs is a list of what is coming, with the days that have nothing on them taking up no room at all.

For: the most honest use of a phone screen — content top to bottom, empty days collapsed into one grey line ("7–13 September · nothing on"). It scales: a household with forty events a month reads fine here and is confetti in A. It is also the cheapest to build well, and the closest thing to what Cozi actually ships.

Against: it deletes the month as a place. "Are we free the last weekend of the month" becomes a scroll, and the picker sheet is a second, weaker calendar you have to build anyway — so you end up drawing a grid regardless, just a worse one. For gather's actual data — nine events in a month — the screen is mostly grey separator lines, which reads as an app nobody uses.`,
  },

  /* ── Q2 ────────────────────────────────────────────────────────────── */
  {
    id: 'brief-cell',
    ...at(0, brief(Q2)),
    w: 760,
    text: `ONE CELL, TWO CHANNELS — how much is a 42-cell grid allowed to say?

At 390 points a cell is about 51 wide. Colour is the calendar and an initial is the person; the question is how many of either a cell can carry before the month stops being readable at a glance.

SETTLED: C. With one addition it did not have to make here — an event nobody is on shows as a DOT in its calendar's colour, which today is every event, because \`calendarEvents\` has no assignee column yet. See THE MIX.

These three are NOT three palettes. They disagree about what a cell is FOR. A says a cell reports that something exists. B says a cell reports what it is. C says a cell reports who it lands on.

LIVE, and this is the control that matters: each artboard has "A quiet month / A month they use". The left state is gather's nine fixture events. The right state adds a third calendar (Work, plum) and eighteen more events — which is a normal September for a family of three. Flip it on all three and the answer is usually obvious within two seconds.

Tapping a day also works, and the strip at the bottom shows what that cell was trying to summarise. That is the check worth making: how much did the cell actually tell you, compared with what was there?

The third calendar is doing double duty. It is also the ceiling test: the tints are gather's four Module colours, so a fifth calendar has no colour left. If a household can have five calendars, one of these directions has to say what happens.`,
  },
  {
    id: 'note-cell-a',
    ...at(0, verdict(Q2)),
    w: 430,
    text: `A — Dots

Claim: a month grid is an index, not a summary. Its only job is to say "there is something here" so you know where to tap. One dot per event, coloured by calendar, three maximum.

For: it survives the busy month intact — the grid is still a grid, the numbers are still the first thing you read, and the colour still tells you whether the load is school or household. The day number keeps a full-size 27px circle, which is the only direction where the date is unambiguously the primary element. It is also what the existing DueDateSheet already draws, so the two calendars in the app would finally look like each other.

Against: it is nearly information-free. Three dots and eight events look the same; a dentist appointment and a two-week holiday look the same. Everything you actually want to know needs a tap, which makes the grid a menu rather than a view — and if the grid is only a menu, direction C on the row above deletes it and loses nothing.`,
  },
  {
    id: 'note-cell-b',
    ...at(1, verdict(Q2)),
    w: 430,
    text: `B — Titled bars

Claim: if the grid is the whole screen it should earn it. Two tinted bars with the event's name, "+n" for the rest — the Google Calendar answer.

For: on a quiet month it is genuinely better than A. You can read the month without touching it, and "Bins out" on Friday is exactly the kind of thing a household wants to see without tapping.

Against: flip it to the busy month. 9px type truncating to five characters is not reading, it is decoration that looks like reading, and it fails the 12pt floor by a distance. Two bars plus "+2" means the cell reports a third of what is there and hides which third. The day number has to shrink to 12.5px and move to the corner to make room, so the grid stops being primarily a calendar. And dark mode has to keep a tinted background legible behind 9px text, which is where this direction will actually break.`,
  },
  {
    id: 'note-cell-c',
    ...at(2, verdict(Q2)),
    w: 430,
    text: `C — Who, not what

Claim: in a household the useful question is not "what is on the 14th" but "who is committed on the 14th". So the cell carries initials, tinted by the calendar the commitment came from — both channels, one mark.

For: it is the only direction that uses the person channel at all, and it answers the question a shared calendar exists for. Three initials read cleanly at 19px where three titles do not, and the tint still carries the calendar, so nothing is lost relative to A. On the busy month it degrades to "+n" gracefully rather than to noise.

Against: it inverts the hierarchy — the day number drops to 12.5px in the corner, and a calendar whose dates are secondary is a strange object. Initials collide (Eric and Emma are both E; the fixture dodges this by using Mila, which is cheating). And it is the only direction that depends on data the app does not have: \`calendarEvents\` has no assignee column, so C cannot be built at all until that lands — which makes it a vote for a schema change as much as for a look.`,
  },

  /* ── Q3 ────────────────────────────────────────────────────────────── */
  {
    id: 'brief-event',
    ...at(0, brief(Q3)),
    w: 760,
    text: `ADDING AND EDITING AN EVENT — and whether there is a Save button at all.

An event has more fields than a task: title, calendar, date, all-day, start, end, who, where, notes. Nine, against a task's five. That is what makes this a real question rather than a restyle.

SETTLED: B, re-cut as a Todoist-style card above the keyboard — name field first and largest, everything else a 44pt chip, a round commit button that is grey until the name has a character in it. See THE MIX's last two artboards and the note beside them. That resolves the Save question as "create commits, an edit does not", which is neither A's answer nor B's.

DueDateSheet's header comment argues that a phone edit applies as you make it and there is no Save. The tasks canvas settled the same way. A disagrees, in writing, and its note says why. B and C accept it and diverge on where the fields live.

Fixed in all three: the platform's own sheet does the presentation, scrim and dismissal (NativeSheet / @expo/ui BottomSheetModal). The date picker is DueDateSheet's — the month grid, Monday-first, six rows, with Today / Tomorrow / Weekend above it — adopted, not redrawn. A direction that reinvents that grid loses to one that adopts it.

LIVE:
· A — click the Title field and type; Save lights up. Flip All-day and Starts/Ends collapse to one Date row. Tap the initials to change who is going.
· B — tap the "Wed 2 Sep" chip and DueDateSheet's calendar takes over the sheet in place, then Done returns. Tap "S · M" for the member list. The title is a real field.
· C — click "What is it?" and type; the ⌄ reveals the rest.

THE THING I WOULD ARGUE ABOUT: creating and editing are not the same act, and the row may not have one winner. An edit has something to undo to; a create does not.

NOT DRAWN, and flagged rather than smuggled in: recurrence. If the winning form has nowhere to put a rule, recurrence wants its own canvas row later rather than a field bolted onto the side. That is a foreseeable cost of B and C, and not of A.`,
  },
  {
    id: 'note-event-a',
    ...at(0, verdict(Q3)),
    w: 430,
    text: `A — A pushed form, with a Save

Claim: nine fields is a form, and a form belongs on a screen with Cancel and Save. The Save is not ceremony — it is the undo boundary, and a shared calendar is exactly where you want one.

For: everything is visible at once, which is the only direction where you can check an event before it exists. Room for location, notes, and later a recurrence rule without redesigning anything. An accidental tap changes nothing. It is also the one direction that handles the case a household actually does badly today: entering three events in a row.

Against: it contradicts what the app already decided for tasks — sheets, apply-on-change, no Save — so choosing it means the two Modules feel different, or means revisiting the tasks verdict. It is the most screen for the most common case, which is adding "Bins out" on a Friday. And a Save button implies a draft, which implies a discard prompt, which is a third thing to design.`,
  },
  {
    id: 'note-event-b',
    ...at(1, verdict(Q3)),
    w: 430,
    text: `B — One sheet, chips, no Save

Claim: the sheet already exists. NativeSheet, DueDateSheet, the member list — this direction is assembly, not construction. The title is a field; everything else is a chip that opens its own picker IN PLACE, so the sheet never stacks on a sheet.

For: fastest to build by a wide margin, and it matches the tasks Module exactly, so the app has one editing idiom instead of two. The chips are honest about what is set and what is not — a dashed chip is an empty field, and you can see at a glance that there is no location. The same sheet edits and creates.

Against: no Save means the event exists from the first keystroke, so a half-typed "Den" is on the household calendar for a moment — and on a shared calendar somebody else can see it. The chip row is a horizontal list of nine things on a 390pt screen, which wraps to three rows and stops being scannable. And a chip that opens a picker in place means the sheet resizes under your thumb, which on a real device is the part most likely to feel wrong.`,
  },
  {
    id: 'note-event-c',
    ...at(2, verdict(Q3)),
    w: 430,
    text: `C — Compose on the day

Claim: the day is already chosen by where you tapped, so the only thing missing is a title. One line appears under the day, you type, and it exists. Everything else is behind a ⌄ that most people will never open.

For: the fastest capture on the canvas and the only one with no navigation at all — no push, no sheet, no dismissal. It is the same move as the task composer at the bottom of a list, which the app already has and people already understand. The date field is free, which removes the single most-fiddled control.

Against: it only works on an agenda or a day list, so it ties this row's answer to the row above — pick A up there and C is unbuildable. Editing an existing event has nowhere to go, so you end up building a second editor anyway and then you have two. And the ⌄ hides eight of the nine fields behind a control with no label, which is where "the app can't do locations" comes from.`,
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
