# Calendar root and settings page: final (APP-627)

Eric approved option A on a decision card on 23 Nov 2026 ("A: native balk, tandwiel, ⋯ weg"). This is the Calendar follow-up to [Settings per Module](../module-settings/module-settings_final.md) (APP-611).

- **Canvas:** https://claude.ai/artifact/LbMN3QsUi4XENzi88dboT9, page `APP-627 Agenda-instellingen`.
- **Source:** [`calendar-settings_final/`](calendar-settings_final/). Every artboard imports `Cal.dc.html` (props `screen`: `now` | `A` | `B` | `C` | `settings`, and `theme`). `B` and `C` are the options that were not chosen. They stay in the part for the record and have no final artboard.

## The decision

The Calendar root stops hiding the native header (`CalendarScreen.tsx`: `headerShown: false`) and draws the same bar as every other Module root: back, then search and gear as `HeaderIconButton`s in `headerRight`. Everything the toolbar's ⋯ menu did now has another home, so the ⋯ menu is removed.

| Today (⋯ menu or toolbar) | After |
| --- | --- |
| Vandaag (toolbar, left) | "Vandaag" button in a row under the native bar |
| Month title (toolbar) | Native inline title, e.g. "November 2026", updated as the visible date moves |
| Search (toolbar) | `headerRight`, first |
| Add event (⋯) | The floating + that already opens the composer |
| Maand / Week + agenda / Agenda (⋯) | Segmented control "Maand · Week · Agenda" in the row under the bar |
| Agenda's… (⋯) | Settings page, section Agenda's |
| Personen… (⋯) | Settings page, section Personen |
| (none) | Gear in `headerRight`, second |

The week/month strip, its drag handle, paging arrows and gestures stay as they are under the new row. "Filters actief" stays under the strip when a calendar is hidden.

## States

| Artboard | `screen` | What it shows |
| --- | --- | --- |
| `K627-0-Nu` | `now` | Today's own toolbar, for comparison. |
| `K627-1-A` | `A` | Root: native bar (back, "November 2026", search, gear); row with Vandaag and the view switch; week strip; agenda; floating +. |
| `K627-2-Instellingen` | `settings` | "Agenda-instellingen": large title, three grouped sections. |
| `K627-3-Donker` | `settings` + dark | The same page in dark tokens. |

## Settings page

Route per the APP-611 pattern: `all/calendar/settings` (from the gear) and `settings/calendar` (from Settings › Modules), one component. Add `'calendar'` to `MODULE_SETTINGS_PAGES` so Settings › Modules lists it.

| Section | Row | Control | Stored |
| --- | --- | --- | --- |
| Weergave | Opent in | Value row › picker: Maand, Week + agenda, Agenda | the remembered view on `memberships` (unchanged: picking a view on the root still updates it) |
| | footer | "De weergave die je in de agenda kiest, onthoudt hij ook." | |
| Agenda's | one row per calendar | Colour dot + name + switch (on = shown) | hidden calendar ids on `memberships` |
| | Agenda's beheren… | Action row, opens `CalendarManagementSheet` | |
| Personen | Afspraken van | Value row › "Iedereen" or the chosen people (today's `CalendarFilters` people sheet) | people filter on `memberships` |
| | footer | "Deze keuzes gelden alleen voor jou, in {groep}. Agenda's en afspraken deel je met je groep." | |

**Scope.** These settings are personal per Group (on the member's `memberships` row): neither the Group's settings nor this phone's. `MODULE_SETTINGS_SCOPE` gains a third value, `member`. Settings › Modules names the Group beside a `member` page, as it does for a `group` page.

No schema change: every value already exists on `memberships`. OTA-safe.

## Behaviour

- Header buttons: 44 pt `HeaderIconButton`, search then gear. Labels "Zoeken in Agenda" and "Instellingen van Agenda".
- The view switch is a native segmented control (three segments, 36 pt). The selected segment follows the presentation, including after the strip is dragged between Week and Month.
- The inline title is the month of the visible date (`headingCase(displayDate(…, { month: 'long', year: 'numeric' }))`, as today). Tapping it does nothing. "Vandaag" jumps to today.
- The settings page uses the native large title, like the other Module settings pages.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Page title | Agenda-instellingen | Calendar settings |
| Section | Weergave / Agenda’s / Personen | View / Calendars / People |
| Opent in | Opent in | Opens in |
| Views | Maand · Week · Agenda | Month · Week · Agenda |
| Manage | Agenda’s beheren… | Manage calendars… |
| Afspraken van | Afspraken van | Events from |
| Everyone | Iedereen | Everyone |
| View footer | De weergave die je in de agenda kiest, onthoudt hij ook. | The view you pick in the calendar is remembered too. |
| Scope footer | Deze keuzes gelden alleen voor jou, in {groep}. Agenda’s en afspraken deel je met je groep. | These choices are only for you, in {group}. Calendars and events are shared with your group. |
