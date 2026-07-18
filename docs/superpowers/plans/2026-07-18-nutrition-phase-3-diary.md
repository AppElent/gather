# Nutrition Phase 3: Consumption Diary & Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user consumption diary (`/nutrition` day view: date navigation, four meal
slots, a three-tab add picker for Recipes/Foods/Quick-add, entry edit/delete) plus daily
nutrition targets with progress bars, and — per this plan's locked decision — the first real
navigation entry point for the whole nutrition feature (a "Nutrition" module tile).

**Architecture:** A new `consumptionEntries` table stores per-user, per-day, per-meal entries
with a **snapshotted** nutrition value computed client-side at log time (spec §3.4, §4.5) —
editing/deleting the underlying recipe or food never rewrites history. A new
`convex/lib/consumption.ts` holds the shared meal/quantity-unit vocabulary and the pure
quantity→nutrition math (mirroring how `convex/lib/nutrition.ts` is the shared vocabulary for
`NutritionFacts`), reused by both the Convex backend and the React frontend. The day view is
composed from small presentational components (`TargetsPanel`, `DayTotals`, `MealSlot`,
`ConsumptionEntryRow`) that take props/callbacks and are unit-tested, plus a modal
(`AddEntryModal`) whose three tabs own their own Convex hooks directly (mirroring
`IssueReporterModal.tsx`'s and the `/foods/*` routes' precedent — no dedicated tests for these,
verified in the final e2e pass instead).

**Tech Stack:** Convex (queries/mutations, no new actions needed — reuses Phase 2's
`foodsLookup.lookupBarcode`/`foods.upsertFromOff`), TanStack Router (new `/nutrition` route),
React + Vitest + Testing Library, Tailwind v4, `NutrientInputGrid`/`nutrientInputs.ts` and
`BarcodeScanner` reused as-is from Phases 1–2.

---

## Locked decisions (do not revisit without user input)

- **Targets are edited inline on `/nutrition`** — a collapsible "Daily targets" panel at the
  top of the day view, not a separate route and not on the global `/settings` page. Confirmed
  with the user during planning (2026-07-18): no existing precedent pointed either way, and this
  keeps editing colocated with where the progress bars render, matching the spec's literal
  wording ("the nutrition module's settings section").
- **The add picker is a modal**, not a separate route — matches the spec's own "opens a picker"
  wording and reuses the overlay pattern already established by
  `src/components/app/IssueReporterModal.tsx` (`fixed inset-0 z-50 ... bg-black/30` backdrop,
  `onClick` on the backdrop to close, `stopPropagation` on the inner panel, Escape-key handler).
- **The Foods tab's barcode scan is inlined** in the modal for the two common cases (a food
  already in the local library, or a fresh Open Food Facts match) using the existing
  `foods.getByBarcode` / `foodsLookup.lookupBarcode` / `foods.upsertFromOff` functions directly
  — it does **not** re-implement `FoodForm`'s manual-entry fallback. When OFF has no match (or
  is unreachable), the tab shows a link to `/foods/new?barcode=<code>` (the existing full flow)
  and closes nothing — the user finishes there and returns to log it afterward. This avoids
  duplicating the manual-food-creation UI inside a modal for what should be a rare path.
- **Entries are edited (quantity/meal/date) inline in the row**, not via a separate route/modal
  — a "Edit" toggle reveals a quantity input, a meal `<select>`, and a date `<input type="date">`
  right in the row, satisfying spec §4.5's "Entries can be edited (quantity/meal/date)" without
  new routing.
- **No delete confirmation** on consumption entries — matches this codebase's existing
  precedent (`recipes.remove` / the recipe detail page's delete button has no confirm dialog
  either; only the foods-library's *destructive OFF refresh* got a `window.confirm`, because
  that one silently discards local edits a user may not remember making).
- **The `/nutrition?date=` search param does NOT need the numeric-string coercion** that
  `/foods/new?barcode=` needed (see `git log` for `fix(nutrition): accept numeric barcode search
  params in /foods/new`). That fix was needed because bare-digit strings (barcodes) are valid
  JSON *numbers*, so the router's default `JSON.parse`-based search codec silently mis-typed
  them. A `YYYY-MM-DD` date string contains dashes in a shape `JSON.parse` cannot parse as a
  number (it throws), and the router falls back to the raw string in that case — confirmed by
  the same investigation that found the barcode bug. Plain `typeof search.date === 'string'` is
  safe here.

---

## File structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` (modify) | `consumptionEntries` table; `users.nutritionTargets` field |
| `convex/lib/consumption.ts` (new) | Shared meal/quantity-unit vocabulary + validators; pure quantity→nutrition math (`scaleFacts`, `sumFacts`, `computeRecipeEntryNutrition`, `computeFoodEntryNutrition`) |
| `convex/consumption.ts` (new) | `listForDay`, `create`, `update`, `remove` |
| `convex/users.ts` (modify) | `setNutritionTargets` mutation |
| `src/components/nutrition/TargetsPanel.tsx` (new) | Collapsible targets editor (props/callback, tested) |
| `src/components/nutrition/DayTotals.tsx` (new) | Totals + progress bars vs. targets (presentational, tested) |
| `src/components/nutrition/ConsumptionEntryRow.tsx` (new) | One entry row with inline edit/delete (presentational, tested) |
| `src/components/nutrition/MealSlot.tsx` (new) | One meal section: heading, entries, Add button (presentational, tested) |
| `src/components/nutrition/RecipeAddTab.tsx` (new) | Add-picker Recipes tab (Convex hooks, untested — see route/interactive precedent) |
| `src/components/nutrition/FoodAddTab.tsx` (new) | Add-picker Foods tab: search + inline barcode scan (Convex hooks, untested) |
| `src/components/nutrition/QuickAddTab.tsx` (new) | Add-picker Quick-add tab (Convex hooks, untested) |
| `src/components/nutrition/AddEntryModal.tsx` (new) | Modal shell + tab switcher (untested) |
| `src/routes/_app/nutrition/index.tsx` (new) | Day view route: date nav, targets, totals, four meal slots |
| `src/lib/modules.ts` (modify) | Add the "Nutrition" module tile (`status: 'live'`) |

---

### Task 1: Schema — `consumptionEntries` table + `users.nutritionTargets`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the fields and table**

Add `nutritionTargets` to the existing `users` table definition, and add the new
`consumptionEntries` table:

```ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    defaultGroupId: v.optional(v.id('groups')),
    nutritionTargets: v.optional(nutritionValidator),
  }).index('by_clerkId', ['clerkId']),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    type: v.optional(v.string()),
  }).index('by_inviteCode', ['inviteCode']),

  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('owner'), v.literal('member')),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),

  recipes: defineTable({
    ownerId: v.id('users'),
    sharedGroupIds: v.array(v.id('groups')),
    title: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    tags: v.array(v.string()),
    rating: v.optional(v.number()),
    prepMinutes: v.optional(v.number()),
    sourceUrl: v.optional(v.string()),
    servings: v.optional(v.number()),
    nutrition: v.optional(nutritionValidator),
    nutritionSource: v.optional(nutritionSourceValidator),
    nutritionStale: v.optional(v.boolean()),
  }).index('by_owner', ['ownerId']),

  foods: defineTable({
    name: v.string(),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    baseUnit: v.union(v.literal('g'), v.literal('ml')),
    nutritionPer100: nutritionValidator,
    servingSize: v.optional(v.number()),
    servingLabel: v.optional(v.string()),
    source: v.union(v.literal('openfoodfacts'), v.literal('manual')),
    localEdited: v.optional(v.boolean()),
    createdBy: v.id('users'),
  })
    .index('by_barcode', ['barcode'])
    .searchIndex('search_by_name', { searchField: 'name' }),

  consumptionEntries: defineTable({
    userId: v.id('users'),
    date: v.string(),
    meal: v.union(
      v.literal('breakfast'),
      v.literal('lunch'),
      v.literal('dinner'),
      v.literal('snack'),
    ),
    recipeId: v.optional(v.id('recipes')),
    foodId: v.optional(v.id('foods')),
    label: v.string(),
    quantity: v.number(),
    quantityUnit: v.union(
      v.literal('serving'),
      v.literal('g'),
      v.literal('ml'),
      v.literal('piece'),
    ),
    nutrition: nutritionValidator,
  }).index('by_user_date', ['userId', 'date']),
})
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (nothing references the new table/field yet, so no downstream errors).

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/schema.ts && git commit -m "feat(nutrition): consumptionEntries table + users.nutritionTargets field"
```

---

### Task 2: `convex/lib/consumption.ts` — shared vocabulary + quantity→nutrition math

**Files:**
- Create: `convex/lib/consumption.ts`
- Test: `convex/lib/consumption.test.ts`

This is the Phase 3 counterpart to `convex/lib/nutrition.ts`: pure, framework-free functions and
validators shared by the Convex backend and the React frontend (same pattern as
`nutritionValidator`/`NUTRIENT_KEYS` already being imported client-side).

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/consumption.test.ts`:

```ts
import { expect, test } from 'vitest'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  scaleFacts,
  sumFacts,
} from './consumption'

test('scaleFacts multiplies present nutrients by the factor and rounds to 2 decimals', () => {
  expect(scaleFacts({ calories: 100, protein: 3.333 }, 1.5)).toEqual({
    calories: 150,
    protein: 5,
  })
})

test('scaleFacts omits nutrients absent from the input', () => {
  expect(scaleFacts({ calories: 200 }, 2)).toEqual({ calories: 400 })
})

test('sumFacts sums nutrients present in at least one entry, treating absence as zero', () => {
  expect(
    sumFacts([{ calories: 100, protein: 5 }, { calories: 50 }, { fiber: 2 }]),
  ).toEqual({ calories: 150, protein: 5, fiber: 2 })
})

test('sumFacts returns an empty object for an empty list', () => {
  expect(sumFacts([])).toEqual({})
})

test('computeRecipeEntryNutrition scales per-serving nutrition by quantity in servings', () => {
  expect(computeRecipeEntryNutrition({ calories: 400, protein: 20 }, 2)).toEqual({
    calories: 800,
    protein: 40,
  })
})

test('computeFoodEntryNutrition scales per-100 nutrition directly for g/ml quantities', () => {
  const food = { nutritionPer100: { calories: 250, fat: 10 } }
  expect(computeFoodEntryNutrition(food, 150, 'g')).toEqual({
    calories: 375,
    fat: 15,
  })
})

test('computeFoodEntryNutrition scales by servingSize for piece quantities', () => {
  const food = { nutritionPer100: { calories: 500 }, servingSize: 30 }
  // 2 pieces * 30g = 60g -> 60/100 * 500 = 300
  expect(computeFoodEntryNutrition(food, 2, 'piece')).toEqual({ calories: 300 })
})

test('computeFoodEntryNutrition treats a missing servingSize as zero grams for piece quantities', () => {
  const food = { nutritionPer100: { calories: 500 } }
  expect(computeFoodEntryNutrition(food, 3, 'piece')).toEqual({ calories: 0 })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run convex/lib/consumption.test.ts`
Expected: FAIL — cannot resolve `./consumption`.

- [ ] **Step 3: Implement `convex/lib/consumption.ts`**

```ts
import { v } from 'convex/values'
import { NUTRIENT_KEYS, type NutritionFacts } from './nutrition'

export const MEAL_NAMES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealName = (typeof MEAL_NAMES)[number]

export const mealValidator = v.union(
  v.literal('breakfast'),
  v.literal('lunch'),
  v.literal('dinner'),
  v.literal('snack'),
)

export const MEAL_LABELS: Record<MealName, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const QUANTITY_UNITS = ['serving', 'g', 'ml', 'piece'] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

export const quantityUnitValidator = v.union(
  v.literal('serving'),
  v.literal('g'),
  v.literal('ml'),
  v.literal('piece'),
)

// Multiplies every present nutrient by `factor`, rounded to 2 decimals to
// avoid floating-point noise in stored snapshots.
export function scaleFacts(facts: NutritionFacts, factor: number): NutritionFacts {
  const out: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    const value = facts[key]
    if (value !== undefined) out[key] = Math.round(value * factor * 100) / 100
  }
  return out
}

// Sums a list of nutrition snapshots for day/meal totals. A nutrient is only
// present in the sum if at least one entry had it — absence isn't the same
// as zero (spec: "store what a source provides, render only what exists").
export function sumFacts(list: NutritionFacts[]): NutritionFacts {
  const out: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    if (!list.some((f) => f[key] !== undefined)) continue
    const total = list.reduce((acc, f) => acc + (f[key] ?? 0), 0)
    out[key] = Math.round(total * 100) / 100
  }
  return out
}

// Recipe nutrition is stored per-serving; quantity for a recipe entry is
// always in servings (spec §3.4: recipes' quantityUnit is always 'serving').
export function computeRecipeEntryNutrition(
  recipeNutritionPerServing: NutritionFacts,
  quantityServings: number,
): NutritionFacts {
  return scaleFacts(recipeNutritionPerServing, quantityServings)
}

// Food nutrition is stored per 100 g/ml. `unit: 'piece'` means quantity is a
// count of `food.servingSize`-sized portions; g/ml means quantity is the
// direct amount, matching food.baseUnit.
export function computeFoodEntryNutrition(
  food: { nutritionPer100: NutritionFacts; servingSize?: number },
  quantity: number,
  unit: 'g' | 'ml' | 'piece',
): NutritionFacts {
  const amount = unit === 'piece' ? quantity * (food.servingSize ?? 0) : quantity
  return scaleFacts(food.nutritionPer100, amount / 100)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run convex/lib/consumption.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add convex/lib/consumption.ts convex/lib/consumption.test.ts && git commit -m "feat(nutrition): consumption vocabulary + quantity-to-nutrition math"
```

---

### Task 3: `convex/consumption.ts` — CRUD

**Files:**
- Create: `convex/consumption.ts`

No dedicated test file — this is thin CRUD glue with no complex logic of its own (the actual
math is already unit-tested in `lib/consumption.ts`), matching the established precedent for
`convex/foods.ts` (also untested) in this codebase, which has no Convex mutation-test harness.

- [ ] **Step 1: Implement**

```ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  mealValidator,
  quantityUnitValidator,
  scaleFacts,
} from './lib/consumption'
import { NUTRIENT_KEYS, type NutritionFacts, nutritionValidator } from './lib/nutrition'
import { getCurrentUser } from './lib/sharing'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

function assertValidNutrition(nutrition: NutritionFacts) {
  for (const key of NUTRIENT_KEYS) {
    const value = nutrition[key]
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} must be a non-negative number`)
    }
  }
}

export const listForDay = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    return await ctx.db
      .query('consumptionEntries')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', user._id).eq('date', args.date),
      )
      .collect()
  },
})

export const create = mutation({
  args: {
    date: v.string(),
    meal: mealValidator,
    recipeId: v.optional(v.id('recipes')),
    foodId: v.optional(v.id('foods')),
    label: v.string(),
    quantity: v.number(),
    quantityUnit: quantityUnitValidator,
    nutrition: nutritionValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (args.recipeId && args.foodId) {
      throw new Error('An entry cannot reference both a recipe and a food')
    }
    if (args.quantity <= 0) throw new Error('Quantity must be positive')
    assertValidNutrition(args.nutrition)
    return await ctx.db.insert('consumptionEntries', {
      userId: user._id,
      ...args,
    })
  },
})

// On a quantity change, nutrition is recomputed from the current recipe/food
// values when the source still exists (spec §4.5); if the source was
// deleted, the existing snapshot is scaled proportionally instead so the
// entry still reflects the new quantity without needing source data.
async function recomputeFromSource(
  ctx: MutationCtx,
  entry: Doc<'consumptionEntries'>,
  quantity: number,
): Promise<NutritionFacts | null> {
  if (entry.recipeId) {
    const recipe = await ctx.db.get(entry.recipeId)
    return recipe?.nutrition
      ? computeRecipeEntryNutrition(recipe.nutrition, quantity)
      : null
  }
  if (entry.foodId) {
    const food = await ctx.db.get(entry.foodId)
    // Food entries never use 'serving' (only recipe entries do), but the
    // schema's quantityUnit field is the full 4-member union — narrow to
    // the 3 units computeFoodEntryNutrition actually accepts.
    return food
      ? computeFoodEntryNutrition(
          food,
          quantity,
          entry.quantityUnit as 'g' | 'ml' | 'piece',
        )
      : null
  }
  return null
}

export const update = mutation({
  args: {
    id: v.id('consumptionEntries'),
    date: v.optional(v.string()),
    meal: v.optional(mealValidator),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const entry = await ctx.db.get(args.id)
    if (!entry) throw new Error('Entry not found')
    if (entry.userId !== user._id) throw new Error('Not the owner')

    let nutrition = entry.nutrition
    let quantity = entry.quantity
    if (args.quantity !== undefined && args.quantity !== entry.quantity) {
      if (args.quantity <= 0) throw new Error('Quantity must be positive')
      quantity = args.quantity
      const recomputed = await recomputeFromSource(ctx, entry, quantity)
      nutrition = recomputed ?? scaleFacts(entry.nutrition, quantity / entry.quantity)
    }

    await ctx.db.patch(args.id, {
      ...(args.date !== undefined ? { date: args.date } : {}),
      ...(args.meal !== undefined ? { meal: args.meal } : {}),
      quantity,
      nutrition,
    })
  },
})

export const remove = mutation({
  args: { id: v.id('consumptionEntries') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const entry = await ctx.db.get(args.id)
    if (!entry) return
    if (entry.userId !== user._id) throw new Error('Not the owner')
    await ctx.db.delete(args.id)
  },
})
```

- [ ] **Step 2: Regenerate Convex API types**

Run: `pnpm exec convex codegen`
Then: `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/consumption.ts convex/_generated && git commit -m "feat(nutrition): consumption entries — listForDay/create/update/remove"
```

---

### Task 4: `convex/users.ts` — `setNutritionTargets` mutation

**Files:**
- Modify: `convex/users.ts`

- [ ] **Step 1: Add the mutation**

Add these imports to the top of `convex/users.ts` (alongside the existing
`mutation, query` import from `./_generated/server`):

```ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { nutritionValidator } from './lib/nutrition'
import { getCurrentUser } from './lib/sharing'
```

Then add this export at the end of the file (after `ensureUser`):

```ts
export const setNutritionTargets = mutation({
  args: { targets: nutritionValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    await ctx.db.patch(user._id, { nutritionTargets: args.targets })
  },
})
```

- [ ] **Step 2: Regenerate Convex API types + typecheck**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/users.ts convex/_generated && git commit -m "feat(nutrition): setNutritionTargets mutation"
```

---

### Task 5: `TargetsPanel` component

**Files:**
- Create: `src/components/nutrition/TargetsPanel.tsx`
- Test: `src/components/nutrition/TargetsPanel.test.tsx`

A collapsible section reusing `NutrientInputGrid`/`nutrientInputs.ts` (from Phase 1/2). Takes
`onSave`/`saving` as props rather than calling `useMutation` internally — matches this
codebase's established pattern for testable presentational forms (`FoodForm`, `RecipeForm`: the
route/caller owns the mutation hook, the component owns the form state).

- [ ] **Step 1: Write the failing tests**

Create `src/components/nutrition/TargetsPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TargetsPanel } from './TargetsPanel'

test('starts collapsed and expands to show the nutrient grid', () => {
  render(<TargetsPanel saving={false} onSave={vi.fn()} />)
  expect(screen.queryByText('Calories (kcal)')).toBeNull()
  fireEvent.click(screen.getByText('Daily targets'))
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
})

test('prefills from targets and calls onSave with parsed values', () => {
  const onSave = vi.fn()
  render(<TargetsPanel targets={{ calories: 2000 }} saving={false} onSave={onSave} />)
  fireEvent.click(screen.getByText('Daily targets'))
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('2000')
  fireEvent.change(screen.getByLabelText('Protein (g)'), {
    target: { value: '120' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save targets/i }))
  expect(onSave).toHaveBeenCalledWith({ calories: 2000, protein: 120 })
})

test('syncs the form when targets arrives after mount (e.g. the parent query was still loading)', () => {
  const { rerender } = render(<TargetsPanel saving={false} onSave={vi.fn()} />)
  fireEvent.click(screen.getByText('Daily targets'))
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('')
  rerender(<TargetsPanel targets={{ calories: 1800 }} saving={false} onSave={vi.fn()} />)
  expect(screen.getByLabelText('Calories (kcal)')).toHaveValue('1800')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/nutrition/TargetsPanel.test.tsx`
Expected: FAIL — cannot resolve `./TargetsPanel`.

- [ ] **Step 3: Implement `src/components/nutrition/TargetsPanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { NutrientInputGrid } from './NutrientInputGrid'
import { nutrientInputsToFacts, toNutrientInputs } from './nutrientInputs'

interface Props {
  targets?: NutritionFacts
  saving: boolean
  onSave: (targets: NutritionFacts) => void
}

export function TargetsPanel({ targets, saving, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [inputs, setInputs] = useState(() => toNutrientInputs(targets))

  // `targets` starts undefined while the caller's `users.me` query is still
  // loading and resolves moments later — a lazy useState initializer alone
  // only seeds the form once at mount, so it would keep showing blank
  // fields even after real targets arrive. Convex's useQuery returns
  // referentially stable results when the value hasn't changed, so this
  // effect only re-fires on a genuine value change (initial load, or after
  // this panel's own save round-trips through the reactive subscription).
  useEffect(() => {
    setInputs(toNutrientInputs(targets))
  }, [targets])

  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium"
      >
        Daily targets
        <span className="opacity-60">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <NutrientInputGrid
            values={inputs}
            onChange={(key, value) =>
              setInputs((prev) => ({ ...prev, [key]: value }))
            }
          />
          <button
            type="button"
            disabled={saving}
            className="mt-3 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 py-1.5 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onSave(nutrientInputsToFacts(inputs))}
          >
            {saving ? 'Saving…' : 'Save targets'}
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/nutrition/TargetsPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add src/components/nutrition/TargetsPanel.tsx src/components/nutrition/TargetsPanel.test.tsx && git commit -m "feat(nutrition): TargetsPanel — collapsible daily-targets editor"
```

---

### Task 6: `DayTotals` component

**Files:**
- Create: `src/components/nutrition/DayTotals.tsx`
- Test: `src/components/nutrition/DayTotals.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/nutrition/DayTotals.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DayTotals } from './DayTotals'

test('renders a total with a target as "value / target"', () => {
  render(<DayTotals totals={{ calories: 1500 }} targets={{ calories: 2000 }} />)
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
  expect(screen.getByText('1500 / 2000')).toBeDefined()
})

test('renders a total without a target as a plain value', () => {
  render(<DayTotals totals={{ protein: 50 }} />)
  expect(screen.getByText('Protein (g)')).toBeDefined()
  expect(screen.getByText('50')).toBeDefined()
})

test('renders nothing when totals and targets are both empty', () => {
  const { container } = render(<DayTotals totals={{}} />)
  expect(container.innerHTML).toBe('')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/nutrition/DayTotals.test.tsx`
Expected: FAIL — cannot resolve `./DayTotals`.

- [ ] **Step 3: Implement `src/components/nutrition/DayTotals.tsx`**

```tsx
import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutritionFacts,
} from '../../../convex/lib/nutrition'

interface Props {
  totals: NutritionFacts
  targets?: NutritionFacts
}

export function DayTotals({ totals, targets }: Props) {
  const present = NUTRIENT_KEYS.filter(
    (key) => totals[key] !== undefined || targets?.[key] !== undefined,
  )
  if (present.length === 0) return null
  return (
    <section className="mb-6 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <h2 className="mb-2 font-medium">Today's totals</h2>
      <dl className="grid gap-2">
        {present.map((key) => {
          const value = totals[key] ?? 0
          const target = targets?.[key]
          const pct =
            target !== undefined && target > 0
              ? Math.min(100, Math.round((value / target) * 100))
              : undefined
          return (
            <div key={key}>
              <div className="flex justify-between text-sm">
                <dt className="opacity-60">{NUTRIENT_LABELS[key]}</dt>
                <dd className="font-medium">
                  {target !== undefined ? `${value} / ${target}` : value}
                </dd>
              </div>
              {pct !== undefined && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--app-accent)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/nutrition/DayTotals.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add src/components/nutrition/DayTotals.tsx src/components/nutrition/DayTotals.test.tsx && git commit -m "feat(nutrition): DayTotals — day totals with progress bars vs targets"
```

---

### Task 7: `ConsumptionEntryRow` component

**Files:**
- Create: `src/components/nutrition/ConsumptionEntryRow.tsx`
- Test: `src/components/nutrition/ConsumptionEntryRow.test.tsx`

Defines the `ConsumptionEntryData` shape used by this and the next several components (mirrors
how `FoodFormValues` is defined once in `FoodForm.tsx` and reused by its callers). Also covers
spec §6's "Recipe/food deleted after logging → entries render from snapshots; source link
disabled" — the row always renders a "View recipe"/"View food" link when `recipeId`/`foodId` is
present on the entry (regardless of whether that source still exists); if the source was
deleted, the destination route's own not-found handling takes over (both `/recipes/$recipeId`
and `/foods/$foodId` already render a "not found" message rather than crashing) — this achieves
the same practical outcome as a proactively-disabled link without an extra existence-check
query per entry.

- [ ] **Step 1: Write the failing tests**

Create `src/components/nutrition/ConsumptionEntryRow.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'

const entry = {
  _id: 'entry1',
  label: 'Oatmeal',
  quantity: 1,
  quantityUnit: 'serving' as const,
  meal: 'breakfast' as const,
  date: '2026-07-18',
  nutrition: { calories: 300 },
}

test('renders label, quantity, unit, and calories', () => {
  render(<ConsumptionEntryRow entry={entry} onUpdate={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('Oatmeal')).toBeDefined()
  expect(screen.getByText(/1 serving/)).toBeDefined()
  expect(screen.getByText(/300 kcal/)).toBeDefined()
})

test('clicking Delete calls onDelete', () => {
  const onDelete = vi.fn()
  render(<ConsumptionEntryRow entry={entry} onUpdate={vi.fn()} onDelete={onDelete} />)
  fireEvent.click(screen.getByText('Delete'))
  expect(onDelete).toHaveBeenCalled()
})

test('shows no source link for a quick-add entry (no recipeId or foodId)', () => {
  render(<ConsumptionEntryRow entry={entry} onUpdate={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.queryByText('View recipe')).toBeNull()
  expect(screen.queryByText('View food')).toBeNull()
})

test('shows a View recipe link when recipeId is set', () => {
  render(
    <ConsumptionEntryRow
      entry={{ ...entry, recipeId: 'recipe1' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const link = screen.getByText('View recipe')
  expect(link.closest('a')).toHaveAttribute('href', '/recipes/recipe1')
})

test('shows a View food link when foodId is set', () => {
  render(
    <ConsumptionEntryRow
      entry={{ ...entry, foodId: 'food1' }}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const link = screen.getByText('View food')
  expect(link.closest('a')).toHaveAttribute('href', '/foods/food1')
})

test('editing quantity and saving calls onUpdate with the new quantity, current meal and date', () => {
  const onUpdate = vi.fn()
  render(<ConsumptionEntryRow entry={entry} onUpdate={onUpdate} onDelete={vi.fn()} />)
  fireEvent.click(screen.getByText('Edit'))
  fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } })
  fireEvent.click(screen.getByText('Save'))
  expect(onUpdate).toHaveBeenCalledWith({
    quantity: 2,
    meal: 'breakfast',
    date: '2026-07-18',
  })
})

test('an invalid quantity does not call onUpdate', () => {
  const onUpdate = vi.fn()
  render(<ConsumptionEntryRow entry={entry} onUpdate={onUpdate} onDelete={vi.fn()} />)
  fireEvent.click(screen.getByText('Edit'))
  fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '0' } })
  fireEvent.click(screen.getByText('Save'))
  expect(onUpdate).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/nutrition/ConsumptionEntryRow.test.tsx`
Expected: FAIL — cannot resolve `./ConsumptionEntryRow`.

- [ ] **Step 3: Implement `src/components/nutrition/ConsumptionEntryRow.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import { MEAL_LABELS, MEAL_NAMES } from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'

export interface ConsumptionEntryData {
  _id: string
  label: string
  quantity: number
  quantityUnit: 'serving' | 'g' | 'ml' | 'piece'
  meal: MealName
  date: string
  nutrition: NutritionFacts
  recipeId?: string
  foodId?: string
}

interface Props {
  entry: ConsumptionEntryData
  onUpdate: (changes: { quantity: number; meal: MealName; date: string }) => void
  onDelete: () => void
}

export function ConsumptionEntryRow({ entry, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [quantityInput, setQuantityInput] = useState(String(entry.quantity))
  const [meal, setMeal] = useState<MealName>(entry.meal)
  const [date, setDate] = useState(entry.date)

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium">{entry.label}</span>
          <span className="ml-2 opacity-60">
            {entry.quantity} {entry.quantityUnit}
            {entry.nutrition.calories !== undefined &&
              ` · ${entry.nutrition.calories} kcal`}
          </span>
          {entry.recipeId && (
            <Link
              to="/recipes/$recipeId"
              params={{ recipeId: entry.recipeId }}
              className="ml-2 text-xs underline"
            >
              View recipe
            </Link>
          )}
          {entry.foodId && (
            <Link
              to="/foods/$foodId"
              params={{ foodId: entry.foodId }}
              className="ml-2 text-xs underline"
            >
              View food
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-xs underline"
          >
            {editing ? 'Close' : 'Edit'}
          </button>
          <button type="button" onClick={onDelete} className="text-xs text-red-700">
            Delete
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs">
            Qty
            <input
              inputMode="decimal"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className="ml-1 w-16 rounded border border-[var(--app-border)] px-1 py-0.5"
            />
          </label>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealName)}
            className="rounded border border-[var(--app-border)] px-1 py-0.5 text-xs"
          >
            {MEAL_NAMES.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-[var(--app-border)] px-1 py-0.5 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              const quantity = Number(quantityInput.replace(',', '.'))
              if (!Number.isFinite(quantity) || quantity <= 0) return
              onUpdate({ quantity, meal, date })
              setEditing(false)
            }}
            className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-2 py-0.5 text-xs font-semibold text-[var(--app-surface)]"
          >
            Save
          </button>
        </div>
      )}
    </li>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/nutrition/ConsumptionEntryRow.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add src/components/nutrition/ConsumptionEntryRow.tsx src/components/nutrition/ConsumptionEntryRow.test.tsx && git commit -m "feat(nutrition): ConsumptionEntryRow — entry display with inline edit/delete"
```

---

### Task 8: `MealSlot` component

**Files:**
- Create: `src/components/nutrition/MealSlot.tsx`
- Test: `src/components/nutrition/MealSlot.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/nutrition/MealSlot.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { MealSlot } from './MealSlot'

const entries = [
  {
    _id: 'e1',
    label: 'Oatmeal',
    quantity: 1,
    quantityUnit: 'serving' as const,
    meal: 'breakfast' as const,
    date: '2026-07-18',
    nutrition: { calories: 300 },
  },
]

test('shows a placeholder when there are no entries', () => {
  render(
    <MealSlot
      label="Breakfast"
      entries={[]}
      onAdd={vi.fn()}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('Nothing logged yet.')).toBeDefined()
})

test('renders entries and clicking + Add calls onAdd', () => {
  const onAdd = vi.fn()
  render(
    <MealSlot
      label="Breakfast"
      entries={entries}
      onAdd={onAdd}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={vi.fn()}
    />,
  )
  expect(screen.getByText('Oatmeal')).toBeDefined()
  fireEvent.click(screen.getByText('+ Add'))
  expect(onAdd).toHaveBeenCalled()
})

test('deleting an entry calls onDeleteEntry with its id', () => {
  const onDeleteEntry = vi.fn()
  render(
    <MealSlot
      label="Breakfast"
      entries={entries}
      onAdd={vi.fn()}
      onUpdateEntry={vi.fn()}
      onDeleteEntry={onDeleteEntry}
    />,
  )
  fireEvent.click(screen.getByText('Delete'))
  expect(onDeleteEntry).toHaveBeenCalledWith('e1')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/nutrition/MealSlot.test.tsx`
Expected: FAIL — cannot resolve `./MealSlot`.

- [ ] **Step 3: Implement `src/components/nutrition/MealSlot.tsx`**

```tsx
import type { MealName } from '../../../convex/lib/consumption'
import type { ConsumptionEntryData } from './ConsumptionEntryRow'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'

interface Props {
  label: string
  entries: ConsumptionEntryData[]
  onAdd: () => void
  onUpdateEntry: (
    id: string,
    changes: { quantity: number; meal: MealName; date: string },
  ) => void
  onDeleteEntry: (id: string) => void
}

export function MealSlot({ label, entries, onAdd, onUpdateEntry, onDeleteEntry }: Props) {
  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{label}</h2>
        <button type="button" onClick={onAdd} className="text-sm underline">
          + Add
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm opacity-60">Nothing logged yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--app-border)]">
          {entries.map((entry) => (
            <ConsumptionEntryRow
              key={entry._id}
              entry={entry}
              onUpdate={(changes) => onUpdateEntry(entry._id, changes)}
              onDelete={() => onDeleteEntry(entry._id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/nutrition/MealSlot.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add src/components/nutrition/MealSlot.tsx src/components/nutrition/MealSlot.test.tsx && git commit -m "feat(nutrition): MealSlot — one meal section with entries and Add"
```

---

### Task 9: `RecipeAddTab` component

**Files:**
- Create: `src/components/nutrition/RecipeAddTab.tsx`

Owns its own Convex hooks (`useQuery(api.recipes.list)`, `useMutation(api.consumption.create)`)
— matches this codebase's precedent for interactive, data-fetching components
(`IssueReporterModal.tsx`, every `/foods/*` route): no dedicated test file, verified in the
final e2e task.

- [ ] **Step 1: Implement `src/components/nutrition/RecipeAddTab.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { computeRecipeEntryNutrition, type MealName } from '../../../convex/lib/consumption'

interface Props {
  date: string
  meal: MealName
  onAdded: () => void
}

export function RecipeAddTab({ date, meal, onAdded }: Props) {
  const recipes = useQuery(api.recipes.list)
  const create = useMutation(api.consumption.create)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  if (recipes === undefined) return <p className="text-sm opacity-60">Loading…</p>

  const withNutrition = recipes.filter((r) => r.nutrition)
  const withoutNutrition = recipes.filter((r) => !r.nutrition)

  return (
    <div className="grid gap-2">
      {withNutrition.length === 0 && (
        <p className="text-sm opacity-60">No recipes with nutrition data yet.</p>
      )}
      {withNutrition.map((recipe) => {
        const quantityInput = quantities[recipe._id] ?? '1'
        return (
          <div key={recipe._id} className="flex items-center justify-between gap-2 text-sm">
            <span>{recipe.title}</span>
            <div className="flex items-center gap-1">
              <input
                inputMode="decimal"
                value={quantityInput}
                onChange={(e) =>
                  setQuantities((prev) => ({ ...prev, [recipe._id]: e.target.value }))
                }
                className="w-14 rounded border border-[var(--app-border)] px-1 py-0.5"
              />
              <span className="opacity-60">servings</span>
              <button
                type="button"
                disabled={submittingId === recipe._id}
                onClick={async () => {
                  const quantity = Number(quantityInput.replace(',', '.'))
                  if (!Number.isFinite(quantity) || quantity <= 0 || !recipe.nutrition) return
                  setSubmittingId(recipe._id)
                  await create({
                    date,
                    meal,
                    recipeId: recipe._id,
                    label: recipe.title,
                    quantity,
                    quantityUnit: 'serving',
                    nutrition: computeRecipeEntryNutrition(recipe.nutrition, quantity),
                  })
                  setSubmittingId(null)
                  onAdded()
                }}
                className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-2 py-0.5 text-xs font-semibold text-[var(--app-surface)] disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        )
      })}
      {withoutNutrition.length > 0 && (
        <div className="mt-2 border-t border-[var(--app-border)] pt-2">
          <p className="mb-1 text-xs opacity-60">
            These recipes have no nutrition data yet:
          </p>
          {withoutNutrition.map((recipe) => (
            <Link
              key={recipe._id}
              to="/recipes/$recipeId"
              params={{ recipeId: recipe._id }}
              className="block text-xs underline"
            >
              {recipe.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add src/components/nutrition/RecipeAddTab.tsx && git commit -m "feat(nutrition): RecipeAddTab — log a recipe by servings"
```

---

### Task 10: `FoodAddTab` component

**Files:**
- Create: `src/components/nutrition/FoodAddTab.tsx`

Reuses `BarcodeScanner` (Phase 2) directly and the `foods.getByBarcode` /
`foodsLookup.lookupBarcode` / `foods.upsertFromOff` functions for the inline scan-and-save
happy path (see the locked decision above). No dedicated test file — same reasoning as Task 9,
plus this component wraps `BarcodeScanner`, which is itself untested beyond its own unit tests.

- [ ] **Step 1: Implement `src/components/nutrition/FoodAddTab.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { computeFoodEntryNutrition, type MealName } from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { BarcodeScanner } from '../foods/BarcodeScanner'

// _id is typed as the branded Id<'foods'>, not a plain string, because this
// state is always populated directly from real Convex query results
// (getByBarcode / get / search) — never round-tripped through a URL param —
// and createEntry's foodId arg requires Id<'foods'>, not string.
interface FoodSummary {
  _id: Id<'foods'>
  name: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  servingSize?: number
}

interface Props {
  date: string
  meal: MealName
  onAdded: () => void
}

export function FoodAddTab({ date, meal, onAdded }: Props) {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(id)
  }, [term])
  const results = useQuery(api.foods.search, { term: debouncedTerm })

  const [selected, setSelected] = useState<FoodSummary | null>(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [quantityInput, setQuantityInput] = useState('')
  const [unit, setUnit] = useState<'g' | 'ml' | 'piece'>('g')
  const [submitting, setSubmitting] = useState(false)

  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)
  const createEntry = useMutation(api.consumption.create)

  async function handleDetected(barcode: string) {
    setResolving(true)
    setNotFoundBarcode(null)
    const existing = await convex.query(api.foods.getByBarcode, { barcode })
    if (existing) {
      setSelected(existing)
      setUnit(existing.baseUnit)
      setResolving(false)
      return
    }
    const mapped = await lookupBarcode({ barcode })
    if (!mapped) {
      setNotFoundBarcode(barcode)
      setResolving(false)
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
    setResolving(false)
  }

  if (selected) {
    return (
      <div className="grid gap-2 text-sm">
        <p className="font-medium">{selected.name}</p>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            className="w-20 rounded border border-[var(--app-border)] px-1 py-0.5"
            placeholder="0"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'g' | 'ml' | 'piece')}
            className="rounded border border-[var(--app-border)] px-1 py-0.5"
          >
            <option value={selected.baseUnit}>{selected.baseUnit}</option>
            {selected.servingSize !== undefined && (
              <option value="piece">
                piece ({selected.servingSize}
                {selected.baseUnit})
              </option>
            )}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded border px-2 py-1 text-xs"
          >
            Back
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              const quantity = Number(quantityInput.replace(',', '.'))
              if (!Number.isFinite(quantity) || quantity <= 0) return
              setSubmitting(true)
              await createEntry({
                date,
                meal,
                foodId: selected._id,
                label: selected.name,
                quantity,
                quantityUnit: unit,
                nutrition: computeFoodEntryNutrition(selected, quantity, unit),
              })
              setSubmitting(false)
              onAdded()
            }}
            className="rounded border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 py-1 text-xs font-semibold text-[var(--app-surface)] disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <BarcodeScanner onDetected={handleDetected} />
      {resolving && <p className="text-xs opacity-60">Looking up…</p>}
      {notFoundBarcode && (
        <p className="text-xs opacity-60">
          Not found.{' '}
          <Link to="/foods/new" search={{ barcode: notFoundBarcode }} className="underline">
            Add it to the foods library
          </Link>{' '}
          first.
        </p>
      )}
      <input
        className="w-full rounded border border-[var(--app-border)] px-2 py-1 text-sm"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search foods…"
      />
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
              {food.brand && <span className="ml-2 opacity-60">{food.brand}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. `api.foods.get`/`api.foods.getByBarcode`/`api.foodsLookup.lookupBarcode`/
`api.foods.upsertFromOff` must already resolve (they were built in Phase 2) — if this fails,
double-check those functions' exact argument/return shapes against `convex/foods.ts` and
`convex/foodsLookup.ts` before assuming this file is wrong.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add src/components/nutrition/FoodAddTab.tsx && git commit -m "feat(nutrition): FoodAddTab — search or scan a food, then log a quantity"
```

---

### Task 11: `QuickAddTab` component

**Files:**
- Create: `src/components/nutrition/QuickAddTab.tsx`

- [ ] **Step 1: Implement `src/components/nutrition/QuickAddTab.tsx`**

```tsx
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { MealName } from '../../../convex/lib/consumption'
import { NutrientInputGrid } from './NutrientInputGrid'
import { inputClass, nutrientInputsToFacts, toNutrientInputs } from './nutrientInputs'

interface Props {
  date: string
  meal: MealName
  onAdded: () => void
}

export function QuickAddTab({ date, meal, onAdded }: Props) {
  const [label, setLabel] = useState('')
  const [inputs, setInputs] = useState(() => toNutrientInputs())
  const [submitting, setSubmitting] = useState(false)
  const create = useMutation(api.consumption.create)

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!label.trim()) return
        setSubmitting(true)
        await create({
          date,
          meal,
          label: label.trim(),
          quantity: 1,
          quantityUnit: 'piece',
          nutrition: nutrientInputsToFacts(inputs),
        })
        setSubmitting(false)
        onAdded()
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Label</span>
        <input
          className={inputClass}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='e.g. "Restaurant meal"'
          required
        />
      </label>
      <NutrientInputGrid
        values={inputs}
        onChange={(key, value) => setInputs((prev) => ({ ...prev, [key]: value }))}
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add src/components/nutrition/QuickAddTab.tsx && git commit -m "feat(nutrition): QuickAddTab — log a typed label + nutrition directly"
```

---

### Task 12: `AddEntryModal` component

**Files:**
- Create: `src/components/nutrition/AddEntryModal.tsx`

Modal shell + tab switcher, styled after `src/components/app/IssueReporterModal.tsx`'s overlay
pattern (backdrop click + Escape to close, inner click stops propagation).

- [ ] **Step 1: Implement `src/components/nutrition/AddEntryModal.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import { MEAL_LABELS } from '../../../convex/lib/consumption'
import { FoodAddTab } from './FoodAddTab'
import { QuickAddTab } from './QuickAddTab'
import { RecipeAddTab } from './RecipeAddTab'

type Tab = 'recipes' | 'foods' | 'quick'

const TABS: Array<[Tab, string]> = [
  ['recipes', 'Recipes'],
  ['foods', 'Foods'],
  ['quick', 'Quick add'],
]

interface Props {
  date: string
  meal: MealName
  onClose: () => void
}

export function AddEntryModal({ date, meal, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('recipes')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-[var(--app-surface)] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add to {MEAL_LABELS[meal]}</h2>
          <button type="button" onClick={onClose} className="text-sm opacity-60">
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-2 border-b border-[var(--app-border)]">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-2 py-1.5 text-sm ${
                tab === id
                  ? 'border-[var(--app-accent)] font-medium'
                  : 'border-transparent opacity-60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'recipes' && <RecipeAddTab date={date} meal={meal} onAdded={onClose} />}
        {tab === 'foods' && <FoodAddTab date={date} meal={meal} onAdded={onClose} />}
        {tab === 'quick' && <QuickAddTab date={date} meal={meal} onAdded={onClose} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add src/components/nutrition/AddEntryModal.tsx && git commit -m "feat(nutrition): AddEntryModal — three-tab picker for logging an entry"
```

---

### Task 13: `/nutrition` day view route

**Files:**
- Create: `src/routes/_app/nutrition/index.tsx`

Route components have no test harness in this repo — verified by typecheck now and end-to-end
in the final task.

- [ ] **Step 1: Implement `src/routes/_app/nutrition/index.tsx`**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  MEAL_LABELS,
  MEAL_NAMES,
  sumFacts,
  type MealName,
} from '../../../../convex/lib/consumption'
import { AddEntryModal } from '../../../components/nutrition/AddEntryModal'
import { DayTotals } from '../../../components/nutrition/DayTotals'
import { MealSlot } from '../../../components/nutrition/MealSlot'
import { TargetsPanel } from '../../../components/nutrition/TargetsPanel'

// Client-local YYYY-MM-DD — matches spec §3.4 ("no server timezone math").
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const Route = createFileRoute('/_app/nutrition/')({
  component: NutritionDay,
  // A YYYY-MM-DD date string is never valid JSON as a number (the dashes
  // make JSON.parse throw), so the router's default search codec falls back
  // to the raw string here — unlike /foods/new's barcode param, no
  // string/number coercion is needed (see that route's fix commit).
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' ? search.date : undefined,
  }),
})

function NutritionDay() {
  const { date: dateParam } = Route.useSearch()
  const navigate = useNavigate()
  const date = dateParam ?? todayLocal()

  const me = useQuery(api.users.me)
  const entries = useQuery(api.consumption.listForDay, { date })
  const updateEntry = useMutation(api.consumption.update)
  const deleteEntry = useMutation(api.consumption.remove)
  const setTargets = useMutation(api.users.setNutritionTargets)

  const [addingMeal, setAddingMeal] = useState<MealName | null>(null)
  const [savingTargets, setSavingTargets] = useState(false)

  const totals = sumFacts((entries ?? []).map((e) => e.nutrition))

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Nutrition</h1>

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate({ search: { date: shiftDate(date, -1) } })}
          className="rounded border px-2 py-1 text-sm"
        >
          ← Prev
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => navigate({ search: { date: e.target.value } })}
          className="rounded border border-[var(--app-border)] px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => navigate({ search: { date: shiftDate(date, 1) } })}
          className="rounded border px-2 py-1 text-sm"
        >
          Next →
        </button>
      </div>

      <TargetsPanel
        targets={me?.nutritionTargets}
        saving={savingTargets}
        onSave={async (targets) => {
          setSavingTargets(true)
          await setTargets({ targets })
          setSavingTargets(false)
        }}
      />

      <DayTotals totals={totals} targets={me?.nutritionTargets} />

      {MEAL_NAMES.map((meal) => (
        <MealSlot
          key={meal}
          label={MEAL_LABELS[meal]}
          entries={(entries ?? []).filter((e) => e.meal === meal)}
          onAdd={() => setAddingMeal(meal)}
          onUpdateEntry={(entryId, changes) =>
            updateEntry({ id: entryId as Id<'consumptionEntries'>, ...changes })
          }
          onDeleteEntry={(entryId) =>
            deleteEntry({ id: entryId as Id<'consumptionEntries'> })
          }
        />
      ))}

      {addingMeal && (
        <AddEntryModal date={date} meal={addingMeal} onClose={() => setAddingMeal(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `pnpm run generate-routes`
Expected: `src/routeTree.gen.ts` updates to include `/_app/nutrition/`.

- [ ] **Step 3: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm check && git add src/routes/_app/nutrition/index.tsx src/routeTree.gen.ts && git commit -m "feat(nutrition): /nutrition day view — date nav, targets, totals, meal slots"
```

---

### Task 14: Module tile

**Files:**
- Modify: `src/lib/modules.ts`

This is the first real navigation entry point for the whole nutrition feature (Phases 1–2 were
link-only, per Phase 2's locked scope decision). Add a `nutrition` entry to the `MODULES` array,
right after `recipes` (same `Kitchen` group — food-adjacent, and keeps it near the Recipes tile
users will already be looking at).

- [ ] **Step 1: Add the module definition**

Before writing this, verify `lucide-react` exports an `Apple` icon (a very standard name in its
icon set, but confirm rather than assume — e.g. `grep -r "export.*Apple" node_modules/lucide-react/dist/lucide-react.d.ts` or check https://lucide.dev/icons/apple). If it doesn't exist for any
reason, use `'Utensils'` instead (already a safe bet — check the same way) and note the
substitution when you commit.

In `src/lib/modules.ts`, add this object to the `MODULES` array immediately after the
`'recipes'` entry:

```ts
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: 'Apple',
    group: 'Kitchen',
    path: '/nutrition',
    status: 'live',
    description: 'Log what you eat and track daily targets.',
  },
```

- [ ] **Step 2: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add src/lib/modules.ts && git commit -m "feat(nutrition): add Nutrition module tile"
```

---

### Task 15: Final verification

**Files:** none new.

- [ ] **Step 1: Full gate**

Run: `pnpm check && pnpm typecheck && pnpm test`
Expected: all PASS, no lint diffs.

- [ ] **Step 2: End-to-end verification via the project's verify skill**

Invoke the project-local `verify` skill and exercise the changed flows in the running app.
`/nutrition` is a new `live` route reachable both via the new module tile on the dashboard and
by direct URL.

1. Navigate to `/nutrition` (or click the new "Nutrition" tile from the dashboard) — confirm
   the day view renders: date navigation, a collapsed "Daily targets" panel, four meal slots
   ("Nothing logged yet." in each), and no totals section (nothing logged, no targets set yet
   → `DayTotals` renders nothing, which is correct).
2. Expand "Daily targets", set Calories to `2000` and Protein to `120`, save. Confirm the
   panel reflects the saved values after a reload (`users.me` reactively updates), and that a
   "Today's totals" section still doesn't appear yet (no entries logged) — targets alone don't
   produce totals.
3. Click "+ Add" on Breakfast → confirm the modal opens with three tabs, defaulting to Recipes.
   If you have a recipe with nutrition data from Phase 1, log one serving; if not, note that
   `RecipeAddTab` correctly shows "No recipes with nutrition data yet." (or a hint link if you
   have recipes without nutrition).
4. Switch to the Foods tab — confirm the manual search box works (reuse a food saved during
   Phase 2's verification, e.g. "Nutella") and search results are clickable, leading to a
   quantity input step. Also test the barcode path: scan or manually enter the real barcode
   `3017620422003` — since it should already exist locally from Phase 2's e2e verification,
   confirm it resolves via the *local* `getByBarcode` short-circuit (near-instant, no "Looking
   up…" OFF round-trip) rather than re-querying Open Food Facts. Enter a quantity in grams and
   confirm "Add" closes the modal and the entry now appears in the Breakfast slot with its
   computed calories shown.
5. Switch to the Quick Add tab on a different meal slot (e.g. Lunch), fill in a label and a
   couple of nutrients, submit — confirm it appears in that slot.
6. Confirm "Today's totals" now appears, summing across all logged entries, with a progress bar
   under Calories and Protein (the two targets set in step 2) and plain values for any other
   nutrient present without a target.
7. On one entry, click "Edit" — change the quantity, confirm the row updates and totals
   recompute reactively. Change the meal via the dropdown and save — confirm the entry moves to
   the new meal slot. Delete an entry — confirm it disappears and totals adjust.
8. Use the date navigation (← Prev / date input / Next →) to move to a different day — confirm
   the meal slots are empty for that day (entries are per-day) and moving back returns you to
   today's logged entries.
9. Check the browser console and network tab for errors introduced by any of the above.

- [ ] **Step 3: Update `CLAUDE.md`'s Convex function list**

In `CLAUDE.md`, extend the line (already lists `foods.ts`, `foodsLookup.ts`,
`lib/offMapping.ts`, `lib/offFetch.ts` from Phase 2):

```
- **Convex** backend (`convex/`) — functions: `recipes.ts`, `groups.ts`, `users.ts`,
  `recipeImport.ts`, `recipeNutrition.ts`, `foods.ts`, `foodsLookup.ts`, `consumption.ts`,
  `lib/sharing.ts`, `lib/nutrition.ts`, `lib/offMapping.ts`, `lib/offFetch.ts`,
  `lib/consumption.ts`. Schema in `convex/schema.ts`.
```

Also update `.claude/skills/verify/SKILL.md`'s route → module map table to add a row for
`/nutrition` (`src/routes/_app/nutrition/index.tsx`, module status `live`), matching the
existing rows for `/foods` and its siblings.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .claude/skills/verify/SKILL.md && git commit -m "docs: note consumption diary modules in CLAUDE.md and the verify skill"
```

---

This completes the nutrition-tracking feature (spec `docs/superpowers/specs/2026-07-17-nutrition-tracking-design.md`) across all three phases: recipe nutrition, the foods library, and the consumption diary with targets.
