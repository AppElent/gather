# Open Food Facts name-search fallback — design

## Context

`FoodAddTab` (nutrition diary "add food" flow) currently supports two ways to
attach a food to a diary entry:

1. **Barcode scan** → `foodsLookup.lookupBarcode` action fetches the product
   from Open Food Facts (OFF) by barcode (`convex/lib/offFetch.ts` +
   `convex/lib/offMapping.ts`), the client immediately upserts it into the
   local `foods` table (`foods.upsertFromOff`) and moves to quantity entry.
2. **Local text search** → the `term` input queries `foods.search`, which
   only searches rows already saved in the user's own `foods` table (a
   Convex search index on `name`). It has no visibility into OFF's global
   product database.

There is currently no way to find an OFF product by name — only by scanning
its barcode. This design adds that: an automatic OFF name-search fallback
that kicks in when local search comes up empty.

## Decisions made during brainstorming

- **Scope: name-search only.** Category browsing (OFF's category taxonomy is
  large and hierarchical) is out of scope for this pass — defer until name
  search proves insufficient on its own.
- **OFF write-back: rejected, not deferred.** OFF's write API requires
  either a shared "gather" bot account (edits attributed to gather, not the
  real contributor, with no moderation layer between a household user and a
  public database) or each user supplying their own OFF credentials for
  gather to store/transmit — the latter conflicts with this repo's rule
  against handling credentials in plain text. The benefit (helping OFF's
  public data quality) doesn't serve gather's actual use case (personal
  household nutrition tracking). Not building this; revisit only if the
  calculus changes.
- **UX placement: fallback after local search**, not a federated combined
  list and not a separate explicit "search mode" — keeps the fast local
  path unchanged and only reaches out to OFF when local search can't help.
- **Trigger: automatic**, debounced, once local results are empty and the
  term is long enough to be a meaningful query (≥ 3 characters) — not a
  manual "Search Open Food Facts" button.
- **Select behavior: immediate upsert**, identical to the existing barcode
  flow (no confirm/edit screen before saving) — one consistent pattern
  across both entry points into the foods library.
- **Result quality: cap at ~20 results, prefer the Dutch product name**
  (matching `mapOffProduct`'s existing `product_name_nl` preference), no
  filtering on nutrition-data completeness. The one filter applied is
  dropping results with no usable name at all (empty name is unusable
  regardless of the "no filtering" call — it's a basic sanity check, not a
  quality judgment).

## Backend changes (`convex/`)

### `lib/offFetch.ts`

Add `searchOffProducts(term, fetchImpl = fetch)`:

- Calls OFF's v2 API: `GET /api/v2/search?search_terms=<term>&page_size=20&fields=code,product_name,product_name_nl,brands,nutriments,serving_size,serving_quantity`.
- Same conventions as the existing `fetchOffProduct`: same `OFF_USER_AGENT`,
  same `OFF_TIMEOUT_MS` timeout via `AbortSignal.timeout`, never throws —
  returns the raw parsed JSON on success, `null` on any failure (network
  error, timeout, non-OK status, invalid JSON).
- No barcode-pattern validation (that check is barcode-specific); the term
  is passed through as a URL-encoded query parameter.

### `lib/offMapping.ts`

Refactor to share mapping logic between the single-product and search-list
shapes:

- Extract the body of the current `mapOffProduct` (name/brand/nutrition/
  serving mapping for one `OffProduct`) into
  `mapOffRawProduct(product: OffProduct): OffMappedFood`, unchanged from
  today — including the existing behavior of returning `name: ''` when
  neither name field is present (this must stay a plain mapping function
  with no null-return case, so `mapOffProduct`'s existing empty-name test
  keeps passing unmodified).
- `mapOffProduct(raw: unknown)` becomes a thin wrapper: validates the
  `{status, product}` single-product response shape as it does today, then
  delegates to `mapOffRawProduct`. Existing behavior/tests unchanged.
- Add `OffSearchResult extends OffMappedFood { barcode: string }` and
  `mapOffSearchResults(raw: unknown): OffSearchResult[]`: validates the
  `{products: OffProduct[]}` search-response shape, maps each entry via
  `mapOffRawProduct`, attaches `barcode` from the product's `code` field,
  and **only for this search path** drops entries with an empty `name`
  (the one quality filter described above — applied here, not inside
  `mapOffRawProduct`, so it doesn't affect the barcode single-product
  path) or a missing/empty `code`, and caps the result at 20 entries.
  Malformed/non-object input returns `[]` (search is a soft fallback — no
  throwing).

### `foodsLookup.ts`

Add `searchByName` action:

- Args: `{ term: v.string() }`.
- Same auth check as `lookupBarcode` (`ConvexError('Not authenticated')` if
  no identity).
- Calls `searchOffProducts` then `mapOffSearchResults`; returns the
  resulting array. Returns `[]` if `searchOffProducts` returned `null`
  (never throws on OFF-side failure, consistent with the barcode lookup's
  "must never throw" convention).

## Client changes (`src/components/nutrition/FoodAddTab.tsx`)

- **Extract `saveOffMatch(mapped: OffMappedFood, barcode: string)`**: pulls
  the existing "upsert via `foods.upsertFromOff` → re-fetch via `foods.get`
  → `setSelected`/`setUnit`" block out of `handleDetected` into a shared
  helper. `handleDetected` calls it after a successful barcode lookup; the
  new name-search selection handler calls it after a successful OFF-result
  click. No behavior change for the existing barcode path.
- **New state**: `offResults: OffSearchResult[] | null`, `offSearching:
  boolean`, `offSearchError: string | null`, plus a ref tracking the term an
  in-flight OFF search was fired for (to discard a stale response if the
  user keeps typing before it resolves).
- **New effect**, keyed on `debouncedTerm` and the local `results` query
  result: when `results` has resolved to an empty array and
  `debouncedTerm.trim().length >= 3`, call the new
  `useAction(api.foodsLookup.searchByName)` with the current term. Skip if
  a search for this exact term is already in flight or was already
  completed (avoid duplicate calls on unrelated re-renders). If the term
  changes before the call resolves, discard the response.
- **Rendering**: below the existing local-results `<ul>`, when
  `offSearching` show a small "Searching Open Food Facts…" line; when
  `offResults` is non-empty, render a second `<ul>` under a "From Open Food
  Facts" label, each item showing name + brand (same visual style as local
  results), `onClick` → `saveOffMatch(result, result.barcode)`. On
  `offSearchError`, show a small inline error line (consistent with the
  existing `lookupError` treatment) — non-blocking, since this is a
  best-effort fallback and local search / barcode scanning still work.

## Error handling & edge cases

- OFF search network/timeout/parse failures never throw past
  `searchByName` — client sees an empty array, which (combined with local
  results also being empty) just means no matches found; `offSearchError`
  is only set on a genuine client-side action-call failure (e.g. the
  Convex action itself rejects, distinct from OFF returning nothing).
- A term shorter than 3 characters never triggers an OFF search, even if
  local results are empty (avoids overly broad single/double-character
  queries hitting OFF on every keystroke pause).
- If local search itself is still loading (`results === undefined`), the
  OFF-fallback effect does not fire — it only triggers once local search
  has definitively resolved to `[]`.
- Selecting an OFF result reuses `upsertFromOff`'s existing upsert-by-
  barcode logic — if the same product was already imported by barcode
  scanning earlier, `saveOffMatch` will find and reuse that existing row
  rather than creating a duplicate (same invariant as today).

## Testing

- `convex/lib/offMapping.test.ts` (existing file): add cases for
  `mapOffRawProduct`/`mapOffSearchResults` — empty-name entries dropped,
  NL-name preference honored, missing barcode dropped, missing nutriments
  handled gracefully, cap at 20 results.
- `convex/lib/offFetch.test.ts` (existing file): add cases for
  `searchOffProducts` mirroring the existing `fetchOffProduct` coverage —
  malformed/non-OK response → `null`, timeout → `null`, valid response →
  parsed JSON passed through.
- Manual verify pass (per this repo's `verify` skill): in the browser
  preview, type a food name with no local match, confirm the OFF fallback
  results appear after the debounce, select one, confirm it's added to the
  diary entry and now also appears in local `foods.search` on a repeat
  search of the same term.
