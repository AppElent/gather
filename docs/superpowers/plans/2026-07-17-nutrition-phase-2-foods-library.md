# Nutrition Phase 2 — Foods Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A global, reusable foods/products library — barcode scanning via Open Food Facts with a lazy local cache, manual food creation/editing, and `localEdited` protection against silent OFF overwrites — laid down as infrastructure for Phase 3's consumption diary.

**Architecture:** A new `foods` table (global, not per-user/household) with a `by_barcode` index and a name search index. `convex/lib/offMapping.ts` is a pure function mapping raw Open Food Facts JSON to our foods shape (mirrors `recipeParsing.ts`'s role); `convex/lib/offFetch.ts` is a `fetchImpl`-injectable HTTP client (mirrors `nutritionAiEstimate.ts`); `convex/foodsLookup.ts` is the `'use node'` action layer composing them. `convex/foods.ts` holds the CRUD queries/mutations, including the barcode-upsert that makes rescans idempotent. On the frontend, a `BarcodeScanner` component (native `BarcodeDetector` preferred, `zxing-wasm` fallback, manual EAN entry always available) feeds barcodes into the `/foods/new` route, which resolves them to an existing local food, an Open Food Facts match to review, or a blank manual-entry form — the same "resolve on mount, then render a form" shape as the Phase 1 recipe-import route. Two small, behavior-preserving refactors extract a `NutrientInputGrid` component and generalize `NutritionPanel`'s unit label, so recipes and foods share nutrient-entry UI without duplicating it a second time.

**Tech Stack:** Convex (queries/mutations/`'use node'` actions), TanStack Start + Router (file-based routing — remember to run `pnpm run generate-routes` after adding a route file, before typechecking), Vitest + Testing Library (jsdom, with a per-file `node` environment override where a test needs real `fs`/`URL` resolution — see Task 4), Biome, pnpm, `zxing-wasm` (new dependency, added in Task 8).

**Spec:** `docs/superpowers/specs/2026-07-17-nutrition-tracking-design.md` (§3.3, §4.3, §4.4, §6, §7.2, §9)

**Working directory:** the git worktree at `.claude/worktrees/mobile-remote-control-1dfeef` (branch `claude/recipes-nutritional-tracking-a6699c`). All paths below are relative to the repo root.

**Conventions:** Biome formatting — 2-space indent, single quotes, no semicolons unless needed, no tabs. Run `pnpm check` before each commit (auto-fixes + lints). Tests run with `pnpm vitest run <file>` or plain `pnpm test`.

**Scope decision, recorded:** no navigation entry is added this phase. `src/lib/modules.ts` is **not** touched — the `/foods` routes are reachable only by direct URL (typed, bookmarked, or linked from Phase 3's diary once it exists). Phase 3 adds the real "Nutrition" module tile and wires the diary's Foods tab to these same routes/queries. This was an explicit decision the user made when this plan was scoped (three options were offered: add a live "Nutrition" tile now, add a standalone "Foods" tile now, or ship with no tile — the user chose the third). Don't second-guess this later in the plan; it's locked.

**A second locked decision:** foods have no delete/remove mutation in this phase. The spec never asks for one (foods are a shared, global library — removing a row a diary entry might reference later is a Phase 3+ concern with real cross-user impact), and adding one now would be scope creep. If a food is created wrong, it can be edited but not deleted.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/nutrition/nutrientInputs.ts` | Create | Shared `inputClass`, `parseDecimal`, `toNutrientInputs`, `nutrientInputsToFacts` — extracted from `RecipeForm.tsx` |
| `src/components/nutrition/nutrientInputs.test.ts` | Create | Unit tests for the above |
| `src/components/nutrition/NutrientInputGrid.tsx` | Create | The 8-nutrient-input grid, extracted from `RecipeForm.tsx` |
| `src/components/nutrition/NutrientInputGrid.test.tsx` | Create | Component tests |
| `src/components/recipes/RecipeForm.tsx` | Modify | Use the extracted grid/helpers instead of its own copies — no behavior change |
| `src/components/recipes/NutritionPanel.tsx` | Modify | `servings?: number` prop → generic `unitLabel?: string`, so foods (per-100g, no servings) can reuse it |
| `src/components/recipes/NutritionPanel.test.tsx` | Modify | Updated for the new prop |
| `src/routes/_app/recipes/$recipeId.index.tsx` | Modify | Pass `unitLabel` instead of `servings` to `NutritionPanel` — same rendered output |
| `convex/schema.ts` | Modify | New `foods` table: `by_barcode` index + `search_by_name` search index |
| `convex/lib/offMapping.ts` | Create | Pure mapper: raw Open Food Facts JSON → foods shape |
| `convex/lib/offMapping.test.ts` | Create | Unit tests incl. real captured OFF fixtures |
| `convex/lib/__fixtures__/off/*.json` + `README.md` | Create | Real Open Food Facts payloads (spec §7.2) |
| `convex/lib/offFetch.ts` | Create | `fetchImpl`-injectable Open Food Facts HTTP client |
| `convex/lib/offFetch.test.ts` | Create | Mocked-fetch tests |
| `convex/foods.ts` | Create | `search`, `get`, `getByBarcode` queries; `create`, `update`, `upsertFromOff`, `applyOffRefresh` mutations |
| `convex/foodsLookup.ts` | Create | `'use node'` actions: `lookupBarcode`, `refreshFromOff` |
| `package.json` | Modify | Add `zxing-wasm` dependency |
| `src/components/foods/BarcodeScanner.tsx` | Create | Camera scan (native `BarcodeDetector` / `zxing-wasm` fallback) + manual EAN entry |
| `src/components/foods/BarcodeScanner.test.tsx` | Create | Tests for the manual-entry and camera-denied paths |
| `src/components/foods/FoodForm.tsx` | Create | Manual create/edit form: name, brand, base unit, per-100 nutrition, serving size/label |
| `src/components/foods/FoodForm.test.tsx` | Create | Form tests |
| `src/routes/_app/foods/index.tsx` | Create | Search + scan entry page |
| `src/routes/_app/foods/new.tsx` | Create | Resolves a scanned barcode (existing food / OFF match / blank) then creates |
| `src/routes/_app/foods/$foodId.index.tsx` | Create | Detail page: nutrition panel, ODbL attribution, refresh-from-OFF |
| `src/routes/_app/foods/$foodId.edit.tsx` | Create | Edit route wiring `FoodForm` to `foods.update` |

---

### Task 1: Extract `NutrientInputGrid` + nutrient-input helpers from `RecipeForm`

**Files:**
- Create: `src/components/nutrition/nutrientInputs.ts`
- Test: `src/components/nutrition/nutrientInputs.test.ts`
- Create: `src/components/nutrition/NutrientInputGrid.tsx`
- Test: `src/components/nutrition/NutrientInputGrid.test.tsx`
- Modify: `src/components/recipes/RecipeForm.tsx`

This is a pure, behavior-preserving refactor: `RecipeForm`'s existing 9 tests must pass **unmodified** afterward. The nutrient-input grid (8 labeled inputs) and its supporting helpers (`inputClass`, `parseDecimal`, string↔`NutritionFacts` conversion) are identical logic for recipes (per serving) and foods (per 100 g/ml, added later in this plan) — extracting them now avoids copying ~60 lines into `FoodForm` in Task 9.

- [ ] **Step 1: Write the failing tests for the helpers**

Create `src/components/nutrition/nutrientInputs.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from './nutrientInputs'

describe('parseDecimal', () => {
  test('parses plain and Dutch-comma decimals', () => {
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal('12,5')).toBe(12.5)
  })
  test('rejects empty, whitespace-only, negative, and garbage input', () => {
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('   ')).toBeUndefined()
    expect(parseDecimal('-1')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
  })
})

describe('toNutrientInputs', () => {
  test('stringifies present values and leaves absent ones as empty strings', () => {
    expect(toNutrientInputs({ calories: 520, protein: 12.5 })).toEqual({
      calories: '520',
      protein: '12.5',
      carbs: '',
      sugars: '',
      fat: '',
      saturatedFat: '',
      fiber: '',
      salt: '',
    })
  })
  test('returns all-empty strings for undefined input', () => {
    expect(toNutrientInputs(undefined)).toEqual({
      calories: '',
      protein: '',
      carbs: '',
      sugars: '',
      fat: '',
      saturatedFat: '',
      fiber: '',
      salt: '',
    })
  })
})

describe('nutrientInputsToFacts', () => {
  test('builds a NutritionFacts object from parseable inputs, dropping empty/invalid ones', () => {
    const inputs = toNutrientInputs({ calories: 520 })
    inputs.protein = '12,5'
    inputs.fat = 'oops'
    expect(nutrientInputsToFacts(inputs)).toEqual({ calories: 520, protein: 12.5 })
  })
  test('returns an empty object when nothing parses', () => {
    expect(nutrientInputsToFacts(toNutrientInputs(undefined))).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/nutrition/nutrientInputs.test.ts`
Expected: FAIL — cannot resolve `./nutrientInputs`.

- [ ] **Step 3: Implement `src/components/nutrition/nutrientInputs.ts`**

```ts
import {
  NUTRIENT_KEYS,
  type NutrientKey,
  type NutritionFacts,
} from '../../../convex/lib/nutrition'

export const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

// Accepts Dutch decimal commas ("12,5"); empty/invalid/negative → undefined.
export const parseDecimal = (s: string): number | undefined => {
  if (!s.trim()) return undefined
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const toNutrientInputs = (
  facts?: NutritionFacts,
): Record<NutrientKey, string> =>
  Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [
      k,
      facts?.[k] !== undefined ? String(facts[k]) : '',
    ]),
  ) as Record<NutrientKey, string>

export const nutrientInputsToFacts = (
  inputs: Record<NutrientKey, string>,
): NutritionFacts => {
  const facts: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    const value = parseDecimal(inputs[key])
    if (value !== undefined) facts[key] = value
  }
  return facts
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/nutrition/nutrientInputs.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing test for the grid component**

Create `src/components/nutrition/NutrientInputGrid.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { NutrientInputGrid } from './NutrientInputGrid'
import { toNutrientInputs } from './nutrientInputs'

test('renders a labeled input per nutrient and calls onChange with the key', () => {
  const onChange = vi.fn()
  render(
    <NutrientInputGrid
      values={toNutrientInputs(undefined)}
      onChange={onChange}
    />,
  )
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '520' },
  })
  expect(onChange).toHaveBeenCalledWith('calories', '520')
})

test('disables every input when disabled is true', () => {
  render(
    <NutrientInputGrid
      values={toNutrientInputs(undefined)}
      onChange={vi.fn()}
      disabled
    />,
  )
  expect(screen.getByLabelText('Calories (kcal)')).toBeDisabled()
  expect(screen.getByLabelText('Salt (g)')).toBeDisabled()
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run src/components/nutrition/NutrientInputGrid.test.tsx`
Expected: FAIL — cannot resolve `./NutrientInputGrid`.

- [ ] **Step 7: Implement `src/components/nutrition/NutrientInputGrid.tsx`**

```tsx
import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutrientKey,
} from '../../../convex/lib/nutrition'
import { inputClass } from './nutrientInputs'

interface Props {
  values: Record<NutrientKey, string>
  onChange: (key: NutrientKey, value: string) => void
  disabled?: boolean
}

export function NutrientInputGrid({ values, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {NUTRIENT_KEYS.map((key) => (
        <label key={key} className="block text-sm">
          <span className="mb-1 block font-medium">
            {NUTRIENT_LABELS[key]}
          </span>
          <input
            inputMode="decimal"
            className={inputClass}
            value={values[key]}
            onChange={(e) => onChange(key, e.target.value)}
            disabled={disabled}
          />
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm vitest run src/components/nutrition/NutrientInputGrid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Rewrite `RecipeForm.tsx` to use the extracted pieces**

Read the current file first (it has the `ConvexError`-aware estimate-error handling from Phase 1's final fix — do not lose that). Replace the whole file with:

```tsx
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import type {
  NutritionFacts,
  NutritionSource,
} from '../../../convex/lib/nutrition'
import { NutrientInputGrid } from '../nutrition/NutrientInputGrid'
import {
  inputClass,
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from '../nutrition/nutrientInputs'
import { StarRating } from './StarRating'

export interface RecipeFormValues {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  rating?: number
  servings?: number
  nutrition?: NutritionFacts
  nutritionSource?: NutritionSource
}

interface Props {
  initial?: RecipeFormValues
  submitting: boolean
  onSubmit: (values: RecipeFormValues) => void
  onEstimate?: (args: {
    ingredients: string[]
    servings?: number
  }) => Promise<NutritionFacts>
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const csv = (s: string) =>
  s
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)

const parsePositiveInt = (s: string): number | undefined => {
  const n = parseDecimal(s)
  return n && n >= 1 ? Math.round(n) : undefined
}

export function RecipeForm({
  initial,
  submitting,
  onSubmit,
  onEstimate,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [ingredients, setIngredients] = useState(
    (initial?.ingredients ?? []).join('\n'),
  )
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'))
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [rating, setRating] = useState<number | undefined>(initial?.rating)
  const [servings, setServings] = useState(
    initial?.servings !== undefined ? String(initial.servings) : '',
  )
  const [nutritionInputs, setNutritionInputs] = useState(() =>
    toNutrientInputs(initial?.nutrition),
  )
  const [nutritionSource, setNutritionSource] = useState<
    NutritionSource | undefined
  >(initial?.nutritionSource)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const facts = nutrientInputsToFacts(nutritionInputs)
        const hasNutrition = Object.keys(facts).length > 0
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          ingredients: lines(ingredients),
          steps: lines(steps),
          tags: csv(tags),
          rating,
          servings: parsePositiveInt(servings),
          nutrition: hasNutrition ? facts : undefined,
          nutritionSource: hasNutrition
            ? (nutritionSource ?? 'manual')
            : undefined,
        })
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Ingredients</span>
        <textarea
          className={`h-32 ${inputClass}`}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="One per line"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Steps</span>
        <textarea
          className={`h-32 ${inputClass}`}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder="One per line"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tags</span>
        <input
          className={inputClass}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma, separated"
        />
      </label>

      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          Nutrition (per serving)
        </legend>
        <label className="mb-3 block max-w-32 text-sm">
          <span className="mb-1 block font-medium">Servings</span>
          <input
            inputMode="numeric"
            className={inputClass}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="4"
            disabled={estimating}
          />
        </label>
        <NutrientInputGrid
          values={nutritionInputs}
          disabled={estimating}
          onChange={(key, value) => {
            setNutritionInputs((prev) => ({ ...prev, [key]: value }))
            setNutritionSource('manual')
          }}
        />
        {onEstimate && (
          <div className="mt-3">
            <button
              type="button"
              disabled={estimating || lines(ingredients).length === 0}
              className="rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                setEstimating(true)
                setEstimateError(null)
                try {
                  const facts = await onEstimate({
                    ingredients: lines(ingredients),
                    servings: parsePositiveInt(servings),
                  })
                  setNutritionInputs(toNutrientInputs(facts))
                  setNutritionSource('ai')
                } catch (err) {
                  setEstimateError(
                    err instanceof ConvexError
                      ? typeof err.data === 'string'
                        ? err.data
                        : 'Could not estimate nutrition'
                      : err instanceof Error
                        ? err.message
                        : 'Could not estimate nutrition',
                  )
                } finally {
                  setEstimating(false)
                }
              }}
            >
              {estimating ? 'Estimating…' : 'Estimate with AI'}
            </button>
            {estimateError && (
              <p className="mt-2 text-sm text-red-800">{estimateError}</p>
            )}
          </div>
        )}
      </fieldset>

      <div className="block text-sm">
        <span className="mb-1 block font-medium">Rating</span>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save recipe'}
      </button>
    </form>
  )
}
```

- [ ] **Step 10: Run the full RecipeForm test suite — must pass unmodified**

Run: `pnpm vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: PASS, all 9 tests, **with zero edits to the test file**. If any test fails, the refactor changed behavior — fix `RecipeForm.tsx` until it doesn't, don't touch the test file to make it pass.

- [ ] **Step 11: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
pnpm check && git add src/components/nutrition src/components/recipes/RecipeForm.tsx && git commit -m "refactor(nutrition): extract shared NutrientInputGrid from RecipeForm"
```

---

### Task 2: Generalize `NutritionPanel`'s unit label

**Files:**
- Modify: `src/components/recipes/NutritionPanel.tsx`
- Modify: `src/components/recipes/NutritionPanel.test.tsx`
- Modify: `src/routes/_app/recipes/$recipeId.index.tsx`

`NutritionPanel` currently hardcodes "per serving" text and a `servings?: number` prop. Foods have no "servings" concept (they use per-100g/ml + an optional serving size/label) but do want the same facts-grid + source-badge display. Generalize to a caller-supplied `unitLabel` string — same visual output for recipes, reusable for foods in Task 12.

- [ ] **Step 1: Update the failing tests first**

Replace `src/components/recipes/NutritionPanel.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { NutritionPanel } from './NutritionPanel'

test('renders present nutrients with labels, unit label, and the source badge', () => {
  render(
    <NutritionPanel
      nutrition={{ calories: 520, protein: 18.5 }}
      unitLabel="per serving · 4 servings"
      source="imported"
    />,
  )
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
  expect(screen.getByText('520')).toBeDefined()
  expect(screen.getByText('Protein (g)')).toBeDefined()
  expect(screen.getByText('18.5')).toBeDefined()
  expect(screen.getByText('Imported')).toBeDefined()
  expect(screen.getByText('per serving · 4 servings')).toBeDefined()
})

test('hides absent nutrients and badge when source/unitLabel are missing', () => {
  render(<NutritionPanel nutrition={{ fat: 10 }} />)
  expect(screen.queryByText('Calories (kcal)')).toBeNull()
  expect(screen.queryByText('Imported')).toBeNull()
  expect(screen.getByText('Fat (g)')).toBeDefined()
})

test('renders nothing for empty nutrition', () => {
  const { container } = render(<NutritionPanel nutrition={{}} />)
  expect(container.innerHTML).toBe('')
})
```

- [ ] **Step 2: Run to verify the first test fails**

Run: `pnpm vitest run src/components/recipes/NutritionPanel.test.tsx`
Expected: the first test FAILS (no `unitLabel` prop rendered yet); the other 2 still pass (they don't depend on the prop rename).

- [ ] **Step 3: Update `NutritionPanel.tsx`**

```tsx
import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutritionFacts,
  type NutritionSource,
} from '../../../convex/lib/nutrition'

const SOURCE_LABELS: Record<NutritionSource, string> = {
  imported: 'Imported',
  ai: 'AI estimate',
  manual: 'Manual',
}

interface Props {
  nutrition: NutritionFacts
  unitLabel?: string
  source?: NutritionSource
}

export function NutritionPanel({ nutrition, unitLabel, source }: Props) {
  const present = NUTRIENT_KEYS.filter((key) => nutrition[key] !== undefined)
  if (present.length === 0) return null
  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">
          Nutrition{' '}
          {unitLabel && (
            <span className="text-xs font-normal opacity-60">
              {unitLabel}
            </span>
          )}
        </h2>
        {source && (
          <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-xs opacity-70">
            {SOURCE_LABELS[source]}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {present.map((key) => (
          <div key={key}>
            <dt className="opacity-60">{NUTRIENT_LABELS[key]}</dt>
            <dd className="font-medium">{nutrition[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/recipes/NutritionPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Update the one call site — no visual change**

In `src/routes/_app/recipes/$recipeId.index.tsx`, find:

```tsx
      {recipe.nutrition && (
        <NutritionPanel
          nutrition={recipe.nutrition}
          servings={recipe.servings}
          source={recipe.nutritionSource}
        />
      )}
```

Replace with:

```tsx
      {recipe.nutrition && (
        <NutritionPanel
          nutrition={recipe.nutrition}
          unitLabel={
            recipe.servings
              ? `per serving · ${recipe.servings} servings`
              : 'per serving'
          }
          source={recipe.nutritionSource}
        />
      )}
```

This renders byte-identical text to before (`per serving · N servings`, or `per serving` alone when servings is unset — previously that case rendered `per serving` with no `· N servings` suffix, which this matches).

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm check && git add src/components/recipes/NutritionPanel.tsx src/components/recipes/NutritionPanel.test.tsx src/routes/_app/recipes/\$recipeId.index.tsx && git commit -m "refactor(nutrition): generalize NutritionPanel's unit label for reuse by foods"
```

---

### Task 3: Schema — `foods` table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the table**

`nutritionValidator` is already imported in this file (from Phase 1). Add the new table (order in the file doesn't matter — append after `recipes`):

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/schema.ts && git commit -m "feat(nutrition): foods table — global product library with barcode + name search indexes"
```

---

### Task 4: `convex/lib/offMapping.ts` — pure Open Food Facts response mapper

**Files:**
- Create: `convex/lib/offMapping.ts`
- Test: `convex/lib/offMapping.test.ts`
- Create: `convex/lib/__fixtures__/off/*.json` + `README.md`

This is the OFF-side counterpart to Phase 1's `recipeParsing.ts`, and carries the same real-data rigor spec §7.2 asks for: "captured OFF API JSON fixtures (complete, partial nutriments, missing serving size)".

**A confirmed-working barcode to start with:** `3017620422003` (Nutella). Fetching `https://world.openfoodfacts.org/api/v2/product/3017620422003.json` returns `status: 1` and a `product` object whose `nutriments` include (verified during planning): `energy-kcal_100g: 539`, `proteins_100g: 6.3`, `carbohydrates_100g: 57.5`, `sugars_100g: 56.3`, `fat_100g: 30.9`, `saturated-fat_100g: 10.6`, `salt_100g: 0.107` — with **no** `fiber_100g` and **no** `product_name_nl` (this product has `product_name_fr`, not `product_name_nl`, so it exercises the "fall back to `product_name`" path, not the Dutch-preference path). `brands` is `"Nutella, Ferrero, Yum yum"` (comma-separated — take the first).

Find **one more** real product yourself with a `product_name_nl` set (to exercise the Dutch-name-preference path) — browse `https://world.openfoodfacts.org/` for a Dutch supermarket product, or query `https://world.openfoodfacts.org/api/v2/search?categories_tags=<category>&countries_tags=netherlands&page_size=5&fields=code,product_name,product_name_nl,brands,nutriments,serving_size,serving_quantity,status` and pick a hit with `product_name_nl` set, then fetch that barcode's full product JSON the same way. If a search endpoint is flaky, fall back to browsing a known Dutch product category page directly and reading off a barcode.

- [ ] **Step 1: Capture the fixtures**

```bash
mkdir -p convex/lib/__fixtures__/off
curl -s -A "gather-nutrition-tracker/1.0" "https://world.openfoodfacts.org/api/v2/product/3017620422003.json" > convex/lib/__fixtures__/off/nutella.json
```

Then repeat for your second, Dutch-named product into `convex/lib/__fixtures__/off/<name>.json`.

- [ ] **Step 2: Inspect both fixtures**

Read each captured file and note the **exact** values: `status`, `product_name`, `product_name_nl` (present or not), `brands`, every `nutriments.*_100g` field present, `serving_size` (string) and `serving_quantity` (number) if present. These become your test assertions in Step 5 — use the real numbers, not invented ones.

- [ ] **Step 3: Write the failing tests**

Create `convex/lib/offMapping.test.ts`. This example shows the shape for the Nutella fixture (already-verified real values) plus the synthetic edge-case tests — add your second fixture's `describe` block alongside it using **your** captured file's real values:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { mapOffProduct } from './offMapping'

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`./__fixtures__/off/${name}.json`, import.meta.url),
      'utf8',
    ),
  )
}

describe('mapOffProduct — real captures', () => {
  test('nutella.json: full nutriments, no fiber, no Dutch name (falls back to product_name)', () => {
    const mapped = mapOffProduct(fixture('nutella'))
    expect(mapped?.nutritionPer100).toEqual({
      calories: 539,
      protein: 6.3,
      carbs: 57.5,
      sugars: 56.3,
      fat: 30.9,
      saturatedFat: 10.6,
      salt: 0.107,
    })
    expect(mapped?.brand).toBe('Nutella')
    // The real name (product_name, since product_name_nl is absent on this
    // product) — read it from your captured fixture and assert it exactly.
    expect(mapped?.name).toBe('<fill in from your captured nutella.json>')
  })

  // test('<your-second-fixture>.json: Dutch name preferred, ...', () => { ... })
})

describe('mapOffProduct — synthetic edge cases', () => {
  test('returns null when status is not 1 (product not found)', () => {
    expect(mapOffProduct({ status: 0 })).toBeNull()
  })

  test('returns null for malformed or non-object input', () => {
    expect(mapOffProduct(null)).toBeNull()
    expect(mapOffProduct('nope')).toBeNull()
    expect(mapOffProduct({ status: 1 })).toBeNull() // no `product` field
  })

  test('handles partial nutriments — only calories present', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Basic Item',
        nutriments: { 'energy-kcal_100g': 100 },
      },
    })
    expect(mapped).toEqual({
      name: 'Basic Item',
      brand: undefined,
      nutritionPer100: { calories: 100 },
      servingSize: undefined,
      servingLabel: undefined,
    })
  })

  test('prefers the Dutch product name when present', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Generic Name',
        product_name_nl: 'Nederlandse Naam',
        nutriments: {},
      },
    })
    expect(mapped?.name).toBe('Nederlandse Naam')
  })

  test('falls back to an empty name when neither name field is present', () => {
    const mapped = mapOffProduct({ status: 1, product: { nutriments: {} } })
    expect(mapped?.name).toBe('')
  })

  test('parses serving_quantity as servingSize and serving_size string as servingLabel', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Cereal',
        nutriments: {},
        serving_quantity: 30,
        serving_size: '30 g (1 bowl)',
      },
    })
    expect(mapped?.servingSize).toBe(30)
    expect(mapped?.servingLabel).toBe('30 g (1 bowl)')
  })

  test('falls back to parsing a leading number out of serving_size when serving_quantity is absent', () => {
    const mapped = mapOffProduct({
      status: 1,
      product: {
        product_name: 'Cereal',
        nutriments: {},
        serving_size: '45g',
      },
    })
    expect(mapped?.servingSize).toBe(45)
  })
})
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm vitest run convex/lib/offMapping.test.ts`
Expected: FAIL — cannot resolve `./offMapping`.

- [ ] **Step 5: Implement `convex/lib/offMapping.ts`**

```ts
import { type NutritionFacts, parseNutritionValue } from './nutrition'

export interface OffMappedFood {
  name: string
  brand?: string
  nutritionPer100: NutritionFacts
  servingSize?: number
  servingLabel?: string
}

interface OffProduct {
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

// Open Food Facts product names are per-product, not per-request-locale — a
// Dutch name lives in `product_name_nl` alongside the (often English/generic)
// `product_name`. Prefer Dutch since this app's users primarily scan Dutch
// supermarket products; fall back to the generic name, then to an empty
// string the user fills in on the confirmation screen (spec §4.3).
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
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm vitest run convex/lib/offMapping.test.ts`
Expected: PASS, including your real-fixture assertions with the actual values you observed in Step 2. If your real fixture's assertion doesn't match (e.g. you find a genuine mapping gap), fix `offMapping.ts`, not the assertion.

- [ ] **Step 7: Write the README**

Create `convex/lib/__fixtures__/off/README.md`:

```markdown
# Real Open Food Facts fixtures

Captured `/api/v2/product/{barcode}` JSON responses, used by
`convex/lib/offMapping.test.ts` to test the OFF response mapper against real
product data (spec §7.2).

Refresh or add a fixture with:

    curl -s -A "gather-nutrition-tracker/1.0" "https://world.openfoodfacts.org/api/v2/product/<barcode>.json" > convex/lib/__fixtures__/off/<name>.json

| Fixture | Barcode | Captured |
|---|---|---|
| nutella.json | 3017620422003 | 2026-07-17 |
| <yours>.json | <barcode> | <date> |
```

(fill in your second fixture's row with its real barcode and today's date).

- [ ] **Step 8: Full suite + commit**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS.

```bash
pnpm check && git add convex/lib/offMapping.ts convex/lib/offMapping.test.ts convex/lib/__fixtures__/off && git commit -m "feat(nutrition): Open Food Facts response mapper with real-product fixture tests"
```

---

### Task 5: `convex/lib/offFetch.ts` — Open Food Facts HTTP client

**Files:**
- Create: `convex/lib/offFetch.ts`
- Test: `convex/lib/offFetch.test.ts`

Mirrors `convex/lib/nutritionAiEstimate.ts`'s `fetchImpl`-injectable, never-throws pattern (Phase 1).

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/offFetch.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { fetchOffProduct } from './offFetch'

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

describe('fetchOffProduct', () => {
  test('rejects barcodes that are not 8-14 digits without making a request', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchOffProduct('abc', fetchImpl)).toBeNull()
    expect(await fetchOffProduct('123', fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('fetches the correct URL with a User-Agent header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 1 }))
    await fetchOffProduct('3017620422003', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v2/product/3017620422003.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    )
  })

  test('returns the parsed JSON on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({ status: 1, product: { product_name: 'Test' } }),
    )
    expect(await fetchOffProduct('3017620422003', fetchImpl)).toEqual({
      status: 1,
      product: { product_name: 'Test' },
    })
  })

  test('returns null on a non-ok response, a JSON parse failure, and a fetch throw', async () => {
    expect(
      await fetchOffProduct(
        '3017620422003',
        vi.fn().mockResolvedValue(mockResponse({}, false)),
      ),
    ).toBeNull()
    expect(
      await fetchOffProduct(
        '3017620422003',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('bad json')
          },
        } as unknown as Response),
      ),
    ).toBeNull()
    expect(
      await fetchOffProduct(
        '3017620422003',
        vi.fn().mockRejectedValue(new Error('network down')),
      ),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run convex/lib/offFetch.test.ts`
Expected: FAIL — cannot resolve `./offFetch`.

- [ ] **Step 3: Implement `convex/lib/offFetch.ts`**

```ts
const OFF_USER_AGENT =
  'gather-nutrition-tracker/1.0 (https://github.com/AppElent/gather)'
const OFF_TIMEOUT_MS = 10_000
const BARCODE_PATTERN = /^\d{8,14}$/

// Fetches a product from the Open Food Facts API by barcode. Returns the
// raw parsed JSON response, or null on any failure (malformed barcode,
// network error, timeout, non-OK status, invalid JSON) — a barcode lookup
// must never throw; the caller falls back to manual entry either way
// (spec §6).
export async function fetchOffProduct(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  if (!BARCODE_PATTERN.test(barcode)) return null
  let response: Response
  try {
    response = await fetchImpl(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: { 'User-Agent': OFF_USER_AGENT },
        signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
      },
    )
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

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run convex/lib/offFetch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
pnpm check && git add convex/lib/offFetch.ts convex/lib/offFetch.test.ts && git commit -m "feat(nutrition): fetchImpl-injectable Open Food Facts HTTP client"
```

---

### Task 6: `convex/foods.ts` — queries and mutations

**Files:**
- Create: `convex/foods.ts`

No unit tests here — same as `convex/recipes.ts` in Phase 1, this repo has no Convex mutation-test harness; verified by typecheck now and end-to-end in the final task.

- [ ] **Step 1: Implement**

```ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { nutritionValidator } from './lib/nutrition'
import { getCurrentUser } from './lib/sharing'

const foodFields = {
  name: v.string(),
  brand: v.optional(v.string()),
  baseUnit: v.union(v.literal('g'), v.literal('ml')),
  nutritionPer100: nutritionValidator,
  servingSize: v.optional(v.number()),
  servingLabel: v.optional(v.string()),
}

export const search = query({
  args: { term: v.string() },
  handler: async (ctx, args) => {
    if (!args.term.trim()) return []
    return await ctx.db
      .query('foods')
      .withSearchIndex('search_by_name', (q) => q.search('name', args.term))
      .take(20)
  },
})

export const get = query({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => await ctx.db.get(args.id),
})

export const getByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
      .unique(),
})

// Manual creation. If a barcode is supplied and a row already has it (e.g.
// the user scanned first, OFF had nothing, and they're filling it in by
// hand), reuse that row instead of creating a duplicate — the "no duplicate
// row per barcode" invariant from spec §3.3 applies here too, not just to
// `upsertFromOff`.
export const create = mutation({
  args: { ...foodFields, barcode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (args.barcode) {
      const existing = await ctx.db
        .query('foods')
        .withIndex('by_barcode', (q) => q.eq('barcode', args.barcode))
        .unique()
      if (existing) return existing._id
    }
    return await ctx.db.insert('foods', {
      ...args,
      source: 'manual',
      createdBy: user._id,
    })
  },
})

// Any edit through the general edit form counts as a local edit (spec
// §3.3): from this point on, a rescan of this barcode must never silently
// overwrite what the user typed, until they explicitly ask to refresh.
export const update = mutation({
  args: { id: v.id('foods'), ...foodFields, barcode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { id, ...rest } = args
    const food = await ctx.db.get(id)
    if (!food) throw new Error('Food not found')
    await ctx.db.patch(id, { ...rest, localEdited: true })
  },
})

// Called after a successful OFF lookup + user confirmation (spec §4.3):
// upserts by barcode so a rescan never creates a duplicate row. A row a
// human has already edited (`localEdited`) is left untouched — only the
// explicit "refresh from Open Food Facts" flow (`applyOffRefresh` below)
// may overwrite local edits.
export const upsertFromOff = mutation({
  args: { ...foodFields, barcode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { barcode, ...rest } = args
    const existing = await ctx.db
      .query('foods')
      .withIndex('by_barcode', (q) => q.eq('barcode', barcode))
      .unique()
    if (existing) {
      if (!existing.localEdited) await ctx.db.patch(existing._id, rest)
      return existing._id
    }
    return await ctx.db.insert('foods', {
      ...rest,
      barcode,
      source: 'openfoodfacts',
      createdBy: user._id,
    })
  },
})

// Applies a fresh Open Food Facts fetch over an existing row and clears
// localEdited. Only ever called by the `refreshFromOff` action
// (convex/foodsLookup.ts) after an explicit user confirmation — never
// automatically, and never from `update`/`upsertFromOff`.
export const applyOffRefresh = mutation({
  args: { id: v.id('foods'), ...foodFields, barcode: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const { id, ...rest } = args
    const food = await ctx.db.get(id)
    if (!food) throw new Error('Food not found')
    await ctx.db.patch(id, { ...rest, localEdited: false })
  },
})
```

- [ ] **Step 2: Typecheck + full test run**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/foods.ts && git commit -m "feat(nutrition): foods CRUD — search, barcode lookup, create/update, OFF upsert + refresh"
```

---

### Task 7: `convex/foodsLookup.ts` — `'use node'` actions

**Files:**
- Create: `convex/foodsLookup.ts`

- [ ] **Step 1: Implement**

```ts
'use node'

import { ConvexError, v } from 'convex/values'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { fetchOffProduct } from './lib/offFetch'
import { mapOffProduct } from './lib/offMapping'

// Fetches + maps a barcode from Open Food Facts, without saving anything —
// the client shows the result for review and calls `foods.upsertFromOff`
// (or falls back to a blank manual form) only once the user confirms.
export const lookupBarcode = action({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    const raw = await fetchOffProduct(args.barcode)
    if (!raw) return null
    return mapOffProduct(raw)
  },
})

// Re-fetches an existing food's data from Open Food Facts and overwrites it,
// clearing localEdited. Only called after the user explicitly confirms (the
// UI shows a confirm dialog before calling this) — never automatic.
export const refreshFromOff = action({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    const food = await ctx.runQuery(api.foods.get, { id: args.id })
    if (!food) throw new ConvexError('Food not found')
    if (!food.barcode) {
      throw new ConvexError('This food has no barcode to refresh from.')
    }
    const raw = await fetchOffProduct(food.barcode)
    if (!raw) {
      throw new ConvexError('Could not reach Open Food Facts — try again later.')
    }
    const mapped = mapOffProduct(raw)
    if (!mapped) {
      throw new ConvexError('Open Food Facts no longer has this product.')
    }
    await ctx.runMutation(api.foods.applyOffRefresh, {
      id: args.id,
      barcode: food.barcode,
      name: mapped.name,
      brand: mapped.brand,
      baseUnit: food.baseUnit,
      nutritionPer100: mapped.nutritionPer100,
      servingSize: mapped.servingSize,
      servingLabel: mapped.servingLabel,
    })
  },
})
```

- [ ] **Step 2: Regenerate Convex API types**

Run: `pnpm exec convex codegen`
Expected: `convex/_generated/api.d.ts` now references `foods` and `foodsLookup`.

Then: `pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/foodsLookup.ts convex/_generated && git commit -m "feat(nutrition): lookupBarcode + refreshFromOff actions"
```

---

### Task 8: Install `zxing-wasm` + `BarcodeScanner` component

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/components/foods/BarcodeScanner.tsx`
- Test: `src/components/foods/BarcodeScanner.test.tsx`

`zxing-wasm` (v3.x, verified during planning) is the WASM binding for ZXing-C++ the spec calls for (§2: "ZXing (WASM) camera scanning"). Its `zxing-wasm/reader` entry exports `readBarcodes(source, options)`, accepting `ImageData`/`Blob`/etc., returning `Array<{ text: string; format: string }>`. Native `BarcodeDetector` (when the browser provides it) is preferred over it — no WASM download needed.

- [ ] **Step 1: Install the dependency**

```bash
pnpm add zxing-wasm
```

- [ ] **Step 2: Write the failing tests (manual-entry and camera-denied paths only)**

The camera/video frame-scanning loop (native `BarcodeDetector` or `zxing-wasm` against live video) has no test harness in this repo — same "no test harness for the truly environment-dependent bits" precedent as route components — verified end-to-end in the final task. These tests cover what's actually unit-testable: the manual EAN entry fallback, and the camera-permission-denied path.

Create `src/components/foods/BarcodeScanner.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { BarcodeScanner } from './BarcodeScanner'

afterEach(() => {
  vi.restoreAllMocks()
})

test('manual entry keeps only digits and calls onDetected on Look up', () => {
  const onDetected = vi.fn()
  render(<BarcodeScanner onDetected={onDetected} />)

  const input = screen.getByLabelText('Or enter the barcode number')
  fireEvent.change(input, { target: { value: '87a10-398b16000 5' } })
  expect(input).toHaveValue('8710398160005')

  fireEvent.click(screen.getByRole('button', { name: /look up/i }))
  expect(onDetected).toHaveBeenCalledWith('8710398160005')
})

test('the Look up button is disabled until at least 8 digits are entered', () => {
  render(<BarcodeScanner onDetected={vi.fn()} />)
  const lookUp = screen.getByRole('button', { name: /look up/i })
  const input = screen.getByLabelText('Or enter the barcode number')

  expect(lookUp).toBeDisabled()
  fireEvent.change(input, { target: { value: '1234567' } })
  expect(lookUp).toBeDisabled()
  fireEvent.change(input, { target: { value: '12345678' } })
  expect(lookUp).not.toBeDisabled()
})

test('shows a fallback message when camera access is denied', async () => {
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
    new DOMException('Permission denied', 'NotAllowedError'),
  )
  render(<BarcodeScanner onDetected={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }))
  await waitFor(() =>
    expect(
      screen.getByText(/camera access was denied or unavailable/i),
    ).toBeDefined(),
  )
  // The scan button is replaced by the error message, not left dangling.
  expect(screen.queryByRole('button', { name: /scan barcode/i })).toBeNull()
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/components/foods/BarcodeScanner.test.tsx`
Expected: FAIL — cannot resolve `./BarcodeScanner`. (The camera test may also fail differently once the component exists but before `getUserMedia` is mockable — that's expected too; move on to implementation.)

- [ ] **Step 4: Implement `src/components/foods/BarcodeScanner.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { readBarcodes } from 'zxing-wasm/reader'
import { inputClass } from '../nutrition/nutrientInputs'

interface Props {
  onDetected: (barcode: string) => void
}

const ZXING_FORMATS = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'] as const
// The native BarcodeDetector API uses lowercase snake_case format names —
// a different naming convention from zxing-wasm's for the same symbologies,
// so this list is intentionally separate rather than shared.
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

interface NativeBarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [manualEntry, setManualEntry] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (!scanning) return
    let stream: MediaStream | undefined
    let stopped = false
    let intervalId: ReturnType<typeof setInterval> | undefined

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
      } catch {
        setCameraError(
          'Camera access was denied or unavailable — enter the barcode number instead.',
        )
        setScanning(false)
        return
      }
      if (stopped || !videoRef.current) return
      videoRef.current.srcObject = stream
      try {
        await videoRef.current.play()
      } catch {
        // Some browsers reject autoplay despite `muted`; the video element
        // still renders the stream once the user interacts with the page.
      }

      const hasNativeDetector = 'BarcodeDetector' in window
      const nativeDetector: NativeBarcodeDetector | null = hasNativeDetector
        ? new (
            window as unknown as {
              BarcodeDetector: new (opts: {
                formats: string[]
              }) => NativeBarcodeDetector
            }
          ).BarcodeDetector({ formats: NATIVE_FORMATS })
        : null

      intervalId = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video.videoWidth === 0) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx2d = canvas.getContext('2d')
        if (!ctx2d) return
        ctx2d.drawImage(video, 0, 0)

        if (nativeDetector) {
          try {
            const results = await nativeDetector.detect(canvas)
            if (results[0]?.rawValue) onDetected(results[0].rawValue)
          } catch {
            // Ignore per-frame detection failures; the interval tries again.
          }
          return
        }
        const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height)
        const results = await readBarcodes(imageData, {
          formats: [...ZXING_FORMATS],
          tryHarder: true,
        })
        if (results[0]?.text) onDetected(results[0].text)
      }, 500)
    }
    start()

    return () => {
      stopped = true
      if (intervalId) clearInterval(intervalId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [scanning, onDetected])

  return (
    <div className="grid gap-3">
      {!cameraError && (
        <div>
          <button
            type="button"
            onClick={() => setScanning((s) => !s)}
            className="rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm"
          >
            {scanning ? 'Stop camera' : 'Scan barcode'}
          </button>
          {scanning && (
            <div className="relative mt-2 max-w-sm">
              {/* biome-ignore lint/a11y/useMediaCaption: live camera preview, not recorded media */}
              <video
                ref={videoRef}
                className="w-full rounded-[var(--app-radius)]"
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>
      )}
      {cameraError && <p className="text-sm text-red-800">{cameraError}</p>}
      <label className="block max-w-xs text-sm">
        <span className="mb-1 block font-medium">
          Or enter the barcode number
        </span>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            className={inputClass}
            value={manualEntry}
            onChange={(e) =>
              setManualEntry(e.target.value.replace(/\D/g, ''))
            }
            placeholder="8710398160005"
          />
          <button
            type="button"
            disabled={manualEntry.length < 8}
            className="whitespace-nowrap rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onDetected(manualEntry)}
          >
            Look up
          </button>
        </div>
      </label>
    </div>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run src/components/foods/BarcodeScanner.test.tsx`
Expected: PASS (3 tests). If the camera-denied test still fails because jsdom's `HTMLMediaElement.play()` throws "Not implemented" before your mock's rejection is even reached, add this to the top of the test file:

```tsx
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
```

(with `beforeEach` added to the `vitest` import). This is a well-known jsdom gap (no real media pipeline), not a bug in the component.

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm check && git add package.json pnpm-lock.yaml src/components/foods/BarcodeScanner.tsx src/components/foods/BarcodeScanner.test.tsx && git commit -m "feat(nutrition): BarcodeScanner — native BarcodeDetector / zxing-wasm / manual EAN entry"
```

---

### Task 9: `FoodForm` component

**Files:**
- Create: `src/components/foods/FoodForm.tsx`
- Test: `src/components/foods/FoodForm.test.tsx`

Manual create/edit form, reusing `NutrientInputGrid` from Task 1 for the per-100 nutrition fields.

- [ ] **Step 1: Write the failing tests**

Create `src/components/foods/FoodForm.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FoodForm } from './FoodForm'

test('submits name, brand, base unit, and per-100 nutrition', () => {
  const onSubmit = vi.fn()
  render(<FoodForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Hagelslag' },
  })
  fireEvent.change(screen.getByLabelText('Brand'), {
    target: { value: 'De Ruijter' },
  })
  fireEvent.click(screen.getByLabelText('milliliters'))
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '450' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Hagelslag',
      brand: 'De Ruijter',
      baseUnit: 'ml',
      nutritionPer100: { calories: 450 },
    }),
  )
})

test('defaults to grams and omits optional fields when left blank', () => {
  const onSubmit = vi.fn()
  render(<FoodForm onSubmit={onSubmit} submitting={false} />)
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Water' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Water',
      brand: undefined,
      baseUnit: 'g',
      barcode: undefined,
      servingSize: undefined,
      servingLabel: undefined,
      nutritionPer100: {},
    }),
  )
})

test('prefills from initial values, shows a read-only barcode and source note', () => {
  const onSubmit = vi.fn()
  render(
    <FoodForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        name: 'Nutella',
        barcode: '3017620422003',
        nutritionPer100: { calories: 539 },
      }}
      sourceNote="From Open Food Facts — review before saving."
    />,
  )
  expect(screen.getByText(/From Open Food Facts/)).toBeDefined()
  expect(screen.getByText('Barcode: 3017620422003')).toBeDefined()
  expect(screen.getByDisplayValue('Nutella')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: /save food/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Nutella',
      barcode: '3017620422003',
      nutritionPer100: { calories: 539 },
    }),
  )
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/foods/FoodForm.test.tsx`
Expected: FAIL — cannot resolve `./FoodForm`.

- [ ] **Step 3: Implement `src/components/foods/FoodForm.tsx`**

```tsx
import { useState } from 'react'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { NutrientInputGrid } from '../nutrition/NutrientInputGrid'
import {
  inputClass,
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from '../nutrition/nutrientInputs'

export interface FoodFormValues {
  name: string
  brand?: string
  barcode?: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  servingSize?: number
  servingLabel?: string
}

interface Props {
  initial?: Partial<FoodFormValues>
  submitting: boolean
  onSubmit: (values: FoodFormValues) => void
  /** e.g. "From Open Food Facts — review before saving." Shown above the form. */
  sourceNote?: string
}

export function FoodForm({ initial, submitting, onSubmit, sourceNote }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  // Barcode is never user-editable in this form — it's set only via the
  // scan flow's URL param and is read-only display here (see /foods/new.tsx).
  const [barcode] = useState(initial?.barcode ?? '')
  const [baseUnit, setBaseUnit] = useState<'g' | 'ml'>(
    initial?.baseUnit ?? 'g',
  )
  const [nutritionInputs, setNutritionInputs] = useState(() =>
    toNutrientInputs(initial?.nutritionPer100),
  )
  const [servingSize, setServingSize] = useState(
    initial?.servingSize !== undefined ? String(initial.servingSize) : '',
  )
  const [servingLabel, setServingLabel] = useState(
    initial?.servingLabel ?? '',
  )

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const size = parseDecimal(servingSize)
        onSubmit({
          name: name.trim(),
          brand: brand.trim() || undefined,
          barcode: barcode || undefined,
          baseUnit,
          nutritionPer100: nutrientInputsToFacts(nutritionInputs),
          servingSize: size && size > 0 ? size : undefined,
          servingLabel: servingLabel.trim() || undefined,
        })
      }}
    >
      {sourceNote && (
        <p className="rounded-[var(--app-radius)] border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {sourceNote}
        </p>
      )}
      {barcode && <p className="text-xs opacity-60">Barcode: {barcode}</p>}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Brand</span>
        <input
          className={inputClass}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </label>
      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">Base unit</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="baseUnit"
              checked={baseUnit === 'g'}
              onChange={() => setBaseUnit('g')}
            />
            grams
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="baseUnit"
              checked={baseUnit === 'ml'}
              onChange={() => setBaseUnit('ml')}
            />
            milliliters
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          Nutrition per 100 {baseUnit}
        </legend>
        <NutrientInputGrid
          values={nutritionInputs}
          onChange={(key, value) =>
            setNutritionInputs((prev) => ({ ...prev, [key]: value }))
          }
        />
      </fieldset>
      <label className="block max-w-32 text-sm">
        <span className="mb-1 block font-medium">
          Serving size ({baseUnit})
        </span>
        <input
          inputMode="decimal"
          className={inputClass}
          value={servingSize}
          onChange={(e) => setServingSize(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Serving label</span>
        <input
          className={inputClass}
          value={servingLabel}
          onChange={(e) => setServingLabel(e.target.value)}
          placeholder='e.g. "1 slice (30 g)"'
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save food'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/components/foods/FoodForm.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add src/components/foods/FoodForm.tsx src/components/foods/FoodForm.test.tsx && git commit -m "feat(nutrition): FoodForm — manual create/edit with per-100 nutrition"
```

---

### Task 10: `/foods` search + scan entry page

**Files:**
- Create: `src/routes/_app/foods/index.tsx`

Route components have no test harness in this repo — verified by typecheck now and end-to-end in the final task. This is the **first new route file** in this plan — remember Step 2 below every time you add one.

- [ ] **Step 1: Implement**

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { BarcodeScanner } from '../../../components/foods/BarcodeScanner'

export const Route = createFileRoute('/_app/foods/')({
  component: FoodsIndex,
})

function FoodsIndex() {
  const [term, setTerm] = useState('')
  const results = useQuery(api.foods.search, { term })
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Foods</h1>

      <div className="mb-6 rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">Scan a barcode</p>
        <BarcodeScanner
          onDetected={(barcode) =>
            navigate({ to: '/foods/new', search: { barcode } })
          }
        />
      </div>

      <label className="mb-4 block text-sm">
        <span className="mb-1 block font-medium">Search foods</span>
        <input
          className="w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. hagelslag"
        />
      </label>

      <Link
        to="/foods/new"
        className="mb-4 inline-block rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm no-underline"
      >
        Add manually
      </Link>

      <ul className="divide-y divide-[var(--app-border)]">
        {results?.map((food) => (
          <li key={food._id}>
            <Link
              to="/foods/$foodId"
              params={{ foodId: food._id }}
              className="block py-2 no-underline"
            >
              <span className="font-medium">{food.name}</span>
              {food.brand && (
                <span className="ml-2 text-sm opacity-60">{food.brand}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {results?.length === 0 && term.trim() && (
        <p className="text-sm opacity-60">No foods found for "{term}".</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `pnpm run generate-routes`
Expected: `src/routeTree.gen.ts` updates to include `/_app/foods/`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (`api.foods.search` and the `/foods/new`, `/foods/$foodId` route/param types must already resolve — if `/foods/new`/`/foods/$foodId` don't exist as route files yet, `Link to="/foods/new"` will fail to typecheck. Do Tasks 10-13 in order, or stub the missing route files first if working out of order.)

- [ ] **Step 4: Commit**

```bash
pnpm check && git add src/routes/_app/foods/index.tsx src/routeTree.gen.ts && git commit -m "feat(nutrition): foods search + barcode scan entry page"
```

---

### Task 11: `/foods/new` — resolve a scanned barcode, then create

**Files:**
- Create: `src/routes/_app/foods/new.tsx`

Mirrors `src/routes/_app/recipes/new.tsx`'s "auto-run something on mount from a search param, then render a form seeded from the result" shape from Phase 1.

- [ ] **Step 1: Implement**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useConvex, useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import {
  FoodForm,
  type FoodFormValues,
} from '../../../components/foods/FoodForm'

export const Route = createFileRoute('/_app/foods/new')({
  component: NewFood,
  validateSearch: (search: Record<string, unknown>): { barcode?: string } => ({
    barcode: typeof search.barcode === 'string' ? search.barcode : undefined,
  }),
})

function NewFood() {
  const { barcode } = Route.useSearch()
  const navigate = useNavigate()
  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const create = useMutation(api.foods.create)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(Boolean(barcode))
  const [prefill, setPrefill] = useState<{
    values: Partial<FoodFormValues>
    version: number
  }>({ values: { barcode }, version: 0 })
  const [sourceNote, setSourceNote] = useState<string | undefined>()
  // Non-blocking — shown alongside the (still fully usable) blank form when
  // OFF times out or is unreachable, per spec §6 ("same as not-found, plus
  // a non-blocking error toast"). Distinct from `error`, which is reserved
  // for save failures.
  const [lookupNotice, setLookupNotice] = useState<string | null>(null)

  const hasLookedUp = useRef(false)
  // Mount-only: resolve the barcode from the URL to either an existing
  // local food (redirect straight there) or an Open Food Facts match
  // (prefill for review) — mirrors the recipe-import mount-only effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only
  useEffect(() => {
    if (!barcode || hasLookedUp.current) return
    hasLookedUp.current = true
    ;(async () => {
      const existing = await convex.query(api.foods.getByBarcode, { barcode })
      if (existing) {
        navigate({
          to: '/foods/$foodId',
          params: { foodId: existing._id },
          replace: true,
        })
        return
      }
      try {
        const mapped = await lookupBarcode({ barcode })
        if (mapped) {
          setPrefill({
            values: {
              barcode,
              name: mapped.name,
              brand: mapped.brand,
              nutritionPer100: mapped.nutritionPer100,
              servingSize: mapped.servingSize,
              servingLabel: mapped.servingLabel,
            },
            version: Date.now(),
          })
          setSourceNote('From Open Food Facts — review before saving.')
        }
      } catch {
        // A failed OFF lookup (timeout, network error, thrown ConvexError)
        // leaves the form a blank manual entry prefilled with the barcode —
        // never blocks manual entry — but the user still gets a non-blocking
        // heads-up about why nothing was prefilled (spec §6).
        setLookupNotice(
          "Couldn't reach Open Food Facts — fill in the details yourself.",
        )
      } finally {
        setLooking(false)
      }
    })()
  }, [])

  if (looking) {
    return <p className="text-sm opacity-60">Looking up barcode…</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Add food</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {lookupNotice && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {lookupNotice}
        </p>
      )}
      <FoodForm
        key={`form-${prefill.version}`}
        submitting={submitting}
        initial={prefill.values}
        sourceNote={sourceNote}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id = values.barcode
              ? await upsertFromOff({ ...values, barcode: values.barcode })
              : await create(values)
            navigate({ to: '/foods/$foodId', params: { foodId: id } })
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : 'Could not save food'
                : err instanceof Error
                  ? err.message
                  : 'Could not save food',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `pnpm run generate-routes`

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm check && git add src/routes/_app/foods/new.tsx src/routeTree.gen.ts && git commit -m "feat(nutrition): /foods/new resolves a scanned barcode then creates/upserts"
```

---

### Task 12: `/foods/$foodId` — detail page

**Files:**
- Create: `src/routes/_app/foods/\$foodId.index.tsx`

- [ ] **Step 1: Implement**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { NutritionPanel } from '../../../components/recipes/NutritionPanel'

export const Route = createFileRoute('/_app/foods/$foodId/')({
  component: FoodDetail,
})

function FoodDetail() {
  const { foodId } = Route.useParams()
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const refreshFromOff = useAction(api.foodsLookup.refreshFromOff)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  if (food === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (food === null) return <p className="text-sm opacity-60">Food not found.</p>

  return (
    <article className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{food.name}</h1>
          {food.brand && <p className="text-sm opacity-60">{food.brand}</p>}
        </div>
        <Link
          to="/foods/$foodId/edit"
          params={{ foodId }}
          className="rounded border px-3 py-1.5 text-sm no-underline"
        >
          Edit
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/*
        Reusing the "imported"/"manual" NutritionSource vocabulary for a
        food's `source` field ('openfoodfacts'/'manual') rather than adding
        a fourth badge type — "Imported" reads fine for OFF-sourced data too,
        and it avoids new plumbing just for foods. If this reads awkwardly
        once real foods exist, revisit in Phase 3.
      */}
      <NutritionPanel
        nutrition={food.nutritionPer100}
        unitLabel={`per 100 ${food.baseUnit}`}
        source={food.source === 'openfoodfacts' ? 'imported' : 'manual'}
      />
      {food.servingLabel && (
        <p className="mb-4 text-sm opacity-60">Serving: {food.servingLabel}</p>
      )}
      {food.source === 'openfoodfacts' && (
        <p className="mb-4 text-xs opacity-60">
          Nutrition data from{' '}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Open Food Facts
          </a>{' '}
          (ODbL).
        </p>
      )}
      {food.barcode && (
        <button
          type="button"
          disabled={refreshing}
          className="rounded border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          onClick={async () => {
            if (
              !window.confirm(
                'Overwrite this food with the latest data from Open Food Facts? Any local edits will be replaced.',
              )
            ) {
              return
            }
            setRefreshing(true)
            setError(null)
            try {
              await refreshFromOff({ id: food._id })
            } catch (err) {
              setError(
                err instanceof ConvexError
                  ? typeof err.data === 'string'
                    ? err.data
                    : 'Could not refresh from Open Food Facts'
                  : err instanceof Error
                    ? err.message
                    : 'Could not refresh from Open Food Facts',
              )
            } finally {
              setRefreshing(false)
            }
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh from Open Food Facts'}
        </button>
      )}
    </article>
  )
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `pnpm run generate-routes`

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm check && git add "src/routes/_app/foods/\$foodId.index.tsx" src/routeTree.gen.ts && git commit -m "feat(nutrition): food detail page — nutrition panel, ODbL attribution, refresh from OFF"
```

---

### Task 13: `/foods/$foodId/edit` — edit route

**Files:**
- Create: `src/routes/_app/foods/\$foodId.edit.tsx`

- [ ] **Step 1: Implement**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { FoodForm } from '../../../components/foods/FoodForm'

export const Route = createFileRoute('/_app/foods/$foodId/edit')({
  component: EditFood,
})

function EditFood() {
  const { foodId } = Route.useParams()
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const update = useMutation(api.foods.update)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (food === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (food === null) return <p className="text-sm opacity-60">Food not found.</p>

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit food</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <FoodForm
        submitting={submitting}
        initial={{
          name: food.name,
          brand: food.brand,
          barcode: food.barcode,
          baseUnit: food.baseUnit,
          nutritionPer100: food.nutritionPer100,
          servingSize: food.servingSize,
          servingLabel: food.servingLabel,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({ id: food._id, ...values })
            navigate({ to: '/foods/$foodId', params: { foodId } })
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : 'Could not save food'
                : err instanceof Error
                  ? err.message
                  : 'Could not save food',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `pnpm run generate-routes`

- [ ] **Step 3: Typecheck + full test suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm check && git add "src/routes/_app/foods/\$foodId.edit.tsx" src/routeTree.gen.ts && git commit -m "feat(nutrition): food edit route"
```

---

### Task 14: Final verification

**Files:** none new.

- [ ] **Step 1: Full gate**

Run: `pnpm check && pnpm typecheck && pnpm test`
Expected: all PASS, no lint diffs.

- [ ] **Step 2: End-to-end verification via the project's verify skill**

Invoke the project-local `verify` skill and exercise the changed flows in the running app (route → module map: `/foods`, `/foods/new`, `/foods/$foodId`, `/foods/$foodId/edit` are new, `live`-equivalent routes with no dashboard tile — reach them by typing the URL):

1. Navigate to `/foods` — confirm the search box, "Add manually" link, and the `BarcodeScanner`'s "Scan barcode" button + manual-entry fallback all render.
2. Navigate directly to `/foods/new?barcode=3017620422003` (the confirmed-real Nutella barcode) — confirm it shows "Looking up barcode…" then prefills the form from the real Open Food Facts data with the "From Open Food Facts — review before saving." note and a read-only barcode line. Save it; confirm it lands on `/foods/$foodId` showing the nutrition panel (per 100 g), the ODbL attribution line, and a "Refresh from Open Food Facts" button.
3. Navigate to `/foods/new?barcode=3017620422003` again (same barcode) — confirm it redirects straight to the existing food's detail page instead of creating a duplicate (the `getByBarcode` short-circuit).
4. Edit that food (change the name), save, confirm the change persisted and the detail page reflects it.
5. Click "Refresh from Open Food Facts" on that food, confirm the `window.confirm` dialog appears, confirm it, and confirm the name reverts to the real OFF name (proving the refresh overwrote your local edit and cleared `localEdited`) — this specifically exercises the "explicit refresh may overwrite local edits" rule from spec §3.3/§4.4.
6. Navigate to `/foods/new` (no barcode) — confirm a blank form appears immediately (no lookup), fill in a manual food (e.g. name + a couple of nutrients), save, confirm it appears in `/foods` search results by name.
7. Check the browser console and network tab for errors introduced by any of the above.

- [ ] **Step 3: Update `CLAUDE.md`'s Convex function list**

In `CLAUDE.md`, extend the line (already lists `recipeImport.ts`, `recipeNutrition.ts`, `lib/nutrition.ts` from Phase 1):

```
- **Convex** backend (`convex/`) — functions: `recipes.ts`, `groups.ts`, `users.ts`,
  `recipeImport.ts`, `recipeNutrition.ts`, `foods.ts`, `foodsLookup.ts`,
  `lib/sharing.ts`, `lib/nutrition.ts`, `lib/offMapping.ts`, `lib/offFetch.ts`.
  Schema in `convex/schema.ts`.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: note foods library modules in CLAUDE.md convex function list"
```

---

## Phase 3

Consumption diary + targets (spec §3.4, §3.5, §4.5) gets its own plan document once this phase has landed — it adds the `consumptionEntries` table, the `/nutrition` day view with meal slots, the three-tab add picker (Recipes / Foods / Quick add), entry edit/delete, `nutritionTargets` + settings UI, and — per this plan's locked scope decision — the first real navigation entry point for everything built in Phase 2 (a "Nutrition" module tile in `src/lib/modules.ts`, plus the diary's Foods tab linking into these same `/foods` routes and `foods.ts` queries).
