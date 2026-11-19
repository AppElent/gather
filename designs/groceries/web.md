# Groceries on the web — design companion (APP-316, APP-300)

The web version of the approved Groceries study ([README](README.md)): the same
lists, items, recognition, suggestions, Recent, In stock and recipe-to-list
rules, laid out for preparing the week's shopping at a desk.

**Canvas:** https://claude.ai/artifact/Xi57U8STvXDWbUnf8rBrWR, page
`APP-316 Web`.
**Approved:** by Eric, 19 November 2026, "Goedkeuren, ook voor APP-300": the
list-and-detail layout below is also the shared web Module layout for APP-300.

Everything not stated here follows the phone study ([README](README.md)) and
the web standards: `docs/standards/web-design.md` (responsive action controls
at `lg`, breadcrumbs on nested pages), `DESIGN_SYSTEM.md` (shell tokens
`--app-*`, `ConfirmAction`, `useModalFocus`, 16 px fields on phones).
Shopping mode (APP-315) is not on the web.

## Files

| File | Artboard |
| --- | --- |
| `Web.dc.html` | Shared part; props `screen` (list, item, stock, lists, aisles, recipe, empty, loading, error), `theme`, `size` (desktop, phone). Default: list, light, desktop |
| `Web-Dark.dc.html` | List, dark, desktop |
| `Web-Item.dc.html` | Item open in the panel |
| `Web-Stock.dc.html` | In stock tab in the panel |
| `Web-Lists.dc.html` | List switcher menu open |
| `Web-Aisles.dc.html` | Aisle order dialog |
| `Web-Recipe.dc.html` | Recipe page with the Add to groceries dialog |
| `Web-Empty.dc.html` | Empty list, dark |
| `Web-Phone.dc.html`, `Web-Phone-Dark.dc.html` | 375 px list, light and dark |
| `Web-Phone-Item.dc.html` | 375 px item as its own page |
| `Web-Phone-Stock.dc.html` | 375 px In stock as its own page, dark |
| `Web-Phone-Loading.dc.html`, `Web-Phone-Error.dc.html` | 375 px loading and error |

The artboards are a visual reference; colours in them approximate the shell's
`--app-*` oklch tokens. Build with the shell tokens and components, plus the
Kitchen accent (`kitchen-fill` #0B7C75, `kitchen-text` #0B7C75 / dark #6FD6CD,
`kitchen-wash` #DDEFEC / dark #133230) for the Module's primary actions,
selected rows, the active tab and chips.

## Module layout (APP-300)

Inside the existing `AppShell` (sidebar 264 px, topbar, `MobileDock`):

- **At `lg` (1024 px) and up:** a two-column grid, `minmax(0,1fr) 340px`, gap
  20 px. Left: the Module's list. Right: a **detail panel** (`--app-surface`,
  1 px `--app-border`, radius 10 px). The panel has a default content (for
  Groceries: tabs) and shows a record when one is selected, with a close
  button (`Paneel sluiten` / `Close panel`) that returns to the default.
  Selection lives in the URL (`?item=<id>`) so it survives reload and Back.
- **Below `lg`:** one column. The panel content is its own nested route with
  breadcrumbs (`Boodschappen / Melk`), per "nested pages carry their own
  trail". Clicking a row navigates there.
- **Add:** a form at the top of the list (field + Kitchen primary submit), not
  a floating button. Enter submits.
- **Toolbar:** above the add form; a record switcher on the left (here: the
  grocery list), action buttons right, then a `…` menu. Action buttons show
  icon + label at `lg`, icon only below, always with an accessible name.
- **States:** loading = skeleton cards in `--app-surface-muted`
  (`aria-busy`); error = card with `role="alert"`, text and a primary retry;
  empty = dashed card with glyph tile, title, one sentence and the next action.
- Shared components go to `src/components/app/` (APP-300): page grid, detail
  panel (default + record + close), list section card, row, empty, loading,
  error. Groceries is the first full user; APP-300's proof page (loyalty
  cards or tastings) uses the same pieces.

## Groceries page (`/groceries`)

Topbar: title `Boodschappen` / `Groceries`, subtitle `{n} items op {list} ·
hele huishouden` / `{n} items on {list} · whole household`.

### Toolbar

1. **List switcher** button: kitchen `tile-xs` with store glyph, list name,
   chevron. Opens a menu (`role="menu"`) `Boodschappenlijsten` / `Grocery
   lists`: radio items with tile, name, subtitle (`Schapvolgorde aangepast` /
   `Custom aisle order` or `Standaardvolgorde` / `Default order`), open count
   and a check on the current one; then `Schapvolgorde van {list}` / `Aisle
   order of {list}`, `Nieuwe boodschappenlijst` / `New grocery list` (the web
   New list flow, `AddListFlow`, with type Groceries preselected) and the
   footnote `Elke lijst heeft zijn eigen schapvolgorde. Een item verplaatsen
   houdt hoeveelheid en afdeling.` The page opens the last used list.
2. **`Uit recept of weekmenu` / `From recipe or week menu`** (book glyph):
   opens a menu of recipes and the current week menu; choosing one opens the
   recipe dialog below.
3. **Below `lg` only:** `Recent` (clock) and `In huis` / `In stock` (house)
   icon buttons, linking to their nested pages. At `lg` they are the panel tabs.
4. **`…` menu:** `Schapvolgorde` / `Aisle order`, `Afgevinkte wissen` /
   `Clear checked` (through `ConfirmAction`), `Suggesties uit` / `Turn off
   suggestions`.

### Add form

Field `Item toevoegen, bijv. 2 pak melk` / `Add an item, e.g. 2 milk`
(16 px), submit `Toevoegen` / `Add` (label hidden below `lg`). While typing,
the same local recognition as the phone (`@gather/core`) shows a row
`Herkend:` / `Recognised:` with chips: amount (`2 pak`), name, aisle (with a
chevron; it opens the aisle menu and stores the Group override). Hint when
empty: `Hoeveelheid en afdeling worden herkend, zonder AI. Enter voegt toe.` /
`Amount and aisle are recognised, without AI. Enter adds.` Autocomplete from
history and dictionary as on the phone, as a listbox under the field (arrow
keys + Enter). Merging amounts as on the phone.

### Maybe needed (direction A)

Heading `Misschien nodig` / `Maybe needed`, aside `Kruisje verbergt een
suggestie voorgoed` / `The cross hides a suggestion for good`. Cards (200 px at
`lg`, wrapping; 168 px and horizontally scrolling below): a button with `+`,
name and why (`Elke week · 8 dagen geleden`), and a separate cross button
(`{name} niet meer voorstellen` / `Stop suggesting {name}`). The cross is the
web's visible alternative to the phone's press-and-hold. Hidden when empty or
switched off. Server rule unchanged.

### Aisle sections

One card per aisle in the list's aisle order, empty aisles hidden: heading =
aisle name, count right. Row (min 52 px): a real checkbox (`{name} afvinken` /
`Check {name}`, Kitchen accent), then a row button that selects the item
(name 600, meta 12 px muted with book glyph for recipe sources, amount right,
700, tabular), then at `lg` a `…` button: `Bewerken` / `Edit`, `Verplaatsen
naar lijst` / `Move to list`, `Verwijderen` / `Delete`. The selected row has
`kitchen-wash` background. Checking moves the item to `Afgevinkt ({n})` /
`Checked ({n})` (card with `Afgevinkte wissen` and per row `Zet terug` /
`Put back`). Last card: `Uit recept of weekmenu` with subtitle `Ingrediënten
samengevoegd met wat er al staat`.

### Panel (at `lg`)

**Tabs** (`role="tablist"`): `Recent` and `In huis` / `In stock`, the latter
with a badge `{n} bijna op` / `{n} running low` when any. Active tab
`kitchen-wash`.

- **Recent**: intro `Plus zet het terug op de lijst, met de laatste
  hoeveelheid.` / `Plus puts it back on the list with its last amount.`; day
  headings; rows with name, meta `Laatst 2 pak · Zuivel en eieren`, a 36 px `+`
  button (`{name} terug op de lijst`), or `✓ Op de lijst` / `On the list`.
  Footnote as on the phone (last 100 items).
- **In stock**: summary `{n} bijna op · {m} vaste voorraad · wat jullie altijd
  in huis willen hebben`; staples grouped by aisle; toggle pill (`aria-pressed`)
  `✓ Op voorraad` / `In stock` or `⚠ Bijna op` / `Running low` (Kitchen
  primary), meta `Staat op {list}` when low; `Voorraaditem toevoegen` / `Add a
  staple`; footnote as on the phone.
- **Item** (row selected): title = item name, close button, meta `Toegevoegd
  door {name} · {date}`. Fields with labels: `Naam`, `Hoeveelheid` (stepper,
  − / +, tabular), `Eenheid` (select of the fixed unit list), `Afdeling`
  (select; hint `De groep onthoudt je keuze voor {name}.`), `Lijst` (select of
  grocery lists; moving keeps amount and aisle), `Notitie`, switch `Vaste
  voorraad` with `Bijhouden bij In huis`. Footer: `Bewaar` (Kitchen primary),
  `Annuleren`, and `Verwijderen` (danger text, `ConfirmAction`). Unsaved edits
  follow the editors standard (dirty form asks before closing).

Below `lg` these are pages: `/groceries/recent`, `/groceries/in-stock`,
`/groceries/item/$id`, each with breadcrumbs back to `Boodschappen`.

### Aisle order dialog

Modal (`useModalFocus`), max 480 px: `Schapvolgorde` / `Aisle order`,
subtitle `{list} · zo loop je door de winkel`. Ordered list rows: drag grip,
aisle name, item count, `omhoog` / `omlaag` buttons (disabled at the ends;
the keyboard and screen-reader path). Footnote as on the phone. Footer:
`Standaardvolgorde herstellen` / `Restore default order`, `Annuleren`,
`Bewaar`.

### Recipe to list dialog

From a web recipe page, button `Op de boodschappenlijst` / `Add to
groceries` (Kitchen primary, cart glyph) opens a modal, max 520 px: recipe
tile, title `Op de boodschappenlijst`, `{recipe} · recept voor {n} personen`,
close. Then `Personen` stepper and `Naar lijst` select; a fieldset
`Ingrediënten` with checkbox rows, amounts scaling live, and the phone's meta
rules (merge `Staat er al: 10, wordt 16` in 600; in stock starts unticked
`Op voorraad in huis` / ticked `Op voorraad in huis, toch erbij`; AI line
`Gelezen met AI · 1 van je 20 vandaag`). Footer `Annuleren` and `Zet {n} op
de lijst` / `Add {n} to the list`, footnote `Samengevoegd met wat er al op
staat. De lijst ziet erbij voor welk recept het is.` Same rounding rules and
source-agnostic merge as APP-312; the week menu (APP-322) reuses this dialog.

### Copy for states

- Empty: `{list} is leeg` / `{list} is empty`, `Typ hierboven wat je nodig
  hebt, of haal de ingrediënten uit een recept of het weekmenu.`, button `Uit
  recept of weekmenu`.
- Error: `Boodschappen laden lukt niet` / `Groceries could not load`,
  `Controleer je verbinding. Wat je net hebt toegevoegd is niet verloren.`,
  `Opnieuw proberen` / `Try again`.

## States to build and check

Desktop and 375 px; light and dark; NL and EN (long EN aisle names wrap);
200% zoom; keyboard only (menus, tabs, dialogs, row actions); one grocery
list (switcher still opens the menu for New grocery list); no suggestions;
empty, loading, error; another Member's change arriving live while a row is
selected (the panel keeps the record, or shows `Dit item is verwijderd` /
`This item was deleted` with close).

## Open runtime questions

- Drag reorder for aisles: check what the web already has; the arrows are the
  required path.
- Web offline: the web has no offline queue today; the error copy must not
  promise one. Confirm what Convex does with a pending mutation before keeping
  "is niet verloren".
