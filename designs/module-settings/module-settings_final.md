# Settings per Module — final (APP-611)

Approved by Eric on 23 Nov 2026 (decision card, "Beide goed").

- **Canvas:** https://claude.ai/artifact/LbMN3QsUi4XENzi88dboT9, page `APP-611 Instellingen per module`.
- **Source:** [`module-settings_final/`](module-settings_final/). Every artboard imports `Shell.dc.html` (props `screen`, `theme`).

## The decision

Each Module with settings gets a gear in the native header, top right, next to the search button from APP-613. It pushes that Module's settings page, with a back button to the Module. Settings › Modules lists the same pages: two doors, one screen. A Module with nothing to set gets no gear and no empty page. Baby log keeps its current page and gains the gear.

## States

| Artboard | `screen` | What it shows |
| --- | --- | --- |
| `M611-1-Taken` | `moduleRoot` | Taken root: back, then search and gear as `HeaderIconButton`s in `headerRight` (same glass buttons as Home), large title "Taken", list. |
| `M611-2-Instellingen` | `moduleSettings` | "Taken-instellingen": grouped inset list (Lijsten, Weergave, Herinneringen) with value rows and switches, footer copy under the last group. |
| `M611-3-Tab` | `settingsTab` | Settings tab › Modules group lists each Module page, footer "Dezelfde pagina’s als het tandwiel rechtsboven in elke module." |
| `M611-4-Donker` | `moduleSettings` + dark | The settings page in dark tokens. |

The rows on the Taken page are an example. The build starts with an inventory of the options each Module has today (sheets, menus, Baby log's page) and moves those that are settings, not actions, onto the Module's page.

## Behaviour

- Header buttons: 44 pt, `HeaderIconButton`, order search then gear. Labels "Zoeken in {module}" and "Instellingen van {module}".
- The settings page uses the native large title (`washScreenOptions`, as on Home and Settings since APP-610) and the Settings tab's grouped list rows.
- Route per Module under its own stack (`/all/<module>/settings`), so back returns to the Module; Settings › Modules pushes the same screen component from the Settings stack.
- Footer copy says which settings are personal (this phone) and which are shared with the Group, where a page mixes them.
- OTA-safe unless a setting needs a schema field; such a setting is filed separately with a data model.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Page title | {Module}-instellingen | {Module} settings |
| Gear label | Instellingen van {module} | {Module} settings |
| Settings tab footer | Dezelfde pagina’s als het tandwiel rechtsboven in elke module. | The same pages as the gear at the top right of each Module. |
