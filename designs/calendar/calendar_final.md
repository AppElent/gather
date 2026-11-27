# Calendar: repeating, multi-day, subscriptions, reminders, meals and tasks: final (APP-330, 331, 332, 333, 343)

Eric approved this on 27 Nov 2026 ("Goed, bouwen (343 als A)"), together with the data model.

- **Canvas:** https://claude.ai/artifact/DzD5jRyszXzUKo2bFNmCXN, pages `APP-330` to `APP-343`.
- **Source:** [`calendar_final/`](calendar_final/).
  - Phone artboards import `Cal.dc.html`. Its `screen` prop takes `repeat`, `repeatCustom`, `scopeEdit`, `scopeDelete`, `month`, `agenda`, `dates`, `subscribe`, `calendars`, `readonly`, `reminder`, `notifSettings`, `banners`, `overlay`, `overlaySettings` or `overlayB`. It also takes `theme` (light | dark) and `lang` (nl | en).
  - Web artboards import `CalWeb.dc.html`, with `screen` set to `month`, `repeat`, `subscribe`, `event` or `overlay`.
  - `O3-B-Maand` (343 B) was not chosen and stays only for the record.
- **Data model:** [APP-330-343-data-model.md](APP-330-343-data-model.md). It is one schema change, with optional fields only and no backfill.

## APP-330: repeating events

| Artboard | What it shows |
| --- | --- |
| `Main` | A Repeat row in the editor, below Ends. The presets are Never, Every day, Every week, Every month, Every year and Custom…. |
| `R2-Aangepast` | Custom: every N days, weeks, months or years, the weekdays, a month rule (day 15, 2nd Tuesday or last day) and Ends (never, on a date, or after N times). A day that does not exist, such as 31 Feb, is skipped. |
| `R3-Scope` | Saving one occurrence of a series asks: This event only, This and following, or The whole series. A single event asks nothing. |
| `R4-Verwijderen` | Deleting asks the same question. "This event only" cancels that one occurrence. |
| `R5-Web` | The same rows and choices in a dialog on the web. |

A repeating event shows the ↻ mark everywhere.

## APP-331: multi-day and overnight

| Artboard | What it shows |
| --- | --- |
| `M1-Maand` | Month draws a bar across the days. A bar that runs into the next week starts that week as a cut-off bar. |
| `M2-Agenda` | Agenda puts the event on every day, with "Day 2 of 5". A night shift (22:00 to 06:00) shows on both days. |
| `M3-Datums` | The editor has Starts and Ends. With All day on they are dates, otherwise a date and a time. If the end is before the start, Save is off and the row says why. |
| `M4-Web` | Month with bars, on the web. |

Installed phones see only the first day of a multi-day event until their OTA update.

## APP-332: subscribe to an iCal link

| Artboard | What it shows |
| --- | --- |
| `S1-Toevoegen` | Calendars › + › Subscribe to a link. Paste an https:// or webcal:// link and give it a name and colour. Before you save, Gather fetches the feed once and shows what it found ("32 events, 21 Dec to 18 Jul"). |
| `S2-Agendas` | Subscriptions are listed under SUBSCRIPTIONS with "Updated 14:02". A failure shows "Couldn't update · last 09:00" in the danger colour, with Retry. |
| `S3-Afspraak` | An event from a subscription is read-only: no Edit, a strip "From School holidays · read only", and your own reminder. |
| `S4-Web` | Adding a subscription on the web. |

The feed refreshes hourly. The link is shown only as `…/abc123.ics`, and other Members never see it.

## APP-333: reminders and "you were added"

| Artboard | What it shows |
| --- | --- |
| `H1-Herinnering` | A Reminder row in the editor. The choices are None, At the time, 5 min, 15 min (default), 30 min, 1 hour and 1 day. A reminder is for you only, and the footer says so. All-day events have no reminder by default. |
| `H2-Meldingen` | Settings › Notifications: the default reminder (15 min) and the switch "When someone adds you". |
| `H3-Banners` | The two notifications. |
| `H4-Web` | Reminder in the event panel on the web. |

For a repeating event, only the next occurrence is scheduled.

## APP-343: meals and tasks in the calendar (A)

| Artboard | What it shows |
| --- | --- |
| `O1-Agenda` | Under each day's events, a quiet card shows Dinner (fork, kitchen tint) and the tasks due that day, with a ring to tick off. It has no colour stripe and is smaller than an event, so it is never mistaken for one. A tap opens the recipe or task in its own module. |
| `O2-Instellingen` | Calendar settings › Also show: two switches, Meals and Tasks. They are off by default and set per Member (`memberships.calendarOverlays`). |
| `O4-Web` | Month with meals and tasks on the web. Month shows a small fork or ring in the day. |
