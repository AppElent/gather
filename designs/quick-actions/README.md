# Quick actions sheet — design study (APP-206)

The phone's Add-tab sheet becomes **Snel** (quick actions): it still adds
things, and it now also *shows* what you need fast, starting with loyalty cards.

**Canvas:** https://claude.ai/artifact/LbMN3QsUi4XENzi88dboT9 (page "APP-206 Snelle acties").
**Approved:** direction A, by Eric on a decision card, 17 November 2026. B was the
alternative and was not chosen; it stays here as the round's record.

Linear: [APP-206](https://linear.app/appelent/issue/APP-206) (this sheet, JS
only), [APP-207](https://linear.app/appelent/issue/APP-207) (iOS entry points
that open it; native build).

## Files

| File | Artboard |
| --- | --- |
| `Main.dc.html` | A, light, with cards. Its `theme`, `cardsState` and `size` props drive the other A boards |
| `A-Dark.dc.html` | A, dark |
| `A-Empty-SE.dc.html` | A, no loyalty cards yet, iPhone SE (375×667) |
| `B-List.dc.html` | B, all rows (not chosen) |
| `canvas.json` | Positions, titles, sticky note |

The artboards are a visual reference. Build from this companion and the phone's
own tokens and components, not from the artboards' markup.

## Structure (A)

The sheet stays the shared `NativeSheet` (`apps/mobile/src/components/NativeSheet.tsx`).
Top to bottom:

1. **Heading.** Title `Snel · {group}` / `Quick · {group}`; subtitle
   `Tonen wat je nodig hebt, of iets toevoegen` / `Show what you need, or add
   something`. After a save, the subtitle keeps today's behaviour
   (`Toegevoegd: {items}`). Close button as today.
2. **Loyalty cards section** (`KLANTKAARTEN` / `LOYALTY CARDS`, section label
   in `footnoteStrong`, `muted`, the native section-header style).
   - A horizontally scrolling row of cards, gap `SPACE[3]`, gutter `SPACE[4]`.
   - Each card: 150 × 95 (credit-card ratio), `radius` 14, the store's brand
     colour (`color`, else `DEFAULT_STORE_COLOR`), the store's logo or
     monogram (reuse `StoreTile`'s logo/monogram logic; text colour from
     `textOnBrand`), a decorative barcode hint. Under the card: store name
     (`subhead` 600, `ink`) and last used (`footnote`, `muted`, same wording
     as the list screen).
   - Order: the list's, as Convex sends it (last used first until the Group
     arranges its cards, then that arrangement, APP-440); never re-sorted here.
     Show all the Group's cards; the row scrolls.
   - Trailing header link `Alle kaarten` / `All cards` opens the loyalty-cards
     list. Min 44 pt hit area.
   - Tap a card: close the sheet and open that card's screen (barcode, full
     brightness), the same route the list uses.
   - Offline: cards come from the offline copy (`features/loyalty-cards/offline/`)
     when the server is unreachable, exactly as the list screen does. No
     spinner blocks the Add section.
   - Accessibility label per card: `{store}, kaart tonen` / `{store}, show card`.
3. **Empty state** (no cards in the Group): one `surface` card, `radius-card`,
   with a `tile-m` loyalty-cards tile, `Nog geen klantkaarten` (body 600) and
   `Scan er een, dan staat hij hier klaar voor de kassa.` (`footnote`, `muted`),
   and a pill button `Scannen` / `Scan` (ink fill, `onInk` label) that opens the
   scanner (`/all/loyalty-cards/new`). EN: `No loyalty cards yet` / `Scan one and
   it waits here for the till.`
4. **Add section** (`TOEVOEGEN` / `ADD`): a 3-column grid of tiles, gap
   `SPACE[3]`. Each tile: `surface`, `radius-card`, min height 96, padding 12,
   the Module's `tile-m` glyph tile in its group tint (top), label (`subhead`
   600, `ink`) and Module name (`footnote`, `muted`). The tiles are the
   existing `QUICK_ACTIONS`, in their existing order; the grid adds nothing new.
   Short grid labels: `Taak`, `Recept importeren`, `Kaart scannen`,
   `Kaas proeven`, `Wijn proeven`, `Bier proeven` (EN: `Task`, `Import recipe`,
   `Scan card`, `Cheese tasting`, `Wine tasting`, `Beer tasting`). The
   accessibility label stays the long one from today's copy.
   - `row` kind (task): tapping the tile expands `QuickAddTask` full width
     *under the grid*, and the tapped tile shows a selected state; tapping it
     again collapses.
   - `handoff` and `compose` kinds behave exactly as today.
   - Labels wrap to two lines; at accessibility text sizes the grid drops to 2
     columns.

The `kinds` caption (`in de rij`, `opent een formulier`) is dropped from the
tiles; the Module name takes its place.

## Detents and sizes

Opens at the height that fits its content; on an iPhone SE the sheet is nearly
full height and the content scrolls. Light and dark use the phone's tokens only.

## Deep link

`<scheme>://quick` (`gather`, `gather-preview`, `gather-dev`) opens the app
(signed in) on Home with this sheet open. Signed out, it goes through sign-in
and then opens the sheet. This is the target for APP-207's icon actions and
iOS control.

## Open questions for runtime

- The barcode hint on the card is decorative; drop it if it reads as a real
  scannable code on device.
- Whether the native sheet's medium detent shows both sections on a standard
  iPhone without scrolling; if not, open at the large detent.
