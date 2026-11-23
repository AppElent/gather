# Search with filters — final (APP-613)

Approved by Eric on 23 Nov 2026 (decision card, "Beide goed"). Direction F1.

- **Canvas:** https://claude.ai/artifact/LbMN3QsUi4XENzi88dboT9, page `APP-613 Zoeken met filters`.
- **Source:** [`search_final/`](search_final/). Every artboard imports `Shell.dc.html` (props `screen`, `theme`).
- **Mockups from the decision rounds:** project files `gather-search-settings/` (options A–F, filter placement F1 vs F2).

## The decision

One search screen with shared filters. The Search tab opens it on All Modules. The search button in a Module pushes the same screen inside that Module's stack, with that Module preset as a filter. The phone never shows other Modules' results on a Module screen unless the person changes the filter.

Rejected in the rounds: a filter row inside each Module only (A), results from all of Gather on the Module screen (D), filters docked above the bottom search bar (F2). F2 failed because the native search bar cannot host views, a hand-made row that tracks the bar and keyboard is fragile on iOS 26, and results would get about a third of the screen while typing.

## States

| Artboard | `screen` | What it shows |
| --- | --- | --- |
| `S613-1-Zoeken` | `search` | Search tab, query "melk", filter chips Alle modules ▾, Wie ▾, Wanneer ▾. Results grouped per Module with a section header. Tab bar visible, search bar docked above it. |
| `S613-2-InTaken` | `searchModule` | "Zoeken in Taken", pushed from Taken (back button). Chip `Taken ✕` selected, plus Wie, Wanneer and the Module's own filter Status. No group headers. Keyboard up, bar docked above it, no tab bar. |
| `S613-3-Kiezen` | `searchSheet` | The Module sheet "Zoeken in" after tapping the Module chip: Alle modules, Taken (checked), Notities, Recepten, Agenda, Klantkaarten. |
| `S613-4-Donker` | `search` + dark | Search tab in dark tokens. |

Not drawn, keep today's behaviour from `designs/group-search/`: Recents (field empty), loading skeleton, no results, unavailable with Retry.

## Behaviour

- Search bar: keep `Stack.SearchBar` (UISearchController), docked at the bottom on iOS 26. Filters are content at the top of the results, under the large title; they scroll with the results.
- Module chip: tap opens the sheet; ✕ sets All Modules. The query is kept when the filter changes. Back from a pushed search returns to the Module.
- A Module filter adds that Module's own filters after the shared ones (Taken: Status). All Modules shows only Module, Wie, Wanneer.
- Filter chips are 36 pt high inside a 44 pt hit area, selected = ink fill with inverse text, unselected = surface with a hairline border. Each chip has an accessibility label that says the current value and that tapping changes it.
- Results under All Modules are grouped per Module in the existing order; inside a Module there is no group header.
- Replaces the hand-drawn `SearchField` on Notes, Recipes collection, Tasting and Loyalty cards. Pickers inside sheets keep their own field.
- OTA-safe: JS only.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Search tab title | Zoeken | Search |
| Pushed title | Zoeken in {module} | Search in {module} |
| All chip | Alle modules | All Modules |
| Who chip | Wie | Who |
| When chip | Wanneer | When |
| Sheet title | Zoeken in | Search in |
| Module search button label | Zoeken in {module} | Search in {module} |

## Open for the build

- The values behind Wie (Members of the Group, "Ik") and Wanneer (Vandaag, Deze week, Deze maand, Eerder) per Module; which Modules get an own filter beyond Status for Taken.
- Server side: filtering by Module already follows `searchableTypes`; Who and When need fields per record type. APP-348 (Notes server search index) is related.
