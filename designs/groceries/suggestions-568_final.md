# Groceries suggestions: hidden names and open points: final (APP-568, 569)

Eric approved this on a decision card on 27 Nov 2026 ("A en A, bouwen"). He chose:
- Shopping mode A: no suggestion strip.
- Another store's list A: a name that is already open there is not suggested.

These follow up on [APP-311](README.md) direction A.

- **Canvas:** https://claude.ai/artifact/Xi57U8STvXDWbUnf8rBrWR, page `APP-568/569 Suggesties: open punten`.
- **Source:** [`suggestions-568_final/`](suggestions-568_final/). Every artboard imports `G568.dc.html`. Its `screen` prop takes `menu`, `hidden`, `shopA`, `shopB`, `storeA`, `storeB` or `meta`, plus `theme` and `lang`. `shopB` and `storeB` are the options that were not chosen and stay only for the record.

## Decisions

| Item | Decision | Artboards |
| --- | --- | --- |
| Hidden suggestions list | The list's native ⋯ menu gets a row "Verborgen suggesties" with the count ("3 namen"). It opens a sheet for this list only: one row per name with a "Weer tonen" button, and "Alles weer tonen". This needs no schema change: it reads and writes `taskLists.hiddenSuggestions`, which holds names only. The canvas also shows who hid a name and when, but that is not stored, so the build shows only the name. | `G568-Menu`, `G568-Hidden` |
| Strip in Shopping mode | No strip. Shopping mode keeps README §8: no editing controls. | `G568-ShopA` |
| Keyboard-anchored composer and completions | Not designed again. The APP-664 keyboard composer (approved 23 Nov) covers it. | (APP-664 page) |
| Name open on another store's list | Not suggested on store B while it is open on store A's list. The strip's aside says why, for example "Melk staat al op Albert Heijn". | `G568-StoreA` |

## APP-569: "From Maybe needed" meta

Artboard `G569-Meta`:
- An item added from the strip shows the meta line "Uit Misschien nodig" with a small spark icon.
- When another Member added it, their name follows: "Uit Misschien nodig · Sanne".
- The line stays after edits: it says where the item came from.

### Data model

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `tasks.addedVia` (new) | `v.optional(v.literal('suggestion'))` | no | Set when the item is added from Maybe needed. The union can grow later, but not now. |

Existing data:
- Nothing is rewritten and there is no backfill.
- Old items have no `addedVia` and show no line.
- Export includes the field.
- OTA-safe: installed phones ignore it.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Menu row | Verborgen suggesties · {n} namen | Hidden suggestions · {n} names |
| Sheet title | Verborgen suggesties | Hidden suggestions |
| Sheet intro | Deze namen stelt Gather niet meer voor op de lijst {lijst}. | Gather no longer suggests these names on the {list} list. |
| Buttons | Weer tonen / Alles weer tonen | Show again / Show all again |
| Footer | Alleen voor deze lijst. Verbergen doe je door een suggestie ingedrukt te houden. | For this list only. To hide one, press and hold a suggestion. |
| Other store aside | {naam} staat al op {winkel} | {name} is already on {store} |
| Meta | Uit Misschien nodig | From Maybe needed |
