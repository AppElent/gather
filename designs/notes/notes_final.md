# Notes: formatting, Recently deleted, photos, lines to lists: final (APP-345, 346, 349, 350)

Eric approved on a decision card on 27 Nov 2026 ("Goed, bouwen (345 als A)"): APP-345 option A (real formatting stored as Markdown), with APP-346, 349 and 350 as drawn.

- **Canvas:** https://claude.ai/artifact/DzD5jRyszXzUKo2bFNmCXN, pages `APP-345` to `APP-350` and `Notities · datamodel`.
- **Source:** [`notes_final/`](notes_final/). Phone artboards import `Note.dc.html` (props `screen`: `edit` | `read` | `plain` | `list` | `deleted` | `deletedAction` | `image` | `drop` | `select` | `picker`, plus `theme` light|dark and `lang` nl|en). Web artboards import `NoteWeb.dc.html` (`screen`: `note` | `deleted`).
- **Data model:** [APP-345-349-data-model.md](APP-345-349-data-model.md).

## APP-345: formatting (option A)

| Artboard | What it shows |
| --- | --- |
| `N1-Opmaak` | Editing with the toolbar above the keyboard: Aa (heading), B, I, bulleted list, numbered list, checklist, link, photo. |
| `N2-Gelezen` | Reading a note: no Markdown characters ever show (EN, dark). |
| `N3-Gewoon` | An old plain-text note opens and saves unchanged. |
| `N4-Web` | Web: the same formatting, toolbar above the note. |

- `body` stores Markdown. Plain text is valid Markdown, so nothing is converted.
- Checklist lines (`- [ ]`) can be ticked while reading, without opening the editor.
- Drop, MCP and search keep reading text (`searchText` strips the Markdown).
- Web gets the same editor.

## APP-346: Recently deleted, 30 days

| Artboard | What it shows |
| --- | --- |
| `D1-Ongedaan` | Delete is immediate, with a bar "… verwijderd · Ongedaan maken"; "Recent verwijderd · 3 notities · 30 dagen bewaard" at the bottom of the list. |
| `D2-Verwijderd` | Recently deleted: each row says who deleted it and how many days remain; under 3 days in the danger colour (EN, dark). |
| `D3-Terugzetten` | ⋯ per row: Restore or Delete for good. "Leeg" top right empties all, with a confirmation. |
| `D4-Web` | Web: the same list with buttons per row. |

The list is shared within the Group: every Member sees it and can restore.

## APP-349: photos in a note

| Artboard | What it shows |
| --- | --- |
| `I1-Foto` | Photo from the toolbar lands at the cursor, full width with a caption; a second still shows "Uploaden…" (the note is already saved). |
| `I2-Drop` | Sharing a photo to Gather: New note, Add to [last opened note], Add to another…; Recipe from photo stays beside them (EN, dark). |
| `I3-Web` | Web: a note with a photo. |

Tapping a photo opens it large; ⋯ › Delete photo.

## APP-350: lines to tasks or groceries

| Artboard | What it shows |
| --- | --- |
| `L1-Kiezen` | ⋯ › Select lines puts a circle before each line; the bar reads "3 regels gekozen · Naar…". |
| `L2-Naar` | Naar… shows the Drop targets: Groceries, your task lists, New task list… (EN, dark). |

After sending: "3 naar Boodschappen · Bekijk". The lines stay in the note, unchanged. No schema change. Web follows with Web: Notes.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Deleted toast | {titel} verwijderd · Ongedaan maken | {title} deleted · Undo |
| Recently deleted row | Recent verwijderd · {n} notities · 30 dagen bewaard | Recently deleted · {n} notes · kept 30 days |
| Days left | Nog {n} dagen | {n} days left |
| Deleted by | Verwijderd door {naam} | Deleted by {name} |
| Row actions | Zet terug / Definitief verwijderen | Restore / Delete for good |
| Empty | Leeg | Empty |
| Uploading | Uploaden… | Uploading… |
| Drop targets | Nieuwe notitie / Toevoegen aan {notitie} / Toevoegen aan een andere… | New note / Add to {note} / Add to another… |
| Select lines | Regels kiezen / {n} regels gekozen · Naar… | Select lines / {n} lines selected · Send to… |
| Sent | {n} naar {lijst} · Bekijk | {n} to {list} · View |
