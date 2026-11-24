# Groceries — design study (APP-292)

A grocery list that stays a plain shared to-do list at its core, with smart
help around it: amounts and aisles recognised while typing, the list grouped
in the store's aisle order, suggestions from what the household buys, recipes
(and later the week menu) to the list with merging, a list per store, In huis
(staples) in place of the separate Pantry, and a shopping mode. The phone
leads; the web follows with the same functions (APP-316, after APP-300).

**Canvas:** https://claude.ai/artifact/Xi57U8STvXDWbUnf8rBrWR ("Gather — Groceries").
**Approved:** all pages, by Eric, 18 November 2026, with suggestions as
direction **A, a strip above the list** ("ik heb alle tabbladen bekeken en het
ziet er goed uit"). B (suggestions only in the composer) stays here as the
round's record.

Builds on the approved Tasks study (`designs/tasks/`): a grocery list is a task
list of type `groceries` (APP-306) and an item is a task with optional
grocery fields (APP-309). Quick add, Completed, undo, the hold menu and offline
behaviour work as in Tasks unless this study says otherwise. Group: **Kitchen**
(`kitchen-fill`, `kitchen-on`, `kitchen-text`, `kitchen-wash`).

## Files

| File | Artboard | Issue |
| --- | --- | --- |
| `Main.dc.html` | Shared phone part; props `screen`, `theme`, `size`, `suggest`. Default: list, light, strip | APP-309, 310, 311 |
| `List-Dark.dc.html` | List, dark | APP-310 |
| `List-SE.dc.html` | List, iPhone SE (375×667) | APP-310 |
| `Item.dc.html` | Item sheet | APP-309, 314 |
| `Recent.dc.html` | Recent | APP-310 |
| `Composer.dc.html` | Typing with recognised chips and autocomplete | APP-309, 311 |
| `List-Calm.dc.html` | B, no suggestion strip (not chosen) | APP-311 |
| `Recipe.dc.html` | Recipe to list sheet | APP-312 |
| `Week.dc.html` | The same sheet from the week menu (pattern for APP-293) | APP-312, 293 |
| `Stores.dc.html` | Grocery lists per store | APP-313 |
| `Aisles.dc.html` | Aisle order of a store | APP-313 |
| `Stock.dc.html` | In huis | APP-314 |
| `Shop.dc.html`, `Shop-Dark.dc.html` | Shopping mode | APP-315 |
| `Who.dc.html` (shared part; props `theme`, `size`, `text`), `Who-Dark`, `Who-SE`, `Who-Large` | Shopping mode: who checked an item, approved 21 Nov 2026; data model in [`APP-543-data-model.md`](APP-543-data-model.md) | APP-543 |
| `composer_final/` (shared part `GCompose.dc.html`; `G664-Closed`, `-Typing`, `-Menu`, `-Burst`, `-Dark`), companion [`composer_final.md`](composer_final.md) | Keyboard composer, approved 23 Nov 2026; replaces the composer part of `Composer.dc.html` | APP-664 |
| `canvas.json` | Positions, titles, sticky notes (the brief and rationale) | |
| `Web*.dc.html`, [`web.md`](web.md) | The web version and its companion, approved 19 Nov 2026 (also the APP-300 Module layout) | APP-316, 300 |

The artboards are a visual reference. Build from this companion and the phone's
own tokens and components (`apps/mobile/DESIGN_SYSTEM.md`), not from the
artboards' markup.

## Aisles (APP-309, 310, 313)

Default order (a typical Dutch supermarket), stable ids:

| id | NL | EN |
| --- | --- | --- |
| `produce` | Groente en fruit | Fruit and vegetables |
| `bakery` | Brood en bakkerij | Bread and bakery |
| `dairy` | Zuivel en eieren | Dairy and eggs |
| `cheese_deli` | Kaas en vleeswaren | Cheese and deli |
| `meat_fish` | Vlees en vis | Meat and fish |
| `pasta_world` | Pasta, rijst en wereldkeuken | Pasta, rice and world food |
| `tins_sauces` | Conserven en sauzen | Tins and sauces |
| `breakfast` | Ontbijt en beleg | Breakfast and spreads |
| `snacks` | Koek, snoep en chips | Biscuits, sweets and crisps |
| `frozen` | Diepvries | Frozen |
| `drinks` | Dranken | Drinks |
| `care_baby` | Drogisterij en baby | Toiletries and baby |
| `household` | Huishouden | Household |
| `other` | Overig | Other |

## Recognition (APP-309, 311)

Local, in `@gather/core`, no AI, works offline.

1. **Amount and unit.** A number at the start or end ("2", "1,5", "½") and a
   unit from a fixed list with NL/EN singular and plural forms: stuks, pak,
   fles, pot, zak, tros, bos, blik, g, kg, ml, l, teentje, el, tl. "2 pakken
   melk" → 2 pak + "Melk"; "500g gehakt" → 500 g + "Gehakt"; "melk 2" → 2 +
   "Melk". No number: amount 1 and no unit shown. The rest is the name.
2. **Aisle**, on the normalised name (lower case, singular, no article), in
   order: the Group's own earlier choice for that name
   (`groceryCategoryOverrides`); the Group's history; the bundled NL/EN product
   dictionary (also matching on word parts, so "kipdijfilet" finds "kip");
   the shared AI cache; otherwise `other`. An unknown name is saved in `other`
   at once and moved when the one-off server AI lookup returns (APP-353, which
   also owns the eval set and the accuracy thresholds). Choosing an aisle for an item stores the override for the
   Group.
3. **Chips.** Recognised parts are highlighted inline (`kitchen-wash` behind
   the text, 600) and show as chips under the field: amount (`2 pak`) and aisle
   (`Zuivel en eieren`). Removing the amount chip keeps the text in the name;
   removing the aisle chip opens the aisle menu.

## 1. List (APP-309, 310, 311)

Wash screen, `kitchen-wash`. Back `Alles` / `All`. Glass `…` menu: *Uit recept
of weekmenu* / *From recipe or week menu*, *Schapvolgorde* / *Aisle order*,
*Afgevinkte wissen* / *Clear checked*, *Suggesties uit* / *Turn off
suggestions*. Title `Boodschappen` / `Groceries` (or the list's name), `tile-l`
kitchen tile with cart glyph, summary `{n} items · hele huishouden` /
`{n} items · whole household`, and under it a `surface` pill button with the
store glyph, the list name (`Albert Heijn`) and a chevron, which opens the
Stores sheet.

Top to bottom:

1. **Action row**: `Winkelen` / `Shop` (Kitchen primary pill, fills the
   remaining width, opens shopping mode), `In huis` / `In stock` and `Recent`
   (`surface` pills with glyph).
2. **Misschien nodig / Maybe needed** (direction A): section label plus aside
   `Houd ingedrukt om te verbergen` / `Press and hold to hide`. A horizontally
   scrolling row of 148 pt `surface` cards: `+` in `kitchen-text`, name in
   body-strong, footnote why: `Elke week · 8 dagen geleden` / `Every week · 8
   days ago`. Tap adds with the usual amount and aisle (meta `Uit Misschien
   nodig` / `From Maybe needed`); press and hold hides it for good; the strip is
   hidden when empty or switched off. Rule: bought ≥ 3 times, usual interval
   passed, not on the list, max 8, computed on the server.
3. **Aisle sections** in the list's aisle order, empty aisles hidden. Label =
   aisle name, aside = count. Row: 24 pt check disc (`kitchen-text` ring), name
   (body), meta (footnote, `muted`): why it is there (book glyph + `Pasta pesto ·
   di` for a recipe, `Bijna op · vaste voorraad` / `Running low · staple`,
   `Toegevoegd door Sanne` / `Added by Sanne`, or the item's note), and the
   amount trailing in `ink` 600, tabular (`2 pak`, `250 g`, `3`). Tap the row
   opens the Item sheet. Swipe and hold menu as in Tasks, plus *Verplaatsen naar
   lijst* / *Move to list*.
4. **Last card**: `Uit recept of weekmenu` / `From recipe or week menu` with
   subtitle `Ingrediënten samengevoegd met wat er al staat` / `Ingredients
   merged with what is already on the list` (book glyph in `kitchen-text`).
   With checked items: `Afgevinkt ({n})` / `Checked ({n})` with `Zet terug` /
   `Put back`.
5. **Composer bar**, pinned above the home indicator: `surface` pill,
   placeholder `Item toevoegen, bijv. 2 pak melk` / `Add an item, e.g. 2 milk`,
   trailing Kitchen primary `+` disc. Tapping opens the keyboard composer.

Checking an item: it stays a moment, then moves into `Afgevinkt (n)`. Checked
items feed Recent. A checked staple marks it in stock (APP-314).

## 2. Composer (APP-309, 311)

Keyboard-anchored, as Tasks quick add. Above the field, an autocomplete card
(`surface`, up to 3 rows): history first, then the dictionary. Row: glyph
(history or book), the name with the typed part in 600, footnote why (`Vaak
gekocht · elke 4 dagen · staat al op de lijst (2 pak)` / `Often bought · every 4
days · already on the list (2)`, `Bekend product · Zuivel en eieren` / `Known
product · Dairy and eggs`), trailing amount (`+2 pak` when it will merge). Chips: the
target list (kitchen `tile-xs` + name + chevron, opens Stores when there is more
than one grocery list), amount, aisle. Hint: `Hoeveelheid en afdeling ingevuld
op basis van wat je typt` / `Amount and aisle filled in from what you type`. Adding a name already on the list with a compatible unit adds
up the amounts.

## 3. Item sheet (APP-309, 314)

`NativeSheet`, large detent. `Annuleren` / `Cancel`, title `Item`, `Bewaar` /
`Save` (Kitchen primary). Cards:

1. Name (`title-2`) and note (`subhead`, `muted`).
2. **Hoeveelheid / Amount**: a stepper (−, value in rounded 22/700 tabular, +)
   and unit choices as pills: `stuks, pak, fles, g, kg, ml, l, bos, blik`
   (selected `ink` fill). Number field rules: `docs/standards/number-fields.md`.
3. **Afdeling / Aisle** (native menu of aisles) and **Lijst / List** (native menu
   of grocery lists); **Vaste voorraad / Staple** switch with subtitle
   `Bijhouden bij In huis` / `Track in In stock`.
4. `kitchen-wash` card **Wat jullie meestal doen / What you usually do**:
   `9 keer gekocht, meestal 2 pak, elke 4 dagen` / `Bought 9 times, usually 2,
   every 4 days` and `Laatst za 14 november, door Sanne` / `Last Sat 14
   November, by Sanne`. Hidden for new items.
5. `Item verwijderen` / `Delete item` in `danger`.

## 4. Recent (APP-310)

Wash screen, back `Boodschappen`, clock glyph, summary `{n} items · laatste 2
weken` / `last 2 weeks`, subline `Tik op plus en het staat weer op de lijst` /
`Tap plus to put it back on the list`. Sections per day (`Vandaag · woensdag
18 november`, then `{weekday} {d} {month}`). Row: name, meta `Laatst 2 pak ·
Zuivel en eieren` / `Last 2 · Dairy and eggs`, trailing 44 pt `+` button
(`surface-2` disc) or, when on the list, `✓ Op de lijst` / `On the list` in
`muted`. Footnote: `Recent bewaart de laatste 100 afgevinkte items van dit
huishouden.` / `Recent keeps the last 100 checked items of this household.`

## 5. Recipe to list (APP-312), and the week menu (pattern for APP-293)

From a recipe: *Op de boodschappenlijst* / *Add to groceries*. `NativeSheet`
over the recipe: `Annuleren` / `Cancel`, title `Op de boodschappenlijst` / `Add
to groceries`.

1. Source card: `tile-m` kitchen tile, recipe title, `Recept · voor {n}
   personen` / `Recipe · serves {n}`; **Personen / Servings** stepper (scales
   every amount live; grams and millilitres round to 1 below 50, 5 below 250,
   then 25; kilos, litres and spoons to halves, quarters below one; counts
   round up; fewer servings never ask for more than the recipe wrote; Eric,
   19 Nov 2026, APP-312); **Naar lijst / To list** row (native menu, the last
   used grocery list).
2. **Ingrediënten / Ingredients**: checkbox rows (rounded square, `kitchen-text`
   when on), name, amount trailing. Meta per row:
   - merge: `Staat er al: 10, wordt 16` / `Already on the list: 10, becomes 16`
     (600);
   - in stock (APP-314): starts unticked, `Op voorraad in huis` / `In stock at
     home`; ticked anyway: `Op voorraad in huis, toch erbij` / `In stock, adding
     anyway`;
   - AI-read line: `Gelezen met AI · 1 van je 20 vandaag` / `Read with AI · 1 of
     your 20 today` (over the cap the line is added as plain text, meta `Als
     tekst toegevoegd` / `Added as text`).
3. Kitchen primary button `Zet {n} op de lijst` / `Add {n} to the list` with
   footnote `Samengevoegd met wat er al op staat. De lijst ziet erbij voor welk
   recept het is.` / `Merged with what is already there. The list shows which
   recipe each item is for.`

Added items carry the source (`Shakshuka · di`) as their meta on the list.

**Week menu (APP-293 builds it):** the same sheet, source card `Weekmenu 23 tot
29 november` / `Week menu 23 to 29 November`, `3 maaltijden met boodschappen ·
4 personen`, no servings stepper (servings come per meal from the plan),
ingredients grouped by aisle with the meals per line in the meta (`Shakshuka,
Tacos · er staan er al 3`). Build the sheet and the merge logic
source-agnostic: input = lines with amount, unit, servings and a source label.

## 6. Stores and aisle order (APP-313)

Tapping the store pill opens a `NativeSheet` **Boodschappenlijsten / Grocery
lists**, `Klaar` / `Done`: radio rows (kitchen `tile-s`, name, subtitle such as
`Schapvolgorde aangepast` / `Custom aisle order` or `Standaardvolgorde` /
`Default order`, count, check in `kitchen-text`). Below: `Schapvolgorde van
{list}` / `Aisle order of {list}` (pushes Aisles) and `Nieuwe
boodschappenlijst` / `New grocery list` (the Tasks New list sheet with type
Groceries preselected). Footnote: `Elke lijst heeft zijn eigen schapvolgorde.
Een item verplaatsen houdt hoeveelheid en afdeling.` / `Each list has its own
aisle order. Moving an item keeps its amount and aisle.` The module opens the
last used list.

**Aisles:** bar `Annuleren` / `Cancel`, `Schapvolgorde` / `Aisle order`,
`Bewaar` / `Save`. Section label `{list} · zo loop je door de winkel` /
`{list} · the way you walk the store`. Rows: drag grip, aisle name, item count,
up and down buttons (44 pt, also the VoiceOver path; disabled at the ends).
Footnote: `Sleep een afdeling, of gebruik de pijlen. Afdelingen zonder items
zijn in de lijst verborgen.` / `Drag an aisle, or use the arrows. Aisles
without items are hidden in the list.` Button `Standaardvolgorde herstellen` /
`Restore default order`.

## 7. In huis (APP-314)

Replaces the Pantry Module. Wash screen, back `Boodschappen`, home glyph on the
kitchen tile, title `In huis` / `In stock`, summary `{n} bijna op · {m} vaste
voorraad` / `{n} running low · {m} staples`, subline `Wat jullie altijd in huis
willen hebben` / `What you always want in the house`. Staples grouped by aisle.
Row: name, meta `Staat op {list}` / `On {list}` when low, trailing toggle pill:
`✓ Op voorraad` / `In stock` (`surface-2`, ink) or `⚠ Bijna op` / `Running low`
(Kitchen primary). Setting Running low puts it on the list; checking it off on
the list sets In stock. Last row `Voorraaditem toevoegen` / `Add a staple`.
Footnote: `Vink je een vast voorraaditem af op de lijst, dan staat het hier
weer op voorraad. Recept en weekmenu laten wat op voorraad is uitgevinkt
beginnen.` / `Check off a staple on the list and it is back in stock here.
Recipe and week menu start in-stock items unticked.`

## 8. Shopping mode (APP-315)

Full screen, no editing controls. Bar: `Klaar` / `Done` (glass), title
`Winkelen` / `Shopping`, progress `{done} van {total}` / `{done} of {total}`
(600, tabular). Under it: sun glyph + `{list} · scherm blijft aan tot je klaar
bent` / `{list} · screen stays on until you are done`, and an 8 pt progress bar
(`surface-2` track, `kitchen-text` fill). Aisle sections with 20/700 headings.
Rows 72 pt: 32 pt disc, name 20/600, amount 20/700 tabular; the whole row is
the button, with a haptic tick. **Checked items stay in place** (`muted`,
strike-through), unlike the normal list. Another Member's check appears live
with meta `Sanne vinkte af, net nu` / `Sanne checked this, just now`. Pinned at
the bottom: an undo pill after each tap (`{name} afgevinkt` + `Ongedaan maken`
/ `{name} checked` + `Undo`) and the Kitchen primary `Klaar met winkelen` /
`Done shopping`, which moves checked items to Recent and staples back to in
stock. Leaving, or 30 minutes without a tap, ends the mode and lets the screen
sleep.

### Who checked it (APP-543)

Approved by Eric, 21 November 2026, with its [data model](APP-543-data-model.md).
Canvas page `APP-543 Wie vinkte af`.

- Shopping mode only; the normal list and Recent are unchanged.
- A row checked by another Member shows, under the name, an 18 pt disc with
  their initial (a soft per-person tint) and `{name} vinkte af, {when}` /
  `{name} checked this, {when}`, footnote, `muted`.
- `{when}` from `doneAt`: `net nu` / `just now` (under a minute),
  `{n} min geleden` / `{n} min ago` (under an hour), `om 13:12` / `at 13:12`
  (today), `gisteren` / `yesterday`, else the short weekday. It ticks while the
  screen is open.
- A check that arrives live: the row has `kitchen-wash` and the line is
  semibold for 3 seconds; VoiceOver announces `{name} vinkte {item} af` /
  `{name} checked {item}` (polite). The row's label adds `afgevinkt door
  {name}, {when}` / `checked by {name}, {when}`.
- Your own checks get no line (the undo pill covers them). Reopening an item
  removes the line. While another Member's check stands, the line replaces the
  recipe meta.
- No line when `doneBy` is absent (checked before APP-543) or names somebody
  who is no longer a Member of the Group; the row is just struck through.
- Largest text size: the amount moves under the name and the line wraps.

## States to build and check

Light and dark; iPhone SE and a large phone; NL and EN; largest text size
(amounts stay visible and wrap under the name rather than truncate). Empty
list (composer and suggestions only, plus `Uit recept of weekmenu`); no
suggestions (strip hidden); one grocery list (no list chip menu, store pill
still opens Stores for New grocery list); unknown item (aisle `Overig`, choose
once); offline (typing, checking and recognition work; suggestions and the AI
line show their last state or plain text).

## Open runtime questions

- `expo-keep-awake`: check whether it is already bundled; a new native module
  needs a build (ADR-0029).
- Drag reorder for aisles: check the installed list component; the arrows are
  the required fallback.
- The suggestion strip's press-and-hold needs a context menu or a confirm with
  `Verbergen` / `Hide`; pick the platform pattern from `docs/standards/lists.md`.
