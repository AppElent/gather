# OFF Name-Search Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automatic Open Food Facts (OFF) name-search fallback to `FoodAddTab`, so a food with no local match can be found and imported by name, not just by barcode scan.

**Architecture:** Extend the existing barcode-lookup pipeline (`convex/lib/offFetch.ts` → `convex/lib/offMapping.ts` → `convex/foodsLookup.ts`) with a parallel search path, then wire it into `FoodAddTab.tsx` as a debounced fallback that only fires once local search comes back empty for a term of 3+ characters.

**Tech Stack:** Convex actions/queries, Vitest, React (TanStack Start), OFF `/api/v2/search` REST endpoint.

**Spec:** `docs/superpowers/specs/2026-07-20-off-name-search-design.md`

---

### Task 1: `searchOffProducts` in `offFetch.ts`

**Files:**
- Modify: `convex/lib/offFetch.ts`
- Test: `convex/lib/offFetch.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `convex/lib/offFetch.test.ts`. Change the import on line 2 from:

```ts
import { fetchOffProduct } from './offFetch'
```

to:

```ts
import { fetchOffProduct, searchOffProducts } from './offFetch'
```

Then append this new `describe` block at the end of the file (after the closing `})` of the existing `describe('fetchOffProduct', ...)` block):

```ts
describe('searchOffProducts', () => {
  test('fetches the search endpoint with the term, page size, and field list', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(mockResponse({ products: [] }))
    await searchOffProducts('nutella', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v2/search?search_terms=nutella&page_size=20&fields=code%2Cproduct_name%2Cproduct_name_nl%2Cbrands%2Cnutriments%2Cserving_size%2Cserving_quantity',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    )
  })

  test('returns the parsed JSON on success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ products: [{ code: '123', product_name: 'Test' }] }),
      )
    expect(await searchOffProducts('test', fetchImpl)).toEqual({
      products: [{ code: '123', product_name: 'Test' }],
    })
  })

  test('returns null on a non-ok response, a JSON parse failure, and a fetch throw', async () => {
    expect(
      await searchOffProducts(
        'test',
        vi.fn().mockResolvedValue(mockResponse({}, false)),
      ),
    ).toBeNull()
    expect(
      await searchOffProducts(
        'test',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('bad json')
          },
        } as unknown as Response),
      ),
    ).toBeNull()
    expect(
      await searchOffProducts(
        'test',
        vi.fn().mockRejectedValue(new Error('network down')),
      ),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run convex/lib/offFetch.test.ts`
Expected: FAIL — `searchOffProducts` is not exported from `./offFetch` (a TypeScript/import error, or `undefined is not a function`).

- [ ] **Step 3: Implement `searchOffProducts`**

In `convex/lib/offFetch.ts`, add this function after `fetchOffProduct` (i.e. at the end of the file):

```ts
// Searches Open Food Facts by free-text term (product name/brand) for the
// "no local match" fallback in FoodAddTab. Same never-throw contract as
// fetchOffProduct: returns the raw parsed JSON ({products: [...]} shape) on
// success, or null on any failure (network error, timeout, non-OK status,
// invalid JSON) — the caller treats null the same as "no matches".
export async function searchOffProducts(
  term: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search')
  url.searchParams.set('search_terms', term)
  url.searchParams.set('page_size', '20')
  url.searchParams.set(
    'fields',
    'code,product_name,product_name_nl,brands,nutriments,serving_size,serving_quantity',
  )
  let response: Response
  try {
    response = await fetchImpl(url.toString(), {
      headers: { 'User-Agent': OFF_USER_AGENT },
      signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
    })
  } catch {
    return null
  }
  if (!response.ok) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run convex/lib/offFetch.test.ts`
Expected: PASS — all tests in both `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/offFetch.ts convex/lib/offFetch.test.ts
git commit -m "feat(nutrition): add searchOffProducts for OFF name search"
```

---

### Task 2: `mapOffSearchResults` in `offMapping.ts`

**Files:**
- Modify: `convex/lib/offMapping.ts`
- Test: `convex/lib/offMapping.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `convex/lib/offMapping.test.ts`. Change the import on line 10 from:

```ts
import { mapOffProduct } from './offMapping'
```

to:

```ts
import { mapOffProduct, mapOffSearchResults } from './offMapping'
```

Then append this new `describe` block at the end of the file:

```ts
describe('mapOffSearchResults', () => {
  test('maps each product in the products array and attaches its barcode', () => {
    const results = mapOffSearchResults({
      products: [
        {
          code: '3017620422003',
          product_name: 'Nutella',
          brands: 'Ferrero,Nutella',
          nutriments: { 'energy-kcal_100g': 539 },
        },
      ],
    })
    expect(results).toEqual([
      {
        barcode: '3017620422003',
        name: 'Nutella',
        brand: 'Ferrero',
        nutritionPer100: { calories: 539 },
        servingSize: undefined,
        servingLabel: undefined,
      },
    ])
  })

  test('drops entries with no usable name', () => {
    const results = mapOffSearchResults({
      products: [{ code: '111', nutriments: {} }],
    })
    expect(results).toEqual([])
  })

  test('drops entries with a missing or empty barcode', () => {
    const results = mapOffSearchResults({
      products: [
        { product_name: 'No Code', nutriments: {} },
        { code: '', product_name: 'Empty Code', nutriments: {} },
      ],
    })
    expect(results).toEqual([])
  })

  test('prefers the Dutch product name, same as mapOffProduct', () => {
    const results = mapOffSearchResults({
      products: [
        {
          code: '222',
          product_name: 'Generic Name',
          product_name_nl: 'Nederlandse Naam',
          nutriments: {},
        },
      ],
    })
    expect(results[0]?.name).toBe('Nederlandse Naam')
  })

  test('caps the result at 20 entries', () => {
    const products = Array.from({ length: 30 }, (_, i) => ({
      code: `${1000 + i}`,
      product_name: `Item ${i}`,
      nutriments: {},
    }))
    const results = mapOffSearchResults({ products })
    expect(results).toHaveLength(20)
  })

  test('returns an empty list for malformed or non-object input', () => {
    expect(mapOffSearchResults(null)).toEqual([])
    expect(mapOffSearchResults('nope')).toEqual([])
    expect(mapOffSearchResults({})).toEqual([])
    expect(mapOffSearchResults({ products: 'not-an-array' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run convex/lib/offMapping.test.ts`
Expected: FAIL — `mapOffSearchResults` is not exported from `./offMapping`.

- [ ] **Step 3: Refactor `offMapping.ts`**

Replace the whole file `convex/lib/offMapping.ts` with:

```ts
import { type NutritionFacts, parseNutritionValue } from './nutrition'

export interface OffMappedFood {
  name: string
  brand?: string
  nutritionPer100: NutritionFacts
  servingSize?: number
  servingLabel?: string
}

export interface OffSearchResult extends OffMappedFood {
  barcode: string
}

interface OffProduct {
  code?: unknown
  product_name?: unknown
  product_name_nl?: unknown
  brands?: unknown
  nutriments?: Record<string, unknown>
  serving_size?: unknown
  serving_quantity?: unknown
}

interface OffResponse {
  status?: unknown
  product?: OffProduct
}

interface OffSearchResponse {
  products?: unknown
}

// Open Food Facts product names are per-product, not per-request-locale — a
// Dutch name lives in `product_name_nl` alongside the (often differently
// worded, or same-language-by-coincidence) `product_name`. Prefer Dutch since
// this app's users primarily scan Dutch supermarket products; fall back to
// the generic name, then to an empty string the user fills in on the
// confirmation screen (spec §4.3).
function preferredName(product: OffProduct): string {
  const nl = product.product_name_nl
  if (typeof nl === 'string' && nl.trim()) return nl.trim()
  const generic = product.product_name
  if (typeof generic === 'string' && generic.trim()) return generic.trim()
  return ''
}

function parseServingSize(product: OffProduct): number | undefined {
  if (
    typeof product.serving_quantity === 'number' &&
    Number.isFinite(product.serving_quantity) &&
    product.serving_quantity > 0
  ) {
    return product.serving_quantity
  }
  if (typeof product.serving_size === 'string') {
    const match = /^(\d+(?:[.,]\d+)?)/.exec(product.serving_size.trim())
    if (match) {
      const value = Number(match[1].replace(',', '.'))
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  return undefined
}

const NUTRIMENT_MAPPINGS: Array<[keyof NutritionFacts, string]> = [
  ['calories', 'energy-kcal_100g'],
  ['protein', 'proteins_100g'],
  ['carbs', 'carbohydrates_100g'],
  ['sugars', 'sugars_100g'],
  ['fat', 'fat_100g'],
  ['saturatedFat', 'saturated-fat_100g'],
  ['fiber', 'fiber_100g'],
  ['salt', 'salt_100g'],
]

// Maps one OFF product object (from either the single-product or search
// response shapes) to our foods shape. Always returns a mapped object, even
// when the name is empty — the barcode single-product path (mapOffProduct)
// leaves that decision to the user on the confirmation screen (spec §4.3);
// the search path (mapOffSearchResults) applies its own empty-name filter
// on top of this, since a nameless row is just noise in a results list.
function mapOffRawProduct(product: OffProduct): OffMappedFood {
  const nutriments = product.nutriments
  const nutritionPer100: NutritionFacts = {}
  if (typeof nutriments === 'object' && nutriments !== null) {
    for (const [key, offField] of NUTRIMENT_MAPPINGS) {
      // OFF's *_100g fields are already plain numbers in the right unit
      // (kcal for energy, grams for everything else) — parseNutritionValue's
      // number branch just validates finiteness/non-negativity here, no
      // unit conversion is triggered (that only fires on strings containing
      // "mg"/"kJ", which these fields never are).
      const parsed = parseNutritionValue(nutriments[offField])
      if (parsed !== undefined) nutritionPer100[key] = parsed
    }
  }

  const brand =
    typeof product.brands === 'string' && product.brands.trim()
      ? product.brands.split(',')[0].trim()
      : undefined

  return {
    name: preferredName(product),
    brand,
    nutritionPer100,
    servingSize: parseServingSize(product),
    servingLabel:
      typeof product.serving_size === 'string'
        ? product.serving_size.trim() || undefined
        : undefined,
  }
}

// Maps a raw Open Food Facts /api/v2/product/{barcode} response to our foods
// shape. Returns null when the product wasn't found (status !== 1) or the
// response is malformed — barcode lookups must never throw; the caller falls
// back to manual entry either way (spec §6).
export function mapOffProduct(raw: unknown): OffMappedFood | null {
  if (typeof raw !== 'object' || raw === null) return null
  const response = raw as OffResponse
  if (response.status !== 1) return null
  const product = response.product
  if (typeof product !== 'object' || product === null) return null
  return mapOffRawProduct(product)
}

// Maps a raw Open Food Facts /api/v2/search response ({products: [...]}) to
// a capped list of importable results. Unlike mapOffProduct, this drops
// entries with no usable name (noise in a results list, spec §4.3 of the
// 2026-07-20 OFF name-search design) or no barcode (unusable — the result
// can't be upserted without one). Malformed/non-object input, or a missing
// `products` array, returns an empty list — search is a soft fallback, never
// throws.
export function mapOffSearchResults(raw: unknown): OffSearchResult[] {
  if (typeof raw !== 'object' || raw === null) return []
  const response = raw as OffSearchResponse
  if (!Array.isArray(response.products)) return []

  const results: OffSearchResult[] = []
  for (const entry of response.products) {
    if (typeof entry !== 'object' || entry === null) continue
    const product = entry as OffProduct
    const barcode =
      typeof product.code === 'string' ? product.code.trim() : ''
    if (!barcode) continue
    const mapped = mapOffRawProduct(product)
    if (!mapped.name) continue
    results.push({ ...mapped, barcode })
    if (results.length >= 20) break
  }
  return results
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run convex/lib/offMapping.test.ts`
Expected: PASS — every test in both `describe('mapOffProduct — ...')` blocks (unchanged behavior) and the new `describe('mapOffSearchResults', ...)` block is green.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/offMapping.ts convex/lib/offMapping.test.ts
git commit -m "feat(nutrition): add mapOffSearchResults, extract mapOffRawProduct"
```

---

### Task 3: `searchByName` action in `foodsLookup.ts`

**Files:**
- Modify: `convex/foodsLookup.ts`

No dedicated test file for this task: `foodsLookup.ts`'s existing actions (`lookupBarcode`, `refreshFromOff`) have no unit tests either — they're thin wrappers around already-tested `offFetch`/`offMapping` functions plus a Convex auth check, verified end-to-end via the manual browser pass in Task 5. This task follows that same convention.

- [ ] **Step 1: Update imports**

In `convex/foodsLookup.ts`, change:

```ts
import { fetchOffProduct } from './lib/offFetch'
import { mapOffProduct } from './lib/offMapping'
```

to:

```ts
import { fetchOffProduct, searchOffProducts } from './lib/offFetch'
import { mapOffProduct, mapOffSearchResults } from './lib/offMapping'
```

- [ ] **Step 2: Add the `searchByName` action**

Append this to the end of `convex/foodsLookup.ts` (after the closing `})` of `refreshFromOff`):

```ts

// Searches Open Food Facts by name — the "no local match" fallback in
// FoodAddTab's search box. Best-effort: any OFF-side failure (network,
// timeout, malformed response) surfaces as an empty array, never a thrown
// error, matching lookupBarcode's contract — a failed OFF search just means
// "no matches", same as a genuinely empty result set.
export const searchByName = action({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    const raw = await searchOffProducts(args.term)
    return mapOffSearchResults(raw)
  },
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: no errors. (This also regenerates/validates `convex/_generated/api.d.ts` typings used by the client in Task 4 — if it doesn't pick up the new action automatically, run `pnpm exec convex dev --once` first, then re-run typecheck.)

- [ ] **Step 4: Commit**

```bash
git add convex/foodsLookup.ts
git commit -m "feat(nutrition): add searchByName action"
```

---

### Task 4: Wire the OFF fallback into `FoodAddTab.tsx`

**Files:**
- Modify: `src/components/nutrition/FoodAddTab.tsx`

- [ ] **Step 1: Update imports**

Replace the full import block at the top of the file (lines 1–11):

```tsx
import { Link } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  computeFoodEntryNutrition,
  type MealName,
} from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { BarcodeScanner } from '../foods/BarcodeScanner'
```

with:

```tsx
import { Link } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  computeFoodEntryNutrition,
  type MealName,
} from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import type {
  OffMappedFood,
  OffSearchResult,
} from '../../../convex/lib/offMapping'
import { BarcodeScanner } from '../foods/BarcodeScanner'
```

- [ ] **Step 2: Add OFF-search state and the `searchByName` action hook**

Replace:

```tsx
  const [selected, setSelected] = useState<FoodSummary | null>(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [unit, setUnit] = useState<'g' | 'ml' | 'piece'>('g')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)
  const createEntry = useMutation(api.consumption.create)
```

with:

```tsx
  const [selected, setSelected] = useState<FoodSummary | null>(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [offResults, setOffResults] = useState<OffSearchResult[] | null>(
    null,
  )
  const [offSearching, setOffSearching] = useState(false)
  const [offSearchError, setOffSearchError] = useState<string | null>(null)
  const offSearchedTermRef = useRef<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [unit, setUnit] = useState<'g' | 'ml' | 'piece'>('g')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const searchByName = useAction(api.foodsLookup.searchByName)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)
  const createEntry = useMutation(api.consumption.create)
```

- [ ] **Step 3: Extract `saveOffMatch`, add `handleOffResultSelect`, add the fallback effect**

Replace the whole `handleDetected` function:

```tsx
  async function handleDetected(barcode: string) {
    if (resolving) return
    setResolving(true)
    setNotFoundBarcode(null)
    setLookupError(null)
    try {
      const existing = await convex.query(api.foods.getByBarcode, { barcode })
      if (existing) {
        setSelected(existing)
        setUnit(existing.baseUnit)
        return
      }
      const mapped = await lookupBarcode({ barcode })
      if (!mapped) {
        setNotFoundBarcode(barcode)
        return
      }
      const id = await upsertFromOff({
        barcode,
        name: mapped.name,
        brand: mapped.brand,
        baseUnit: 'g',
        nutritionPer100: mapped.nutritionPer100,
        servingSize: mapped.servingSize,
        servingLabel: mapped.servingLabel,
      })
      const saved = await convex.query(api.foods.get, { id })
      if (saved) {
        setSelected(saved)
        setUnit(saved.baseUnit)
      }
    } catch {
      setLookupError("Couldn't look up that barcode — try again.")
    } finally {
      setResolving(false)
    }
  }
```

with:

```tsx
  async function saveOffMatch(mapped: OffMappedFood, barcode: string) {
    const id = await upsertFromOff({
      barcode,
      name: mapped.name,
      brand: mapped.brand,
      baseUnit: 'g',
      nutritionPer100: mapped.nutritionPer100,
      servingSize: mapped.servingSize,
      servingLabel: mapped.servingLabel,
    })
    const saved = await convex.query(api.foods.get, { id })
    if (saved) {
      setSelected(saved)
      setUnit(saved.baseUnit)
    }
  }

  async function handleDetected(barcode: string) {
    if (resolving) return
    setResolving(true)
    setNotFoundBarcode(null)
    setLookupError(null)
    try {
      const existing = await convex.query(api.foods.getByBarcode, { barcode })
      if (existing) {
        setSelected(existing)
        setUnit(existing.baseUnit)
        return
      }
      const mapped = await lookupBarcode({ barcode })
      if (!mapped) {
        setNotFoundBarcode(barcode)
        return
      }
      await saveOffMatch(mapped, barcode)
    } catch {
      setLookupError("Couldn't look up that barcode — try again.")
    } finally {
      setResolving(false)
    }
  }

  async function handleOffResultSelect(result: OffSearchResult) {
    setOffSearchError(null)
    try {
      await saveOffMatch(result, result.barcode)
    } catch {
      setOffSearchError("Couldn't add that item — try again.")
    }
  }

  // Fires once local search has definitively resolved to zero results for a
  // term worth querying OFF over (3+ chars — avoids a network round-trip on
  // every 1-2 character keystroke). Guards against re-firing for a term
  // already searched, and discards a stale response if the term changed
  // while the request was in flight.
  useEffect(() => {
    const term = debouncedTerm.trim()
    if (term.length < 3 || results === undefined || results.length > 0) {
      setOffResults(null)
      setOffSearching(false)
      offSearchedTermRef.current = null
      return
    }
    if (offSearchedTermRef.current === term) return
    offSearchedTermRef.current = term
    setOffSearching(true)
    setOffSearchError(null)
    searchByName({ term })
      .then((found) => {
        if (offSearchedTermRef.current !== term) return
        setOffResults(found)
      })
      .catch(() => {
        if (offSearchedTermRef.current !== term) return
        setOffSearchError("Couldn't search Open Food Facts.")
      })
      .finally(() => {
        if (offSearchedTermRef.current !== term) return
        setOffSearching(false)
      })
  }, [debouncedTerm, results, searchByName])
```

- [ ] **Step 4: Render the OFF results list**

Replace the closing part of the local-results `<ul>` and the surrounding tail of the component:

```tsx
      <ul className="max-h-48 divide-y divide-[var(--app-border)] overflow-y-auto">
        {results?.map((food) => (
          <li key={food._id}>
            <button
              type="button"
              onClick={() => {
                setSelected(food)
                setUnit(food.baseUnit)
              }}
              className="block w-full py-1.5 text-left text-sm"
            >
              {food.name}
              {food.brand && (
                <span className="ml-2 opacity-60">{food.brand}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

with:

```tsx
      <ul className="max-h-48 divide-y divide-[var(--app-border)] overflow-y-auto">
        {results?.map((food) => (
          <li key={food._id}>
            <button
              type="button"
              onClick={() => {
                setSelected(food)
                setUnit(food.baseUnit)
              }}
              className="block w-full py-1.5 text-left text-sm"
            >
              {food.name}
              {food.brand && (
                <span className="ml-2 opacity-60">{food.brand}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {offSearching && (
        <p className="text-xs opacity-60">Searching Open Food Facts…</p>
      )}
      {offSearchError && (
        <p className="text-xs text-red-700">{offSearchError}</p>
      )}
      {offResults && offResults.length > 0 && (
        <div className="grid gap-1">
          <p className="text-xs font-medium opacity-60">
            From Open Food Facts
          </p>
          <ul className="max-h-48 divide-y divide-[var(--app-border)] overflow-y-auto">
            {offResults.map((result) => (
              <li key={result.barcode}>
                <button
                  type="button"
                  onClick={() => handleOffResultSelect(result)}
                  className="block w-full py-1.5 text-left text-sm"
                >
                  {result.name}
                  {result.brand && (
                    <span className="ml-2 opacity-60">{result.brand}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/nutrition/FoodAddTab.tsx
git commit -m "feat(nutrition): add OFF name-search fallback to FoodAddTab"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — no regressions anywhere, including the untouched `offMapping`/`offFetch` barcode-path tests.

- [ ] **Step 2: Manual browser verification**

Per this repo's `verify` skill (required before considering a change to gather done):

1. Start the dev server (Convex + Vite) and open the nutrition diary's "Add food" flow (`FoodAddTab`).
2. Type a food name with **no local match** (something not already in your `foods` table) that's at least 3 characters, e.g. a product you know exists on Open Food Facts but haven't logged before.
3. Confirm: after the debounce, local results show empty, then a "Searching Open Food Facts…" line appears, then a "From Open Food Facts" section appears with results.
4. Click one of the OFF results. Confirm it moves to the quantity-entry screen with the product's name shown (same as the barcode-scan flow does).
5. Enter a quantity, submit, and confirm the diary entry is created.
6. Re-open "Add food" and search the same term again — confirm the product now also appears in the plain local results list (proving it was upserted into `foods`, not just shown transiently).
7. Type a term under 3 characters with no local match — confirm no OFF search fires (no "Searching…" line appears).
8. Type a term that *does* have local matches — confirm no OFF fallback fires (local results alone are shown).

- [ ] **Step 3: Commit any fixes found during manual verification**

If Step 2 surfaces a bug, fix it, re-run the affected step, then:

```bash
git add -A
git commit -m "fix(nutrition): <describe the fix>"
```

(Skip this step entirely if manual verification passed cleanly with no changes needed.)
