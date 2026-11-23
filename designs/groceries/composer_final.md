# Grocery keyboard composer — final (APP-664)

Adding groceries on the phone with the shared keyboard composer, tuned to
adding several items in a row.

**Canvas:** https://claude.ai/artifact/Xi57U8STvXDWbUnf8rBrWR#page-app-664
(page APP-664; rounds stay there).
**Approved:** by Eric, 23 November 2026, 15:37Z.
**Final source:** `composer_final/`. `GCompose.dc.html` is the shared part; the
`G664-*` files are the approved artboards (Closed, Typing, Menu, Burst, Dark).
Build from this file, the phone's tokens and components, not from their markup.

Builds on [the Tasks keyboard composer](../tasks/quick-add_final.md): shell,
drafts, chips and + menu are the same.

## Decisions

- The **bottom bar** stays the entry point. There is no floating add button.
- **No expand**: the card has one size. Swiping it down closes it and keeps the
  draft.
- **Return** or the send button adds and keeps the composer open, empty and
  focused.
- **Shopping mode** has no composer.

## Bar

Pinned to the bottom of a writable grocery list: `ground`, `hair` top border,
a 48 pt `surface` pill with the `muted` words and a 36 pt `kitchen-fill` disc
with a plus. Hidden while the composer is open, in Reorder mode, and on a
linked list. The list's bottom padding and the undo toast clear it. The list
has no keyboard inset, so it does not move when the composer opens.

## Card

Top to bottom: handle, title, note (once picked), chip row with send, status
line. Completions are a card of their own above it: history and dictionary
(APP-311), 52 pt rows with the name, its source and aisle, and the amount.

| Part | Behaviour | Binding |
| --- | --- | --- |
| Title | reads its amount locally; the amount is highlighted in `kitchen-wash` | `groceryAddFields`, `QuickAddInput` |
| List | current store; a menu when there is more than one writable grocery list | `groceryListsOf`, `quickAddTarget` |
| Hoeveelheid | typed or tapped amount; menu 1–6, Eenheid, Weghalen | `withAmount`; `quantity`, `unit` |
| Afdeling | the list's own aisle for the name, or the chosen one; menu of aisles, Weghalen | `useTypedAisle`; `aisle` |
| Vaste voorraad | chip once picked; a tap takes it off | `groceryStaples.add` |
| + | Hoeveelheid, Afdeling, Notitie, Vaste voorraad, Alle details | SF Symbols `number`, `tablecells`, `text.alignleft`, `house`, `arrow.up.forward.square` |
| Status | what this opening added, with Ongedaan maken for the last of it | `addedSummary` |

Rules:

- A tapped amount takes the typed one out of the line; an amount typed later
  replaces the tapped one.
- Any tapped aisle is a choice, the one shown too. It goes with its name only.
  Untouched, the server decides.
- The target list stays for the next item; every other detail clears.
- One save key per item (`tasks.add`'s `idempotencyKey`), retries included.
- A failed save asks Opnieuw / Weggooien and sends the same item under the same
  key. It is never put back over what is being typed.
- If only the aisle, note or staple fails, the item stands and the rest is
  offered again.
- Undo goes one item back at a time. It removes a staple only when that save
  made it, and an open item's amount only when nobody changed it since.
  After a list switch it reads the list the item is on; not loaded yet, it says
  the undo failed and stays.
- An amount added to an open item counts from what it is when the save is sent,
  so quick picks add up. The open item keeps its aisle.
- Alle details saves the item first, then opens its screen.

## States

Closed; open and empty (send disabled); typing with chips and completions;
+ menu; amount and aisle menus; note shown; staple set; after one and after
several items; undone; undo failed; save failed (alert); details failed
(alert); closed with a draft and reopened; no writable grocery list; offline
(the save fails visibly). Light and dark, NL and EN, largest text size (chips
grow and the row scrolls; the title wraps; the completions scroll).

## Copy

| Key (`composer.grocery.*`) | NL | EN |
| --- | --- | --- |
| bar | Item toevoegen, bijv. 2 pak melk | Add an item, e.g. 2 milk |
| barLabel | Item toevoegen | Add an item |
| title | Item, bijv. 2 pak melk | Item, e.g. 2 milk |
| titleLabel | Item toevoegen aan {list} | Add an item to {list} |
| note | Notitie | Note |
| notePlaceholder | Notitie, bijv. de grote | Note, e.g. the large one |
| staple | Vaste voorraad | Staple |
| unit | Eenheid | Unit |
| send | Toevoegen | Add |
| added | {name} toegevoegd | {name} added |
| addedMany | {count} toegevoegd: {names} | {count} added: {names} |
| merged | {name} bijgewerkt: {amount} | {name} updated: {amount} |
| already | {name} staat al op de lijst | {name} is already on the list |
| undo | Ongedaan maken | Undo |
| undoFailed | Ongedaan maken is niet gelukt. Probeer het opnieuw. | Undo did not work. Try again. |
| detailsFailed | Het item is toegevoegd, maar niet al zijn details. | The item was added, but not all of its details. |
| `composer.closeKeeping` | Sluiten, concept blijft bewaard | Close, the draft is kept |

Reused: `composer.notAdded`, `tryAgain`, `discard`, `remove`, `allDetails`;
`tasks.grocery.amount`, `aisle`, `aisles`, `units`; `tasks.quickAdd.listChip`,
`noList`.

## Deviations from the artboards

- **A completion adds at once**, as it did before (APP-311, APP-427). The mock
  fills the title instead.
- **Chip and submenu order**: iOS draws a menu that opens upward from the
  bottom, so the + menu's first item sits nearest the +.
- The artboards show no interaction for the amount and aisle chips. They open
  native menus, so the keyboard stays up. Any amount not in the menu is typed.

## Installed versions and build notes

- `@expo/ui` `MenuView` (SDK 58); no new dependency, no schema change.
- Shell `apps/mobile/src/ui/keyboard-composer.tsx`: `expandable`, `above`,
  `status`, `saveLabel`. Screen part `modules/tasks/GroceryComposer.tsx`; rules
  in `groceryDraft.ts`.
- Drafts live in memory per list, not across a kill.

## Open runtime questions

- A finger's swipe on a physical iPhone (checked on the simulator only).
- Whether the aisle chip should scroll into view when the line is recognised:
  with a long list name it starts partly under the send button.
