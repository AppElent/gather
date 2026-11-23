# Gather web in the app's look — final

Approved by Eric on 23 Nov 2026 (decision card, "Goed, zo uitwerken").

- **Issues:** APP-636 (parent), APP-637 tokens, APP-638 shell, APP-639 Module page, APP-640 Start.
- **Canvas:** https://claude.ai/artifact/QMNRpfdSrcGN3DXiHxKz8m. Page `Nu` holds the comparison with the iOS app (main 985d171, Sample household); page `Voorstel` holds the approved boards.
- **Source:** [`web-shell_final/`](web-shell_final/). Every artboard imports `Web.dc.html` (props `screen` start|taken|lijst|recepten|nieuw, `theme` light|dark, `size` desktop|phone).
- **Design system:** the [Gather Design System](https://claude.ai/artifact/Rwyfbq38b6YcreQMScCZgy). Its tokens are the phone's (`apps/mobile/src/theme/palette.ts`, `@gather/core` module tints); the web now uses the same values.

## Why

The web wore two older looks at once: the `--app-*` shell (grey-blue, a blue accent, 8 px corners) and the sea/lagoon palette (Fraunces display, gradients, teal borders). It matched neither itself nor the phone. The phone's "Tiles & Today" look is the product's look; the web takes it over and keeps what a browser does better (hover, keyboard, a sidebar, list-and-detail).

## What the web takes from the phone

| Area | Decision |
| --- | --- |
| Tokens | `ground`, `surface`, `surface-2`, `ink`, `muted`, `hair`, `danger`, `on-ink` and the four group tints (`fill`, `on`, `text`, `wash`) per theme, as CSS custom properties generated from the same source the phone reads. The `--sea-*`, `--lagoon*`, `--palm`, `--sand`, `--foam`, hero gradients, the grid backdrop, Fraunces and the blue `--app-accent` go. Light, dark and the stored appearance choice behave as today. |
| Type | Titles and numerals: `ui-rounded, "SF Pro Rounded", Nunito, system-ui` 700 (large title 34/41, title-2 22/28). Text: the system stack; body 16 px on the web (17 on the phone), subhead 15, footnote 13. Tabular figures for counts and times. |
| Shape | Inset lists and cards 22 px radius, tiles on the 20/28/36/56 scale with their radii, pills for buttons and chips. Rows at least 52 px. Hairlines 0.5 px `hair`, inset to the text. No shadows on content. |
| Colour rule | Group colour only on tiles, a Module's primary button and its wash header; never on rows, selection or navigation. Selection is `surface` (sidebar) or `surface-2` (rows). Check rings use the group's `text`. |

## Shell (`D-*` boards)

- **Sidebar (248 px, on `ground`):** Group switcher (ink squircle initial, Group name, member count, chevron); a search field "Zoeken in Gather ⌘K" that opens the command palette; Start and Toevoegen; label "Vastgezet" with the pinned Modules, each with its `tile-s` in its group colour and an open count where the Module has one; Alle modules; at the bottom Instellingen and the account button.
- **No topbar.** Feedback, Report a problem, language and sign out move into the account menu at the bottom of the sidebar. The page title is drawn once, by the page.
- **Toevoegen** opens a menu of create actions for the Current Group's pinned Modules (new task, new recipe, …), each going to that Module's existing create flow. It is the web's counterpart of the phone's Add tab.

## Module page

- **Wash header:** a 22 px card in the group's `wash`: `tile-l`, the large title, and the summary line (count in `ink` 700, scope in `muted`). On a nested page a small parent link sits above the title (it replaces the breadcrumb line; breadcrumbs stay for deeper trails). Right side: search in this Module (44 px round `surface` button, label "Zoeken in {module}", APP-613), the gear for Module settings (label "Instellingen van {module}", APP-611; only when the Module has settings), then the primary action as a pill in the group `fill`.
- **Lists:** section label (footnote 600, `muted`, sentence case), then an inset list. A row: leading tile, ring or thumbnail; title; one footnote line; trailing count, coin or chevron. Row actions live in a `⋯` menu button that appears on hover and keyboard focus (always visible on touch), replacing the always-visible up/down, edit and delete icons. Reordering is a mode from the header's menu, as on the phone. Dates in words ("vr 5 dec", "Te laat · vr 20 nov" in `danger` 600).
- **Completed:** a collapsed "Afgerond (n)" row under the list.
- **List and detail (≥ 1024 px):** the APP-316/APP-300 layout (list, 340 px panel, selection in the URL) with the panel as a 22 px `surface` card: ring and title, a grouped field list on `ground`, notes, then the primary action and a text-style destructive action.
- **Add:** a single field at the top of a list ("Taak toevoegen, bijv. ‘Bel de loodgieter vrijdag’", Enter adds) with the group-fill plus disc. Details go through the dialog below, not an inline form.
- **Dialogs:** centred, 480 px, 22 px radius, on a scrim. Below 1024 px the same content is a bottom sheet (top corners 22 px, grabber). A new task: one field, chips for list (with its `tile-xs`), Wanneer, Wie, Herhalen, then "Meer details", Annuleren and the group-fill primary.
- **Records without a photo** show their group tile, never a placeholder picture (recipes today show a bowl).
- **Empty states:** the phone's three kinds (nothing yet with one add button in the group fill; nothing found with a way to clear; nothing here for you, no action).

## Start (`D-Start`, `P-Start`)

Header: the Group's name as the large title and "date · n leden". Left: the Now card (only when something is due or overdue: group `wash`, `tile-m`, a numeral-xl count, a group-fill button) and the Today rail (past items muted, the "Nu" ink capsule, upcoming items in ink 600). Right: Vastgezet as photo-less pinned cards in group fill, and recent activity as a compact inset list.

## Phone width (`P-*` boards, below 768 px)

- The page is the phone's: round header buttons, the large title, the Module's wash running from the top with `tile-l` and the summary.
- The bottom bar is the phone's five destinations ([ADR-0018](../../docs/adr/0018-mobile-tabs-are-app-destinations-and-one-of-them-is-a-verb.md)): Start, Toevoegen, Instellingen, Alles, and Zoeken as a separate round button. It replaces the dock of pinned Modules. The web draws this bar itself (no Liquid Glass in a browser): `surface` at 78 % with a blur and a soft shadow, the current tab on the neutral selected pill, never a group colour.

## Out of scope here

- Groceries, Meal planner, Notes, Calendar and Shared costs on the web: their own issues (APP-316, APP-322, APP-351, APP-344, APP-329) build them in this look on the APP-300 layout.
- Tasks parity on the web (APP-308): the `Taken` and `Lijst` boards are its starting point for look and layout; its feature design stays with that issue.
- Content search on the web: the palette keeps navigating until the web gets the APP-613 search screen.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Sidebar search | Zoeken in Gather | Search Gather |
| Pinned label | Vastgezet | Pinned |
| All Modules | Alle modules | All modules |
| Add menu / tab | Toevoegen | Add |
| Completed row | Afgerond ({n}) | Completed ({n}) |
| Add task field | Taak toevoegen, bijv. ‘Bel de loodgieter vrijdag’ | Add a task, e.g. ‘Call the plumber Friday’ |
| Row actions | Acties voor {item} | Actions for {item} |
| Close panel | Paneel sluiten | Close panel |
| Overdue | Te laat · {date} | Overdue · {date} |
| Now capsule | Nu · {time} | Now · {time} |

Existing keys in `@gather/core` win where they already say the same thing.
