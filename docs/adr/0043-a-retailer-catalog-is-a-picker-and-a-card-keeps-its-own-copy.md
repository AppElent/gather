---
type: decision
description: Read before changing the Retailer catalog, how a Loyalty card copies from it, or adding a card field the Catalog would prefill.
version: 1.0.0
status: accepted
date: 2026-11-14
---

# A Retailer catalog is a picker, and a card keeps its own copy

The Loyalty cards Module (APP-140, APP-141) needs somewhere for "Albert Heijn"
to come from: its colour, its domain, and which barcode its card prints. Gather
already has the shape for that, the Tasting catalog
([ADR-0024](0024-a-tasting-catalog-is-a-picker-and-tasting-it-makes-it-yours.md)),
and this follows it with one difference.

**The Retailer catalog is a picker. Choosing a retailer creates the Group's own
`loyaltyCards` row with the retailer's name, brand colour, domain and barcode
format copied onto it, and nothing reads the Catalog row for that card again.**
The retailer's `seedKey` is kept on the card as `catalogKey`, which is
Provenance: allowed to dangle when a retailer is retired.

## The difference: no one-card-per-retailer rule

A Tasting subject is materialised once per `(groupId, kind, catalogKey)`:
tasting Gouda a second time finds your Gouda. A Loyalty card is not. A
household routinely holds two Bonuskaarten, one per adult, and both are
"Albert Heijn". So `create` never looks for an existing card with the same
`catalogKey`; each card is told apart by its number and its holder.

## What the card copies, and who decides it

- **Brand colour and domain come from the Catalog row, never the client.**
  `create` reads the row by `seedKey` and refuses an unknown key
  (`loyalty:unknownRetailer`). A custom ("Other store") card carries a colour
  the person picked and no domain.
- **Name and barcode format come from the form.** The form prefills both from
  the row and lets the person correct either, because a Catalog format can be a
  guess: when no public source says what a retailer's card prints, the entry is
  `CODE_128` with `formatConfidence: 'guess'`. CODE_128 encodes anything a till
  prints, so a wrong guess still scans at most tills, and the form says it was a
  guess.
- **The card number is never in the Catalog.** An entry may carry a length and
  a prefix as hints for the form; neither is enforced, since retailers reissue
  cards in new ranges.

## What we are paying

The same as ADR-0024: a corrected colour or format reaches only cards added
after the fix. Accepted for the same reason; a deploy should not change what a
person's card scans as at the till.

## Where the catalog lives

In Convex (`retailerCatalog`), seeded by `seed:seedRetailerCatalog` and
reconciled by `seedKey` under
[ADR-0004](0004-catalog-entries-are-read-only-and-the-seed-always-wins.md),
uncached, for the reasons ADR-0024 gives. The fixtures are one file,
`convex/lib/seed/retailerCatalog.ts`, with a source comment on every entry, so a
reviewer can check a colour or a format against where it came from. It is not
Group content: it is excluded from the data export as reference data and never
touched by Group deletion.
