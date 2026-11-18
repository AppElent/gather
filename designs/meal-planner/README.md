# Meal planner — design study (APP-293)

A week menu the household plans together: every enabled meal moment per day,
who eats along, busy evenings from the calendar, household meal preferences
("gedragsinstellingen"), an AI week plan built from the Group's own recipes,
swap one meal or get a new recipe idea, and one step from the week to the
grocery list. The phone leads; the web follows with the same functions
(APP-322, after the web module layout APP-300).

**Canvas:** https://claude.ai/artifact/1vWm6pg7C7TpQSqzFLJSGc ("Gather — Meal planner").
**Approved:** all pages, by Eric, 18 November 2026, with the AI proposal as
direction **A, drafts in the week itself**. B (the proposal in a separate
review sheet) stays here and on the canvas's History page as the round's
record.

Builds on the approved Groceries study (`designs/groceries/`): the week-to-list
sheet is that study's recipe sheet (section 5) with a day picker, and In huis
(APP-314) is the stock source. Group: **Kitchen** (`kitchen-fill`,
`kitchen-on`, `kitchen-text`, `kitchen-wash`). AI parts get no colour of their
own: a small spark glyph and always a reason in words.

## Files

| File | Artboard | Issue |
| --- | --- | --- |
| `Main.dc.html` | Shared phone part; props `screen`, `theme`, `size`, `fallback`. Default: week, light | APP-317 |
| `Week-Dark.dc.html` | Week, dark | APP-317 |
| `Week-SE.dc.html` | Week, iPhone SE (375×667) | APP-317 |
| `Meal.dc.html` | Meal sheet: who eats, servings, move, note, actions | APP-317 |
| `Pick.dc.html` | Pick a recipe, filtered by preferences | APP-317, 318 |
| `Prefs.dc.html`, `Prefs-Dark.dc.html` | Eetvoorkeuren | APP-318 |
| `Plan.dc.html` | Plan my week start sheet | APP-319 |
| `Proposal.dc.html`, `Proposal-Dark.dc.html` | A: proposal as drafts in the week (chosen) | APP-319 |
| `Fallback.dc.html` | A with the rules-only fallback banner | APP-319 |
| `Limit.dc.html` | Plan sheet over the daily cap | APP-319 |
| `Review.dc.html` | B: proposal in a review sheet (not chosen) | APP-319 |
| `Swap.dc.html` | Something else: three alternatives | APP-320 |
| `Idea.dc.html` | New idea: draft recipe | APP-320 |
| `Groceries.dc.html` | Week menu to the grocery list | APP-321 |
| `canvas.json` | Positions, titles, sticky notes (the brief and rationale) | |

The artboards are a visual reference. Build from this companion and the phone's
own tokens and components (`apps/mobile/DESIGN_SYSTEM.md`), not from the
artboards' markup. Sample data (household Verbeek: Sanne, Daan, Noor, Mees;
week 23 to 29 November) is illustration only.

## Vocabulary

| Concept | NL | EN |
| --- | --- | --- |
| Module and screen | Weekmenu | Week menu |
| Meal moments | Ontbijt, Lunch, Avondeten | Breakfast, Lunch, Dinner |
| Preferences screen | Eetvoorkeuren | Meal preferences |
| AI week plan | Plan mijn week | Plan my week |
| Swap | Iets anders | Something else |
| New AI recipe | Nieuw idee | New idea |
| One AI call | slimme actie | smart action |
| Quick meal without recipe | Snel gerecht | Quick meal |

Never write "AI" in buttons. The words "Door AI bedacht" / "Made by AI" appear
only on a generated recipe draft and its saved source.

## 1. Week (APP-317)

Wash screen, `washScreenOptions('Weekmenu' / 'Week menu')`, back to Keuken.
`WashHeader` with the kitchen `tile-l` (calendar glyph), summary `{n} van 7
avonden gepland · {p} personen` / `{n} of 7 dinners planned · {p} people`, and
a week pill `23 – 29 nov` between previous/next round buttons (36 pt visual,
44 pt hit). Swiping the content left or right also changes the week. Bar
button `…`: Eetvoorkeuren, Deel weekmenu.

Actions row: kitchen primary **Plan mijn week** (spark glyph, grows), `surface`
pill **Boodschappen** (cart), icon-only **Eetvoorkeuren** (sliders,
`aria-label`).

One section per day, Monday first:

- Heading: `{Weekday}` in rounded 17/700 plus the date in `muted` 15. Busy
  evening: a `surface-2` pill with calendar glyph and the event, e.g.
  `Zwemles 18:00` (an event that overlaps 17:00 to 20:00). Trailing: one
  22 pt coin per Member. A Member who does not eat along: dashed `hairStrong`
  ring, `muted` initial, struck through. The coin group has one
  accessibility label: `Alle 4 eten mee` / `All 4 eating`, `3 eten mee,
  zonder Daan` / `3 eating, without Daan`.
- An inset list with one row per enabled slot, in order breakfast, lunch,
  dinner.
  - Planned: 46 pt thumb (recipe photo; without one, `kitchen-wash` with book
    glyph; a quick meal `surface-2` with bolt glyph), slot label (footnote
    600 `muted`), title (body 600), meta `{min} min · {n} personen` and
    `, zonder {name}` when someone is out. Chevron. Tap opens the meal sheet.
  - Empty: dashed 46 pt tile with `+` in `kitchen-text`, slot label, `Kies
    avondeten` / `Choose dinner` (and lunch, breakfast) in `kitchen-text`.
    Opens Pick.
- Footnote under the week: `Houd een maaltijd ingedrukt om hem naar een andere
  dag te slepen. Staat daar al iets, dan wisselen ze om.` / `Press and hold a
  meal to drag it to another day. If that day has a meal, they swap.`

Drag: long press lifts the row; dropping on a day with a meal in that slot
swaps them, an empty slot moves it. Haptic on lift and drop. Move from the
meal sheet is the accessible path.

### Meal sheet

`NativeSheet`, medium and large detents, `Klaar` / `Done` left. Header: kitchen
`tile-m` (book or bolt), eyebrow `Donderdag 26 nov · Avondeten` in
`kitchen-text`, title in title-2, `{min} min · recept` / `snel gerecht`.

1. **Wie eet mee / Who's eating**: one toggle pill per Member (coin + name,
   `aria-pressed`). Off: transparent, dashed border, name struck through.
   Prefilled from the Member's default (APP-318) and from calendar events that
   evening; the source shows below: `Uit de agenda: Daan, teamuitje 18:30` /
   `From the calendar: Daan, team outing 18:30`. Then **Porties / Servings**
   stepper with sub `Gelijk aan wie mee-eet` / `Same as who's eating`, or
   `Aangepast, wie mee-eet: {n}` / `Adjusted, eating: {n}`. Changing who eats
   resets servings to that count.
2. **Verplaatsen naar / Move to**: a 7-column day grid. Current day selected
   (`ink` fill); a dot marks days that already have this slot planned. Status
   line: `Wisselt met {title} op {day}.` / `Swaps with {title} on {day}.` or
   `{title} gaat naar {day}. {Weekday} wordt leeg.` Applies on Klaar.
3. **Notitie / Note**: free text, two lines visible.
4. Actions (inset list): Recept openen / Open recipe; **Iets anders** /
   **Something else** with sub `Drie alternatieven die op {weekday} passen`;
   Boodschappen voor dit recept (the APP-312 sheet); Uit weekmenu halen /
   Remove from week menu (`danger`, undo toast, no confirm).

### Pick (empty slot)

Sheet, title `Avondeten {weekday}` / `Dinner {weekday}`. Search field `Zoek in
{n} recepten`. Chips: **Volgens voorkeuren / Matches preferences** (on by
default; sliders glyph), then `Tot 20 min`, `Tot 30 min`, `Tot 60 min`
(replace today's 10/20/30 filter; single select, tap again to clear). Status
line: `{n} recepten verborgen door jullie voorkeuren ({reasons}). Tik
Volgens voorkeuren om ze te zien.`; with the filter off, rows that clash show
the reason in `danger` 600 (`Bevat pinda`, `Bevat champignons, staat bij liever
niet`). Rows: thumb, title, `{min} min · {facts}` where facts are any of
`Vleesloos`, `{rating} sterren`, `{n} weken geleden`, `pompoen in huis`,
`Staat al op {day}`. Last card: **Snel gerecht zonder recept** (today's
quick meal flow).

## 2. Eetvoorkeuren (APP-318)

Pushed screen from the week (bar `…`, the sliders button, and the Plan sheet's
Aanpassen). Large title `Eetvoorkeuren` / `Meal preferences`, subhead `Voor
heel {group}. Gather gebruikt dit bij zelf kiezen, Plan mijn week en Iets
anders.` Every change saves at once (no Save button). Sections, each an inset
list with a footnote:

| Section | Rows | Footnote (NL) |
| --- | --- | --- |
| Wie eet mee / Who eats | Per Member: coin, name, `Eet standaard mee` / `Eet standaard niet mee`, switch. Then **Porties per maaltijd** stepper, sub `Standaard gelijk aan wie mee-eet` | Eet iemand een keer niet mee? Tik op die maaltijd in het weekmenu. Een afspraak in de agenda zet het al voor je klaar. |
| Wat plannen / What to plan | Ontbijt (switch), Lunch (switch + day chips, default za zo), Avondeten (switch + day chips, default all) | Alleen wat aan staat krijgt een plek in het weekmenu en in Plan mijn week. |
| Kooktijd per dag / Cooking time per day | 7-column grid; each cell day + value; tap cycles 15, 20, 30, 45, 60, 90, geen. Default 30 weekdays, 60 weekend | Op een drukke avond in de agenda kiest Gather iets snels, wat hier ook staat. |
| Dieet / Diet | Multi chips: Vegetarisch, Veganistisch, Pescotarisch, Glutenvrij, Lactosevrij, Halal | Geldt voor de hele groep. Niets gekozen: alles mag. |
| Allergieën / Allergies | Multi chips, the 14 EU allergens: Gluten, Schaaldieren, Eieren, Vis, Pinda, Soja, Melk, Noten, Selderij, Mosterd, Sesam, Sulfiet, Lupine, Weekdieren | Gather slaat een recept over als het ingrediënt er herkenbaar in staat. Bij twijfel staat er "controleer zelf" bij. Kijk bij een allergie altijd zelf het etiket na. |
| Liever niet / Rather not | Removable tags, plus an add field `Toevoegen, bijvoorbeeld koriander` | |
| Afwisseling / Variety | `Zelfde recept niet binnen` stepper (dagen, default 14); `Vleesloze avonden` per week stepper (default 0); `Visavond` day chips | |
| Restjes / Leftovers | `Kook dubbel op` day chips | Op deze dagen kookt Gather voor meer porties. De dag erna wordt "Restjes", tenzij daar al iets staat. |
| Extra | `Weekbudget` value row (Geen / € amount, number field per `docs/standards/number-fields.md`); `Favoriete keukens` chips: Italiaans, Mexicaans, Aziatisch, Hollands, Midden-Oosters, Indiaas | Budget telt alleen mee als recepten een prijs hebben. Zonder budget let Gather er niet op. |
| Slimme voorstellen / Smart suggestions | Switches: Gebruik wat in huis is; Houd rekening met de agenda; Liever hoog beoordeeld (all on) | Plan mijn week, Iets anders en Nieuw idee kosten elk 1 slimme actie uit je eigen daglimiet van 30. Zelf kiezen met deze filters is altijd gratis. |

Closing footnote: `Iedereen in {group} kan dit aanpassen; wijzigingen gelden
meteen. Eetvoorkeuren gaan mee in de export van je gegevens.`

Chips: selected = `ink` fill, `on-ink` text, check glyph; unselected =
`surface` with a 1 pt `hairStrong` border. Day chips use the short day
(`ma` … `zo`) with a full-day accessibility label. Switches are the native
switch. The sample's 2 meat-free nights and a Friday fish night are
illustration; defaults are none.

## 3. Plan mijn week (APP-319, direction A)

**Start sheet** (`NativeSheet`, large): title `Plan mijn week` (rounded 28),
subhead `{range}. Gather vult alleen wat nog leeg is, met jullie eigen
recepten.`

1. **Welke dagen / Which days**: 7-column grid. Planned days locked (`surface-2`,
   `gepland`), empty days toggle between `vullen` / `fill` and `overslaan` /
   `skip`. Under it slot chips `Avondeten`, `Lunch (za, zo)` from the enabled
   slots.
2. **Wens voor deze week (mag leeg)**: one text field, plus three toggle chips
   `Veel groente`, `Eén keer iets nieuws`, `Iets met {item bijna op}` (the
   last from In huis; omit when nothing is low).
3. **Gather houdt rekening met / Gather takes into account**: rows with
   `surface-2` tile: Eetvoorkeuren (summary of what is set, `Aanpassen` link);
   Agenda (busy evenings); Wie eet mee (days with fewer people); In huis (low
   or in-stock items used). Rows without content are left out.
4. Kitchen primary `Maak voorstel voor {n} dagen` / `Make a plan for {n}
   days`, footnote `Kost 1 slimme actie · nog {left} van 30 vandaag`.

**Proposal in the week (A).** After the call, the week screen shows:

- A status card under the header: spark tile, `Voorstel van Gather` / `Plan
  from Gather`, `Uit jullie eigen recepten, volgens de voorkeuren en de
  agenda. Neem per dag over, of alles tegelijk.`
- Each proposed slot as a draft inside its day card: 1.5 pt dashed
  `kitchen-text` border, eyebrow `Voorstel · Avondeten` in `kitchen-text`
  with spark, title, reason line `{reason} · {min} min`, then **Neem over**
  (kitchen primary), **Iets anders** (`surface-2`, opens Swap for that day),
  and an icon button **Ander voorstel voor {weekday}** (regenerate just that
  day, 1 slimme actie).
- A glass bottom bar: status `{n} voorstellen nog niet bewaard`, `Weggooien` /
  `Discard` and kitchen primary `Neem alle {n} over` / `Accept all {n}`. When
  none are left: `Alles staat in het weekmenu`, primary `Boodschappen voor
  deze week` (opens section 5), and `Klaar`.
- Accepted drafts become normal meals with meta `… · net overgenomen` until
  the screen is left. Discard: `Voorstel weggegooid. Er is niets veranderd.`
- Drafts are stored server-side per Group and week (so other Members see them
  and they survive closing the app) and expire after 24 hours.

Reasons are short, concrete and from real data: time against the day's
budget, who is out, busy evening, in-stock item, rating, last cooked, variety
rule. The model picks recipe ids from the list it was given or names a quick
meal; a quick meal shows the bolt thumb.

**Fallback** (AI call failed): same layout, status card with clock glyph
`Eenvoudig voorstel` / `Simple plan`, `De slimme planner was niet bereikbaar.
Dit voorstel is gemaakt met jullie eigen regels, zonder AI. Het kostte geen
slimme actie.` Reasons read `{min} min · volgens jullie regels`.

**Over the cap** (`Limit.dc.html`): the start sheet shows, instead of the
form, an alert card: `Je slimme acties voor vandaag zijn op`, `Je hebt er
vandaag 30 van 30 gebruikt. Morgen kan het weer. Er is niets aan je weekmenu
veranderd.`, `Zelf kiezen werkt gewoon, met dezelfde voorkeuren als filter.`
and a kitchen button `Zelf kiezen` (opens Pick). The cap is `DAILY_AI_CALLS`
(30, per person) in `convex/lib/aiUsage.ts`. The groceries study's "1 van je
20" copy predates this; use the real number from the server everywhere.

Not chosen: **B**, the proposal in a separate sheet with a checkbox per day,
a swap button per row, `Zet {n} in het weekmenu` and `Helemaal opnieuw`.

## 4. Iets anders and Nieuw idee (APP-320)

**Swap sheet**: title `Iets anders voor {weekday}` (rounded 28), subhead `Nu:
{title} · {n} personen · {busy}`. A wish field with spark glyph, placeholder
`Een wens? Bijvoorbeeld: met kip, snel` / `Any wish? For example: chicken,
quick`. Single-select chips
`Met kip, snel`, `Vleesloos`, `Sneller` (tapping one asks again; each ask is
1 slimme actie). Three cards: thumb, title, `{min} min · {rating} sterren`,
reason in `ink`, and a `Kies` / `Choose` button. Chosen card: 2 pt
`kitchen-text` border, button `Gekozen` in kitchen fill, and an `ink` toast
`{Weekday}: {new} in plaats van {old}` with `Ongedaan maken` / `Undo`. Below:
a card **Niets dat past? Nieuw idee** / **Nothing fits? New idea**, sub
`Gather bedenkt een recept dat je kunt bewaren`. Footnote `Elke vraag kost 1
slimme actie · nog {left} van 30 vandaag`.

**Idea sheet**: `Terug` / `Back` to Swap, title `Nieuw idee`. Eyebrow `Bedacht
door Gather · concept` in `kitchen-text` with spark; record title (30/700);
why line (`Op je wens "…". Gebruikt de pompoen en spinazie die in huis zijn.
Zonder pinda.`). Facts strip: minutes, personen, ingrediënten. Ingredients
inset list with a servings stepper (scales like the recipe sheet), `in huis`
marker in `muted`. Numbered steps. Footnote `Door AI bedacht. Controleer zelf
op allergieën. Gather geeft bij dit recept geen voedingswaarden.` Buttons:
kitchen primary `Bewaar en zet op {weekday}`; `Alleen bewaren`; `Ander idee`
(1 slimme actie). Saving creates a normal Recipe with source AI.

## 5. Week menu to the grocery list (APP-321)

The Groceries study's recipe sheet in its week form (`designs/groceries/`,
section 5), opened from the week's Boodschappen button, the meal sheet, or
the proposal's done bar. Title `Op de boodschappenlijst`.

1. Source card: kitchen `tile-m` calendar, `Weekmenu {range}`, `{n} maaltijden
   · personen per maaltijd uit het weekmenu`.
2. **Dagen die meetellen / Days that count**: 7-column grid; days with a meal
   toggle `telt mee` / `niet`; empty days are locked as `leeg`. Default: from
   today (or Monday for a future week) to the end of the week.
3. Ingredients grouped by aisle (the groceries aisle ids), checkbox rows with
   meta naming the meals and days (`Shakshuka di, Tacos do`), merge meta
   (`Staat er al: 3, wordt 5`, 600) and In huis items unticked (`… · in
   huis`). Amounts are scaled per meal by its servings.
4. **Zonder recept, even nakijken**: quick meals, e.g. `Tosti's met
   tomatensoep`, `Woensdag · snel gerecht, geen ingrediënten bekend`, with
   `Iets toevoegen` (opens the composer on the list).
5. `Naar lijst` row (last used grocery list), kitchen primary `Zet {n} op de
   lijst`, footnote `Samengevoegd met wat er al op staat. Doe je dit nog een
   keer voor deze week, dan komt alleen wat nieuw is erbij.`

## Data the design needs (fold into the issues)

- Planned meal (APP-317): `slot`, `servings`, `note`, `eaterIds` (optional;
  absent = the Group's default eaters), plus the existing recipe or quick-meal
  reference.
- Preferences (APP-318), one document per Group: default eaters per Member,
  servings override, slots and days per slot, minutes per weekday (null = no
  max), diets, allergens, dislikes, no-repeat days, meat-free nights, fish
  days, double-cook days, weekly budget, cuisines, and the three smart
  switches.
- Proposal drafts (APP-319): per Group and week, slot, recipe id or quick meal
  name, reason, created by, expires at.

## States to build and check

Light and dark; iPhone SE and a large phone; NL and EN; largest text size
(day headings wrap, the coin group moves under the heading). Empty week (all
slots `Kies …`, Plan mijn week stays primary); a Group with one Member (no
coins, no Wie eet mee section on the meal sheet); lunch and breakfast off
(dinner only); busy evening; someone out; proposal pending, partly accepted,
all accepted, discarded; fallback; over the cap; offline (week, meal sheet and
preferences work from cache; Plan mijn week, Iets anders and Nieuw idee are
disabled with `Offline, probeer het straks` / `Offline, try again later`).

## Open runtime questions

- Drag between day sections: check whether the installed list component can
  drag across sections; the meal sheet's move grid is the required fallback.
- Week swipe: horizontal paging must not fight the vertical scroll; a pager
  per week, or only the arrows if the gesture conflicts.
- Allergen and diet filtering depends on the ingredient parser (APP-312) or
  recipe tags; where neither knows, show `controleer zelf` and never claim a
  recipe is free of an allergen.
