# Nutrition Phase 1 — Recipe Nutrition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recipes gain per-serving nutrition data (EU-label nutrient set) captured via JSON-LD import, AI estimation, or manual entry — with a staleness flag when ingredients change, and a real-Dutch-site JSON-LD fixture test suite.

**Architecture:** A shared `NutritionFacts` type + Convex validator + pure parsers live in `convex/lib/nutrition.ts` and are reused by the schema, mutations, the JSON-LD/AI import pipeline, and React components. The existing import action additionally returns servings + nutrition (tagged `imported` or `ai` by which path produced it). A new `'use node'` action `recipeNutrition.estimateNutrition` is the single text→nutrition seam. Diary/foods are **not** in this phase (see spec §8 — this is phase 1 of 3).

**Tech Stack:** Convex (queries/mutations/actions, `'use node'` for Anthropic calls), TanStack Start + Router, Vitest + Testing Library (jsdom), Biome, pnpm.

**Spec:** `docs/superpowers/specs/2026-07-17-nutrition-tracking-design.md` (§3.1, §3.2, §3.5→phase 3, §4.1, §4.2, §4.6, §5, §6, §7)

**Working directory:** the git worktree at `.claude/worktrees/mobile-remote-control-1dfeef` (branch `claude/recipes-nutritional-tracking-a6699c`). All paths below are relative to the repo root.

**Conventions:** Biome formatting — 2-space indent, single quotes, no semicolons unless needed, no tabs. Run `pnpm check` before each commit (auto-fixes + lints). Tests run with `pnpm test -- run <file>` or plain `pnpm test` (vitest run mode: `pnpm vitest run <file>`).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `convex/lib/nutrition.ts` | Create | NutritionFacts type, Convex validators, value/servings parsers, AI-response sanitizer, staleness rule. Pure — importable from both Convex and React |
| `convex/lib/nutrition.test.ts` | Create | Unit tests for everything above |
| `convex/schema.ts` | Modify | `recipes` += `servings`, `nutrition`, `nutritionSource`, `nutritionStale` |
| `convex/recipes.ts` | Modify | recipeFields += nutrition fields; staleness in `update`; new `setNutrition` mutation + `aiConfigured` query |
| `convex/lib/recipeParsing.ts` | Modify | ParsedRecipe += servings/nutrition; extract `recipeYield` + `nutrition` from JSON-LD |
| `convex/lib/recipeParsing.test.ts` | Modify | Synthetic tests for the new extraction |
| `convex/lib/recipeAiExtract.ts` | Modify | Tool schema + prompt ask for servings + per-serving nutrition |
| `convex/lib/recipeAiExtract.test.ts` | Modify | Tests for new fields |
| `convex/recipeImport.ts` | Modify | Return servings/nutrition/nutritionSource from the action |
| `convex/lib/nutritionAiEstimate.ts` | Create | `estimateNutritionWithAi` — Anthropic tool-use call, fetchImpl-injectable |
| `convex/lib/nutritionAiEstimate.test.ts` | Create | Mocked-fetch tests |
| `convex/recipeNutrition.ts` | Create | `'use node'` action `estimateNutrition` |
| `src/components/recipes/RecipeForm.tsx` | Modify | Nutrition fieldset: servings + 8 nutrient inputs + Estimate-with-AI button |
| `src/components/recipes/RecipeForm.test.tsx` | Modify | Nutrition form tests |
| `src/components/recipes/NutritionPanel.tsx` | Create | Display panel: facts grid + source badge |
| `src/components/recipes/NutritionPanel.test.tsx` | Create | Panel tests |
| `src/routes/_app/recipes/$recipeId.index.tsx` | Modify | Render panel + stale banner (owner-only) with re-estimate |
| `src/routes/_app/recipes/new.tsx` | Modify | Import prefill of nutrition fields; wire onEstimate |
| `src/routes/_app/recipes/$recipeId.edit.tsx` | Modify | Prefill + null-clearing on save; wire onEstimate |
| `convex/lib/__fixtures__/jsonld/*.json` + `README.md` + `capture.mjs` | Create | Real-site JSON-LD fixtures + capture helper |
| `convex/lib/recipeParsingFixtures.test.ts` | Create | Fixture suite (spec §7.1 hard requirement) |

---

### Task 1: Nutrition lib — types, validators, parsers, staleness rule

**Files:**
- Create: `convex/lib/nutrition.ts`
- Test: `convex/lib/nutrition.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/nutrition.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  nextNutritionStale,
  parseNutritionValue,
  parseServings,
  sanitizeNutrition,
} from './nutrition'

describe('parseNutritionValue', () => {
  test('accepts plain non-negative numbers', () => {
    expect(parseNutritionValue(250)).toBe(250)
    expect(parseNutritionValue(0)).toBe(0)
  })
  test('rejects negative and non-finite numbers', () => {
    expect(parseNutritionValue(-5)).toBeUndefined()
    expect(parseNutritionValue(Number.NaN)).toBeUndefined()
  })
  test('parses unit-suffixed strings', () => {
    expect(parseNutritionValue('250 kcal')).toBe(250)
    expect(parseNutritionValue('31g')).toBe(31)
  })
  test('parses Dutch comma decimals', () => {
    expect(parseNutritionValue('12,5 g')).toBe(12.5)
  })
  test('treats comma before exactly three digits as thousands separator', () => {
    expect(parseNutritionValue('1,200 kcal')).toBe(1200)
  })
  test('converts kJ to kcal', () => {
    expect(parseNutritionValue('1046 kJ')).toBe(250)
  })
  test('converts mg to g', () => {
    expect(parseNutritionValue('740 mg')).toBe(0.74)
  })
  test('rejects garbage, empty, and negative strings', () => {
    expect(parseNutritionValue('trace')).toBeUndefined()
    expect(parseNutritionValue('')).toBeUndefined()
    expect(parseNutritionValue('-5 g')).toBeUndefined()
    expect(parseNutritionValue(null)).toBeUndefined()
    expect(parseNutritionValue(undefined)).toBeUndefined()
  })
})

describe('parseServings', () => {
  test('accepts positive numbers, rounding to integer', () => {
    expect(parseServings(4)).toBe(4)
    expect(parseServings(4.5)).toBe(5)
  })
  test('parses numeric strings and "4 personen"', () => {
    expect(parseServings('4')).toBe(4)
    expect(parseServings('4 personen')).toBe(4)
    expect(parseServings('12 stuks')).toBe(12)
  })
  test('takes the lower bound of a range', () => {
    expect(parseServings('4-6')).toBe(4)
  })
  test('takes the first parseable entry of an array', () => {
    expect(parseServings(['4 servings', '1 pie'])).toBe(4)
  })
  test('rejects zero, huge values, and garbage', () => {
    expect(parseServings(0)).toBeUndefined()
    expect(parseServings('1000 ml')).toBeUndefined()
    expect(parseServings('een taart')).toBeUndefined()
    expect(parseServings(undefined)).toBeUndefined()
  })
})

describe('sanitizeNutrition', () => {
  test('keeps known keys with valid numbers', () => {
    expect(sanitizeNutrition({ calories: 520, protein: 31.5 })).toEqual({
      calories: 520,
      protein: 31.5,
    })
  })
  test('drops negatives, strings, and unknown keys', () => {
    expect(
      sanitizeNutrition({ calories: -1, protein: '31', bogus: 5, fat: 10 }),
    ).toEqual({ fat: 10 })
  })
  test('returns undefined for empty or non-object input', () => {
    expect(sanitizeNutrition({})).toBeUndefined()
    expect(sanitizeNutrition({ calories: 'x' })).toBeUndefined()
    expect(sanitizeNutrition(null)).toBeUndefined()
    expect(sanitizeNutrition('food')).toBeUndefined()
  })
})

describe('nextNutritionStale', () => {
  const base = {
    ingredients: ['200 g flour', '2 eggs'],
    servings: 4,
    nutrition: { calories: 300 },
  }
  test('false when the recipe has no nutrition', () => {
    expect(
      nextNutritionStale(
        { ...base, nutrition: undefined },
        { ...base, ingredients: ['bread'], nutrition: undefined },
      ),
    ).toBe(false)
  })
  test('true when ingredients change and nutrition does not', () => {
    expect(
      nextNutritionStale(base, { ...base, ingredients: ['300 g flour'] }),
    ).toBe(true)
  })
  test('true when servings change and nutrition does not', () => {
    expect(nextNutritionStale(base, { ...base, servings: 6 })).toBe(true)
  })
  test('false when nothing relevant changes', () => {
    expect(nextNutritionStale(base, { ...base })).toBe(false)
  })
  test('false (clears) when nutrition changes in the same save', () => {
    expect(
      nextNutritionStale(
        { ...base, nutritionStale: true },
        {
          ...base,
          ingredients: ['300 g flour'],
          nutrition: { calories: 400 },
        },
      ),
    ).toBe(false)
  })
  test('false (clears) when nutrition is removed', () => {
    expect(
      nextNutritionStale({ ...base, nutritionStale: true }, { ...base, nutrition: undefined }),
    ).toBe(false)
  })
  test('stays true while stale and nutrition untouched', () => {
    expect(nextNutritionStale({ ...base, nutritionStale: true }, { ...base })).toBe(
      true,
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run convex/lib/nutrition.test.ts`
Expected: FAIL — cannot resolve `./nutrition`.

- [ ] **Step 3: Implement `convex/lib/nutrition.ts`**

```ts
import { v } from 'convex/values'

export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'carbs',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt',
] as const

export type NutrientKey = (typeof NUTRIENT_KEYS)[number]

/** All values per serving (recipes) or per 100 g/ml (foods, phase 2). Calories in kcal, everything else grams. */
export type NutritionFacts = Partial<Record<NutrientKey, number>>

export const nutritionValidator = v.object({
  calories: v.optional(v.number()),
  protein: v.optional(v.number()),
  carbs: v.optional(v.number()),
  sugars: v.optional(v.number()),
  fat: v.optional(v.number()),
  saturatedFat: v.optional(v.number()),
  fiber: v.optional(v.number()),
  salt: v.optional(v.number()),
})

export const nutritionSourceValidator = v.union(
  v.literal('imported'),
  v.literal('ai'),
  v.literal('manual'),
)

export type NutritionSource = 'imported' | 'ai' | 'manual'

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  calories: 'Calories (kcal)',
  protein: 'Protein (g)',
  carbs: 'Carbs (g)',
  sugars: 'Sugars (g)',
  fat: 'Fat (g)',
  saturatedFat: 'Saturated fat (g)',
  fiber: 'Fiber (g)',
  salt: 'Salt (g)',
}

// JSON-LD nutrition values are free text in the wild: "250 kcal", "12,5 g"
// (Dutch decimal comma), "1,200 kcal" (US thousands comma), "1046 kJ",
// "740 mg". Normalize all of those to a plain non-negative number in the
// canonical unit (kcal / g). Unparseable input → undefined, never a throw —
// nutrition must never fail a recipe import (spec §6).
export function parseNutritionValue(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : undefined
  }
  if (typeof raw !== 'string') return undefined
  if (/-\s*\d/.test(raw)) return undefined
  const match = /(\d+(?:[.,]\d+)?)/.exec(raw)
  if (!match) return undefined
  // Comma before exactly three digits reads as a thousands separator
  // ("1,200 kcal" → 1200); otherwise it's a decimal comma ("12,5" → 12.5).
  const numText = /^\d+,\d{3}$/.test(match[1])
    ? match[1].replace(',', '')
    : match[1].replace(',', '.')
  const value = Number(numText)
  if (!Number.isFinite(value) || value < 0) return undefined
  if (/mg/i.test(raw)) return Math.round((value / 1000) * 100) / 100
  if (/kj/i.test(raw)) return Math.round((value / 4.184) * 10) / 10
  return value
}

// schema.org recipeYield: a number, "4", "4 personen", "4-6" (lower bound
// wins because the regex finds the first integer), or an array of variants.
// Sanity-capped at 100 so strings like "1000 ml" don't become servings.
export function parseServings(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 && raw <= 100
      ? Math.round(raw)
      : undefined
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = parseServings(item)
      if (parsed !== undefined) return parsed
    }
    return undefined
  }
  if (typeof raw !== 'string') return undefined
  const match = /\d+/.exec(raw)
  if (!match) return undefined
  const value = Number(match[0])
  return value > 0 && value <= 100 ? value : undefined
}

// Shape-check an untrusted nutrition object (AI tool output): keep only
// known keys holding finite non-negative numbers; empty result → undefined.
export function sanitizeNutrition(input: unknown): NutritionFacts | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const out: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    const raw = (input as Record<string, unknown>)[key]
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      out[key] = raw
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export interface NutritionStaleState {
  ingredients: string[]
  servings?: number
  nutrition?: NutritionFacts
  nutritionStale?: boolean
}

function nutritionEqual(a?: NutritionFacts, b?: NutritionFacts): boolean {
  if ((a === undefined) !== (b === undefined)) return false
  if (a === undefined || b === undefined) return true
  return NUTRIENT_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null))
}

// Spec §5: the flag goes true when ingredients or servings change in a save
// that doesn't also change nutrition; any nutrition change (set, replace, or
// remove) clears it; once stale it stays stale until nutrition changes.
export function nextNutritionStale(
  before: NutritionStaleState,
  after: Omit<NutritionStaleState, 'nutritionStale'>,
): boolean {
  if (!nutritionEqual(before.nutrition, after.nutrition)) return false
  if (!before.nutrition) return false
  if (before.nutritionStale) return true
  const ingredientsChanged =
    before.ingredients.length !== after.ingredients.length ||
    before.ingredients.some((item, i) => item !== after.ingredients[i])
  const servingsChanged = (before.servings ?? null) !== (after.servings ?? null)
  return ingredientsChanged || servingsChanged
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/nutrition.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
pnpm check && git add convex/lib/nutrition.ts convex/lib/nutrition.test.ts && git commit -m "feat(nutrition): shared nutrition types, validators, parsers, staleness rule"
```

---

### Task 2: Schema — nutrition fields on recipes

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the fields**

In `convex/schema.ts`, add the import and extend the `recipes` table (after `sourceUrl`):

```ts
import { nutritionSourceValidator, nutritionValidator } from './lib/nutrition'
```

```ts
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
```

All four fields optional → no migration needed for existing documents.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (generated `dataModel.d.ts` derives `Doc<'recipes'>` from `schema.ts` directly — no codegen needed for field additions).

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/schema.ts && git commit -m "feat(nutrition): recipes schema gains servings + nutrition fields"
```

---

### Task 3: Recipes functions — fields, staleness, setNutrition, aiConfigured

**Files:**
- Modify: `convex/recipes.ts`

No unit tests here — the staleness rule is already covered by `nutrition.test.ts` (Task 1); the repo has no Convex mutation-test harness, so mutations are verified by typecheck now and end-to-end in Task 12.

- [ ] **Step 1: Extend imports and `recipeFields`**

In `convex/recipes.ts`:

```ts
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  nextNutritionStale,
  nutritionSourceValidator,
  nutritionValidator,
} from './lib/nutrition'
import { getCurrentUser, getMyGroupIds, isVisibleTo } from './lib/sharing'
```

Add to the `recipeFields` object (used by `create`):

```ts
  servings: v.optional(v.number()),
  nutrition: v.optional(nutritionValidator),
  nutritionSource: v.optional(nutritionSourceValidator),
```

- [ ] **Step 2: Rewrite the `update` mutation**

Replace the existing `update` with (null in an optional arg means "clear the field", matching the existing `imageId`/`rating` pattern; absent means "leave unchanged"):

```ts
export const update = mutation({
  args: {
    id: v.id('recipes'),
    ...recipeFields,
    imageId: v.optional(v.union(v.id('_storage'), v.null())),
    rating: v.optional(v.union(v.number(), v.null())),
    servings: v.optional(v.union(v.number(), v.null())),
    nutrition: v.optional(v.union(nutritionValidator, v.null())),
    nutritionSource: v.optional(v.union(nutritionSourceValidator, v.null())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) throw new Error('Recipe not found')
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
    const {
      id,
      sharedGroupIds,
      imageId,
      rating,
      servings,
      nutrition,
      nutritionSource,
      ...rest
    } = args
    const nextServings = servings === null ? undefined : (servings ?? recipe.servings)
    const nextNutrition =
      nutrition === null ? undefined : (nutrition ?? recipe.nutrition)
    const stale = nextNutritionStale(recipe, {
      ingredients: args.ingredients,
      servings: nextServings,
      nutrition: nextNutrition,
    })
    await ctx.db.patch(id, {
      ...rest,
      ...(sharedGroupIds ? { sharedGroupIds } : {}),
      ...(imageId !== undefined ? { imageId: imageId ?? undefined } : {}),
      ...(rating !== undefined ? { rating: rating ?? undefined } : {}),
      servings: nextServings,
      nutrition: nextNutrition,
      nutritionSource: nextNutrition
        ? nutritionSource === null
          ? undefined
          : (nutritionSource ?? recipe.nutritionSource)
        : undefined,
      nutritionStale: stale || undefined,
    })
  },
})
```

(`nextNutritionStale(recipe, …)` works because `Doc<'recipes'>` is structurally assignable to `NutritionStaleState`. Patching a key with value `undefined` removes the field in Convex — that's how `null` clears and how `nutritionStale`/`nutritionSource` stay absent instead of `false`.)

- [ ] **Step 3: Add `setNutrition` mutation and `aiConfigured` query**

Append to `convex/recipes.ts`:

```ts
export const setNutrition = mutation({
  args: {
    id: v.id('recipes'),
    nutrition: nutritionValidator,
    source: v.union(v.literal('ai'), v.literal('manual')),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    const recipe = await ctx.db.get(args.id)
    if (!recipe) throw new Error('Recipe not found')
    if (recipe.ownerId !== user._id) throw new Error('Not the owner')
    await ctx.db.patch(args.id, {
      nutrition: args.nutrition,
      nutritionSource: args.source,
      nutritionStale: undefined,
    })
  },
})

/** Whether the AI-estimation features are configured on this deployment. */
export const aiConfigured = query({
  args: {},
  handler: async () => Boolean(process.env.ANTHROPIC_API_KEY),
})
```

- [ ] **Step 4: Typecheck + full test run**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm check && git add convex/recipes.ts && git commit -m "feat(nutrition): recipe mutations carry nutrition, staleness flag, setNutrition + aiConfigured"
```

---

### Task 4: JSON-LD extraction — servings + nutrition

**Files:**
- Modify: `convex/lib/recipeParsing.ts`
- Test: `convex/lib/recipeParsing.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `convex/lib/recipeParsing.test.ts` (inside the existing `describe('extractJsonLdRecipe', …)`, reusing its `htmlWithJsonLd` helper):

```ts
  test('extracts servings and nutrition from NutritionInformation', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Stamppot',
      recipeIngredient: ['1 kg aardappelen', '500 g boerenkool'],
      recipeInstructions: 'Kook en stamp.',
      recipeYield: '4 personen',
      nutrition: {
        '@type': 'NutritionInformation',
        calories: '520 kcal',
        proteinContent: '18,5 g',
        carbohydrateContent: '65 g',
        sugarContent: '4 g',
        fatContent: '20 g',
        saturatedFatContent: '8 g',
        fiberContent: '9 g',
        sodiumContent: '800 mg',
      },
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.servings).toBe(4)
    expect(recipe?.nutrition).toEqual({
      calories: 520,
      protein: 18.5,
      carbs: 65,
      sugars: 4,
      fat: 20,
      saturatedFat: 8,
      fiber: 9,
      salt: 2, // 800 mg sodium → 0.8 g × 2.5
    })
  })

  test('converts kJ calories and numeric recipeYield', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Soep',
      recipeIngredient: ['water'],
      recipeInstructions: 'Kook.',
      recipeYield: 6,
      nutrition: { '@type': 'NutritionInformation', calories: '1046 kJ' },
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.servings).toBe(6)
    expect(recipe?.nutrition).toEqual({ calories: 250 })
  })

  test('skips unparseable nutrition values without failing the import', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Cake',
      recipeIngredient: ['flour'],
      recipeInstructions: 'Bake.',
      recipeYield: 'een grote taart',
      nutrition: {
        '@type': 'NutritionInformation',
        calories: 'n/a',
        fatContent: '12 g',
      },
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.title).toBe('Cake')
    expect(recipe?.servings).toBeUndefined()
    expect(recipe?.nutrition).toEqual({ fat: 12 })
  })

  test('omits nutrition entirely when absent or empty', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Toast',
      recipeIngredient: ['bread'],
      recipeInstructions: 'Toast it.',
    })
    const recipe = extractJsonLdRecipe(html)
    expect(recipe?.nutrition).toBeUndefined()
    expect(recipe?.servings).toBeUndefined()
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run convex/lib/recipeParsing.test.ts`
Expected: the 4 new tests FAIL (`servings`/`nutrition` undefined); all pre-existing tests still PASS.

- [ ] **Step 3: Implement extraction**

In `convex/lib/recipeParsing.ts`:

Add the import at the top:

```ts
import {
  type NutritionFacts,
  parseNutritionValue,
  parseServings,
} from './nutrition'
```

Extend the interface:

```ts
export interface ParsedRecipe {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  prepMinutes?: number
  imageUrl?: string
  servings?: number
  nutrition?: NutritionFacts
}
```

Add the mapper (above `extractJsonLdRecipe`):

```ts
// schema.org NutritionInformation → NutritionFacts. Values are free text
// ("250 kcal", "12,5 g", "1046 kJ", "800 mg") and conventionally per
// serving. sodiumContent is sodium, not salt — EU labels use salt, so
// convert with the standard ×2.5 factor.
function extractNutrition(value: unknown): NutritionFacts | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const node = value as Record<string, unknown>
  const facts: NutritionFacts = {}
  const calories = parseNutritionValue(node.calories)
  if (calories !== undefined) facts.calories = calories
  const directMappings: Array<[keyof NutritionFacts, string]> = [
    ['protein', 'proteinContent'],
    ['carbs', 'carbohydrateContent'],
    ['sugars', 'sugarContent'],
    ['fat', 'fatContent'],
    ['saturatedFat', 'saturatedFatContent'],
    ['fiber', 'fiberContent'],
  ]
  for (const [key, prop] of directMappings) {
    const parsed = parseNutritionValue(node[prop])
    if (parsed !== undefined) facts[key] = parsed
  }
  const sodium = parseNutritionValue(node.sodiumContent)
  if (sodium !== undefined) facts.salt = Math.round(sodium * 2.5 * 100) / 100
  return Object.keys(facts).length > 0 ? facts : undefined
}
```

Extend the return object of `extractJsonLdRecipe`:

```ts
    return {
      title,
      description,
      ingredients,
      steps,
      tags: tagsOf(node),
      prepMinutes,
      imageUrl: firstImageUrl(node.image),
      servings: parseServings(node.recipeYield),
      nutrition: extractNutrition(node.nutrition),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/recipeParsing.test.ts`
Expected: PASS (new + pre-existing — the existing `toEqual` assertions tolerate the added keys because their values are `undefined` for fixtures without yield/nutrition).

- [ ] **Step 5: Commit**

```bash
pnpm check && git add convex/lib/recipeParsing.ts convex/lib/recipeParsing.test.ts && git commit -m "feat(nutrition): extract servings and per-serving nutrition from recipe JSON-LD"
```

---

### Task 5: AI extraction — servings + nutrition in the tool schema

**Files:**
- Modify: `convex/lib/recipeAiExtract.ts`
- Test: `convex/lib/recipeAiExtract.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('extractRecipeWithAi', …)` in `convex/lib/recipeAiExtract.test.ts`:

```ts
  test('maps servings and sanitized nutrition from the tool response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'extract_recipe',
            input: {
              found: true,
              title: 'Erwtensoep',
              ingredients: ['spliterwten'],
              steps: ['Kook.'],
              servings: 6,
              nutrition: { calories: 400, protein: 22, bogus: 1, fat: -3 },
            },
          },
        ],
      }),
    )
    const result = await extractRecipeWithAi('page', 'test-key', fetchImpl)
    expect(result?.servings).toBe(6)
    expect(result?.nutrition).toEqual({ calories: 400, protein: 22 })
  })

  test('omits servings and nutrition when absent from the tool response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'extract_recipe',
            input: { found: true, title: 'Toast', ingredients: ['bread'], steps: ['Toast.'] },
          },
        ],
      }),
    )
    const result = await extractRecipeWithAi('page', 'test-key', fetchImpl)
    expect(result?.servings).toBeUndefined()
    expect(result?.nutrition).toBeUndefined()
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run convex/lib/recipeAiExtract.test.ts`
Expected: first new test FAILS (servings/nutrition undefined); the rest PASS.

- [ ] **Step 3: Implement**

In `convex/lib/recipeAiExtract.ts`:

Add import:

```ts
import { sanitizeNutrition } from './nutrition'
```

Add to `EXTRACT_TOOL.input_schema.properties` (after `imageUrl`):

```ts
      servings: {
        type: 'number',
        description: 'Number of servings the recipe yields',
      },
      nutrition: {
        type: 'object',
        description:
          'Nutrition per serving. calories in kcal; all other values in grams (salt as salt, not sodium). Use values stated on the page when present, otherwise estimate from the ingredients and servings.',
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          sugars: { type: 'number' },
          fat: { type: 'number' },
          saturatedFat: { type: 'number' },
          fiber: { type: 'number' },
          salt: { type: 'number' },
        },
      },
```

Update the user message content to:

```ts
            content: `Extract the recipe from this web page text. If there's no recipe on the page, set found to false. Report servings and per-serving nutrition: use values stated on the page when present, otherwise estimate them from the ingredients.\n\n${pageText}`,
```

Add to the returned object (after `imageUrl`):

```ts
    servings:
      typeof input.servings === 'number' &&
      Number.isFinite(input.servings) &&
      input.servings > 0
        ? Math.round(input.servings)
        : undefined,
    nutrition: sanitizeNutrition(input.nutrition),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/recipeAiExtract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm check && git add convex/lib/recipeAiExtract.ts convex/lib/recipeAiExtract.test.ts && git commit -m "feat(nutrition): AI recipe extraction returns servings and estimated nutrition"
```

---

### Task 6: Import action — return nutrition with source tag

**Files:**
- Modify: `convex/recipeImport.ts`

The action's return value grows three fields. `nutritionSource` is `'imported'` when the JSON-LD path produced the nutrition, `'ai'` when the AI fallback did. A JSON-LD recipe *without* nutrition returns no source — the user can estimate from the prefilled form instead (spec §4.2); the import itself never makes an extra AI call.

- [ ] **Step 1: Implement**

In `convex/recipeImport.ts`, replace the parse block and return of `importFromUrl`'s handler:

```ts
    let parsed = extractJsonLdRecipe(html)
    let nutritionSource: 'imported' | 'ai' | undefined =
      parsed?.nutrition ? 'imported' : undefined
    if (!parsed) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      parsed = apiKey ? await extractRecipeWithAi(htmlToText(html), apiKey) : null
      if (parsed?.nutrition) nutritionSource = 'ai'
    }
    if (!parsed) throw new ConvexError(NOT_FOUND_MESSAGE)

    const imageId = parsed.imageUrl
      ? await storeRemoteImage(ctx, parsed.imageUrl)
      : undefined
    const imageUrl = imageId ? await ctx.storage.getUrl(imageId) : null

    return {
      title: parsed.title,
      description: parsed.description,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      tags: parsed.tags,
      prepMinutes: parsed.prepMinutes,
      imageId,
      imageUrl,
      sourceUrl: args.url,
      servings: parsed.servings,
      nutrition: parsed.nutrition,
      nutritionSource,
    }
```

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm typecheck && pnpm vitest run convex/recipeImport.test.ts`
Expected: PASS (existing tests cover `isUrlSafeToFetch`/`safeFetch` only — unaffected).

- [ ] **Step 3: Commit**

```bash
pnpm check && git add convex/recipeImport.ts && git commit -m "feat(nutrition): URL import returns servings, nutrition, and its source"
```

---

### Task 7: AI nutrition estimation — lib + action

**Files:**
- Create: `convex/lib/nutritionAiEstimate.ts`
- Create: `convex/recipeNutrition.ts`
- Test: `convex/lib/nutritionAiEstimate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/nutritionAiEstimate.test.ts` (same mocked-fetch pattern as `recipeAiExtract.test.ts`):

```ts
import { describe, expect, test, vi } from 'vitest'
import { estimateNutritionWithAi } from './nutritionAiEstimate'

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

describe('estimateNutritionWithAi', () => {
  test('maps a successful tool_use response to sanitized NutritionFacts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'estimate_nutrition',
            input: { found: true, calories: 420, protein: 18, bogus: 9, fat: -2 },
          },
        ],
      }),
    )
    const result = await estimateNutritionWithAi(
      ['200 g pasta', '100 g spek'],
      4,
      'test-key',
      fetchImpl,
    )
    expect(result).toEqual({ calories: 420, protein: 18 })
    const body = JSON.parse(
      (fetchImpl.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.messages[0].content).toContain('200 g pasta')
    expect(body.messages[0].content).toContain('4 servings')
  })

  test('says "unknown" servings when not provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'estimate_nutrition',
            input: { found: true, calories: 100 },
          },
        ],
      }),
    )
    await estimateNutritionWithAi(['water'], undefined, 'test-key', fetchImpl)
    const body = JSON.parse(
      (fetchImpl.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.messages[0].content).toContain('unknown (assume 4)')
  })

  test('returns null when the model reports not found', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          { type: 'tool_use', name: 'estimate_nutrition', input: { found: false } },
        ],
      }),
    )
    expect(
      await estimateNutritionWithAi(['gravel'], 2, 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null when all values are invalid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'estimate_nutrition',
            input: { found: true, calories: -1 },
          },
        ],
      }),
    )
    expect(
      await estimateNutritionWithAi(['x'], 2, 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null on request failure and on fetch throw', async () => {
    expect(
      await estimateNutritionWithAi(
        ['x'],
        2,
        'test-key',
        vi.fn().mockResolvedValue(mockResponse({}, false)),
      ),
    ).toBeNull()
    expect(
      await estimateNutritionWithAi(
        ['x'],
        2,
        'test-key',
        vi.fn().mockRejectedValue(new Error('network down')),
      ),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run convex/lib/nutritionAiEstimate.test.ts`
Expected: FAIL — cannot resolve `./nutritionAiEstimate`.

- [ ] **Step 3: Implement `convex/lib/nutritionAiEstimate.ts`**

```ts
import { type NutritionFacts, sanitizeNutrition } from './nutrition'

const ANTHROPIC_MODEL = 'claude-sonnet-5'
const ANTHROPIC_MAX_TOKENS = 1024
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const ESTIMATE_TOOL = {
  name: 'estimate_nutrition',
  description:
    'Report estimated per-serving nutrition for a recipe, or that estimation is impossible.',
  input_schema: {
    type: 'object' as const,
    properties: {
      found: {
        type: 'boolean',
        description:
          'False when the ingredients are not food or nutrition cannot be estimated',
      },
      calories: { type: 'number', description: 'kcal per serving' },
      protein: { type: 'number', description: 'grams per serving' },
      carbs: { type: 'number', description: 'grams per serving' },
      sugars: { type: 'number', description: 'grams per serving' },
      fat: { type: 'number', description: 'grams per serving' },
      saturatedFat: { type: 'number', description: 'grams per serving' },
      fiber: { type: 'number', description: 'grams per serving' },
      salt: {
        type: 'number',
        description: 'grams of salt (not sodium) per serving',
      },
    },
    required: ['found'],
  },
}

interface AnthropicToolUseBlock {
  type: 'tool_use'
  name: string
  input: Record<string, unknown>
}

interface AnthropicMessagesResponse {
  content: Array<Record<string, unknown>>
}

// The single "text → nutrition" seam (spec §4.2): a future NEVO or other
// lookup backend replaces this function's internals without touching
// callers, schema, or UI.
export async function estimateNutritionWithAi(
  ingredients: string[],
  servings: number | undefined,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NutritionFacts | null> {
  const servingsText = servings ? `${servings} servings` : 'unknown (assume 4)'
  let response: Response
  try {
    response = await fetchImpl(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        tools: [ESTIMATE_TOOL],
        tool_choice: { type: 'tool', name: 'estimate_nutrition' },
        messages: [
          {
            role: 'user',
            content: `Estimate the nutrition per serving for this recipe. Ingredient lines may be in Dutch or English. Servings: ${servingsText}.\n\nIngredients:\n${ingredients.join('\n')}`,
          },
        ],
      }),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  let data: AnthropicMessagesResponse
  try {
    data = (await response.json()) as AnthropicMessagesResponse
  } catch {
    return null
  }
  if (!Array.isArray(data.content)) return null

  const rawToolUseBlock = data.content.find(
    (block) =>
      block.type === 'tool_use' &&
      block.name === 'estimate_nutrition' &&
      typeof block.input === 'object' &&
      block.input !== null,
  )
  if (!rawToolUseBlock) return null
  const toolUseBlock = rawToolUseBlock as unknown as AnthropicToolUseBlock
  if (toolUseBlock.input.found !== true) return null
  return sanitizeNutrition(toolUseBlock.input) ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/nutritionAiEstimate.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the action `convex/recipeNutrition.ts`**

```ts
'use node'

import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { estimateNutritionWithAi } from './lib/nutritionAiEstimate'

export const estimateNutrition = action({
  args: {
    ingredients: v.array(v.string()),
    servings: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Not authenticated')
    if (args.ingredients.length === 0) {
      throw new ConvexError('Add some ingredients first.')
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new ConvexError('AI estimation is not configured.')
    const nutrition = await estimateNutritionWithAi(
      args.ingredients,
      args.servings,
      apiKey,
    )
    if (!nutrition) {
      throw new ConvexError("Couldn't estimate nutrition — try entering it manually.")
    }
    return nutrition
  },
})
```

- [ ] **Step 6: Regenerate Convex API types (new module)**

Run: `pnpm exec convex codegen`
Expected: `convex/_generated/api.d.ts` now includes `recipeNutrition`. If codegen complains about a missing deployment config, copy the untracked env file from the main checkout first: `cp /d/Dev/gather/.env.local .env.local` (never commit it), then re-run.

Then: `pnpm typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
pnpm check && git add convex/lib/nutritionAiEstimate.ts convex/lib/nutritionAiEstimate.test.ts convex/recipeNutrition.ts convex/_generated && git commit -m "feat(nutrition): estimateNutrition action — AI text-to-nutrition seam"
```

---

### Task 8: RecipeForm — nutrition fieldset

**Files:**
- Modify: `src/components/recipes/RecipeForm.tsx`
- Test: `src/components/recipes/RecipeForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/recipes/RecipeForm.test.tsx`:

```tsx
test('submits typed nutrition as manual source', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.change(screen.getByLabelText('Servings'), {
    target: { value: '4' },
  })
  fireEvent.change(screen.getByLabelText('Calories (kcal)'), {
    target: { value: '520' },
  })
  fireEvent.change(screen.getByLabelText('Protein (g)'), {
    target: { value: '12,5' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      servings: 4,
      nutrition: { calories: 520, protein: 12.5 },
      nutritionSource: 'manual',
    }),
  )
})

test('omits nutrition when all nutrient fields are empty', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ nutrition: undefined, nutritionSource: undefined }),
  )
})

test('keeps the imported source when prefilled nutrition is untouched', () => {
  const onSubmit = vi.fn()
  render(
    <RecipeForm
      onSubmit={onSubmit}
      submitting={false}
      initial={{
        title: 'Soep',
        ingredients: ['water'],
        steps: ['kook'],
        tags: [],
        nutrition: { calories: 300 },
        nutritionSource: 'imported',
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      nutrition: { calories: 300 },
      nutritionSource: 'imported',
    }),
  )
})

test('estimate button fills nutrition and submits ai source', async () => {
  const onSubmit = vi.fn()
  const onEstimate = vi.fn().mockResolvedValue({ calories: 300, fat: 10 })
  render(
    <RecipeForm onSubmit={onSubmit} submitting={false} onEstimate={onEstimate} />,
  )

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Soep' },
  })
  fireEvent.change(screen.getByLabelText('Ingredients'), {
    target: { value: 'water\nwortel' },
  })
  fireEvent.click(screen.getByRole('button', { name: /estimate with ai/i }))
  await screen.findByDisplayValue('300')

  expect(onEstimate).toHaveBeenCalledWith({
    ingredients: ['water', 'wortel'],
    servings: undefined,
  })
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      nutrition: { calories: 300, fat: 10 },
      nutritionSource: 'ai',
    }),
  )
})

test('hides the estimate button when onEstimate is not provided', () => {
  render(<RecipeForm onSubmit={vi.fn()} submitting={false} />)
  expect(screen.queryByRole('button', { name: /estimate/i })).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: 5 new tests FAIL (missing labels/props); 2 pre-existing tests PASS.

- [ ] **Step 3: Implement the nutrition fieldset**

Rewrite `src/components/recipes/RecipeForm.tsx`. The changes: extract the repeated input class string to a module constant `inputClass` (and use it for the existing inputs — same string, no visual change), extend the interface, add nutrition state + helpers + fieldset before the Rating block:

```tsx
import { useState } from 'react'
import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutrientKey,
  type NutritionFacts,
  type NutritionSource,
} from '../../../convex/lib/nutrition'
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

const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]'

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

// Accepts Dutch decimal commas ("12,5"); empty/invalid/negative → undefined.
const parseDecimal = (s: string): number | undefined => {
  if (!s.trim()) return undefined
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
const parsePositiveInt = (s: string): number | undefined => {
  const n = parseDecimal(s)
  return n && n >= 1 ? Math.round(n) : undefined
}
const toInputs = (facts?: NutritionFacts): Record<NutrientKey, string> =>
  Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, facts?.[k] !== undefined ? String(facts[k]) : '']),
  ) as Record<NutrientKey, string>

export function RecipeForm({ initial, submitting, onSubmit, onEstimate }: Props) {
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
    toInputs(initial?.nutrition),
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
        const facts: NutritionFacts = {}
        for (const key of NUTRIENT_KEYS) {
          const value = parseDecimal(nutritionInputs[key])
          if (value !== undefined) facts[key] = value
        }
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
          nutritionSource: hasNutrition ? (nutritionSource ?? 'manual') : undefined,
        })
      }}
    >
      {/* Title / Description / Ingredients / Steps / Tags blocks stay exactly
          as they are today, with their long className replaced by {inputClass}. */}

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
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUTRIENT_KEYS.map((key) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium">
                {NUTRIENT_LABELS[key]}
              </span>
              <input
                inputMode="decimal"
                className={inputClass}
                value={nutritionInputs[key]}
                onChange={(e) => {
                  setNutritionInputs((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                  setNutritionSource('manual')
                }}
              />
            </label>
          ))}
        </div>
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
                  setNutritionInputs(toInputs(facts))
                  setNutritionSource('ai')
                } catch (err) {
                  setEstimateError(
                    err instanceof Error
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

      {/* Rating block and submit button stay as they are today. */}
    </form>
  )
}
```

(The comment placeholders above mean "keep the existing JSX unchanged" — do not delete those blocks; only swap their `className` strings for `{inputClass}` where identical.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: all 7 PASS.

- [ ] **Step 5: Typecheck (routes still compile — they pass a subset of the now-larger optional interface)**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm check && git add src/components/recipes/RecipeForm.tsx src/components/recipes/RecipeForm.test.tsx && git commit -m "feat(nutrition): recipe form nutrition fieldset with AI estimate button"
```

---

### Task 9: NutritionPanel component

**Files:**
- Create: `src/components/recipes/NutritionPanel.tsx`
- Test: `src/components/recipes/NutritionPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/recipes/NutritionPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { NutritionPanel } from './NutritionPanel'

test('renders present nutrients with labels and the source badge', () => {
  render(
    <NutritionPanel
      nutrition={{ calories: 520, protein: 18.5 }}
      servings={4}
      source="imported"
    />,
  )
  expect(screen.getByText('Calories (kcal)')).toBeDefined()
  expect(screen.getByText('520')).toBeDefined()
  expect(screen.getByText('Protein (g)')).toBeDefined()
  expect(screen.getByText('18.5')).toBeDefined()
  expect(screen.getByText('Imported')).toBeDefined()
  expect(screen.getByText(/4 servings/)).toBeDefined()
})

test('hides absent nutrients and badge when source is missing', () => {
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/recipes/NutritionPanel.test.tsx`
Expected: FAIL — cannot resolve `./NutritionPanel`.

- [ ] **Step 3: Implement `src/components/recipes/NutritionPanel.tsx`**

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
  servings?: number
  source?: NutritionSource
}

export function NutritionPanel({ nutrition, servings, source }: Props) {
  const present = NUTRIENT_KEYS.filter((key) => nutrition[key] !== undefined)
  if (present.length === 0) return null
  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">
          Nutrition{' '}
          <span className="text-xs font-normal opacity-60">
            per serving{servings ? ` · ${servings} servings` : ''}
          </span>
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/recipes/NutritionPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm check && git add src/components/recipes/NutritionPanel.tsx src/components/recipes/NutritionPanel.test.tsx && git commit -m "feat(nutrition): NutritionPanel display component"
```

---

### Task 10: Recipe detail page — panel + stale banner

**Files:**
- Modify: `src/routes/_app/recipes/$recipeId.index.tsx`

Route components have no test harness in this repo; verified by typecheck now and end-to-end in Task 12.

- [ ] **Step 1: Implement**

In `src/routes/_app/recipes/$recipeId.index.tsx`:

Update imports:

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { NutritionPanel } from '../../../components/recipes/NutritionPanel'
```

Add hooks inside `RecipeDetail` (after the existing `remove`):

```tsx
  const me = useQuery(api.users.me)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const setNutrition = useMutation(api.recipes.setNutrition)
  const [estimating, setEstimating] = useState(false)
```

Insert directly after the `recipe.sourceUrl && (…)` block:

```tsx
      {recipe.nutritionStale && me && recipe.ownerId === me._id && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="mb-2">
            Ingredients changed since nutrition was calculated — re-estimate?
          </p>
          <div className="flex gap-2">
            {aiConfigured && (
              <button
                type="button"
                disabled={estimating}
                className="rounded border border-amber-400 px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                onClick={async () => {
                  setEstimating(true)
                  setError(null)
                  try {
                    const nutrition = await estimateNutrition({
                      ingredients: recipe.ingredients,
                      servings: recipe.servings,
                    })
                    await setNutrition({
                      id: recipe._id,
                      nutrition,
                      source: 'ai',
                    })
                  } catch (err) {
                    setError(
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
                {estimating ? 'Estimating…' : 'Re-estimate with AI'}
              </button>
            )}
            <Link
              to="/recipes/$recipeId/edit"
              params={{ recipeId }}
              className="rounded border border-amber-400 px-2 py-1 text-xs font-medium no-underline"
            >
              Edit manually
            </Link>
          </div>
        </div>
      )}
      {recipe.nutrition && (
        <NutritionPanel
          nutrition={recipe.nutrition}
          servings={recipe.servings}
          source={recipe.nutritionSource}
        />
      )}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
pnpm check && git add src/routes/_app/recipes/\$recipeId.index.tsx && git commit -m "feat(nutrition): recipe page nutrition panel and stale-nutrition banner"
```

---

### Task 11: Route wiring — new.tsx import prefill + edit.tsx

**Files:**
- Modify: `src/routes/_app/recipes/new.tsx`
- Modify: `src/routes/_app/recipes/$recipeId.edit.tsx`

- [ ] **Step 1: Wire `new.tsx`**

Add `useQuery` to the convex/react import; add hooks after `importFromUrl`:

```tsx
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
```

In `runImport`, extend the `setImported` values with the three new fields:

```tsx
      setImported({
        values: {
          title: result.title,
          description: result.description,
          ingredients: result.ingredients,
          steps: result.steps,
          tags: result.tags,
          servings: result.servings,
          nutrition: result.nutrition,
          nutritionSource: result.nutritionSource,
        },
        version: Date.now(),
      })
```

Give `RecipeForm` the estimate callback (only when the deployment has a key):

```tsx
      <RecipeForm
        key={`form-${imported?.version ?? 'blank'}`}
        submitting={submitting}
        initial={imported?.values}
        onEstimate={
          aiConfigured ? (args) => estimateNutrition(args) : undefined
        }
        onSubmit={async (values) => {
```

(the `onSubmit` body is unchanged — `create({ ...values, … })` already passes the new optional fields, which Task 3 added to `recipeFields`).

- [ ] **Step 2: Wire `edit.tsx`**

Add to the convex/react import: `useAction`. Add hooks after `update`:

```tsx
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
```

Extend `initial`:

```tsx
        initial={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          rating: recipe.rating,
          servings: recipe.servings,
          nutrition: recipe.nutrition,
          nutritionSource: recipe.nutritionSource,
        }}
```

Add the estimate prop and null-clearing on save (null = "field was emptied", matching the `rating`/`imageId` pattern so clearing actually persists):

```tsx
        onEstimate={
          aiConfigured ? (args) => estimateNutrition(args) : undefined
        }
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({
              id: recipe._id,
              ...values,
              rating: values.rating ?? null,
              imageId: imageId ?? null,
              servings: values.servings ?? null,
              nutrition: values.nutrition ?? null,
              nutritionSource: values.nutritionSource ?? null,
            })
```

- [ ] **Step 3: Typecheck + full test suite**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm check && git add src/routes/_app/recipes/new.tsx src/routes/_app/recipes/\$recipeId.edit.tsx && git commit -m "feat(nutrition): wire import prefill and AI estimation into recipe routes"
```

---

### Task 12: Real-site JSON-LD fixture suite (spec §7.1 — hard requirement)

**Files:**
- Create: `convex/lib/__fixtures__/jsonld/capture.mjs`
- Create: `convex/lib/__fixtures__/jsonld/<site>.json` (≥ 6 fixtures)
- Create: `convex/lib/__fixtures__/jsonld/README.md`
- Test: `convex/lib/recipeParsingFixtures.test.ts`

This task is deliberately exploratory: capture real payloads, **inspect them**, then write assertions that match the actual content. If a site's structure breaks extraction, extending the parser here is the point of the exercise — fix it in `recipeParsing.ts`/`nutrition.ts` with a synthetic regression test added to the respective test file, then continue.

- [ ] **Step 1: Create the capture helper**

Create `convex/lib/__fixtures__/jsonld/capture.mjs`:

```js
#!/usr/bin/env node
// Capture the schema.org Recipe JSON-LD block from a recipe page into a
// fixture file next to this script.
// Usage: node convex/lib/__fixtures__/jsonld/capture.mjs <url> <fixture-name>
import { writeFileSync } from 'node:fs'

const [url, name] = process.argv.slice(2)
if (!url || !name) {
  console.error('Usage: node capture.mjs <url> <fixture-name>')
  process.exit(1)
}
const res = await fetch(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Accept: 'text/html',
  },
})
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const html = await res.text()
const re =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const blocks = [...html.matchAll(re)].map((m) => m[1].trim())
const recipeBlock = blocks.find((b) => b.includes('"Recipe"'))
if (!recipeBlock) {
  console.error(`No Recipe JSON-LD found (${blocks.length} ld+json blocks)`)
  process.exit(1)
}
writeFileSync(
  new URL(`./${name}.json`, import.meta.url),
  `${JSON.stringify(JSON.parse(recipeBlock), null, 2)}\n`,
)
console.log(`Saved ${name}.json`)
```

- [ ] **Step 2: Capture fixtures from real sites**

Target list (need **≥ 6 total, ≥ 4 Dutch**, structural variety). Browse each site, pick any recipe page — prefer ones showing nutrition ("voedingswaarden") on the page — and run the capture:

```bash
node convex/lib/__fixtures__/jsonld/capture.mjs "<recipe-url>" <site-name>
```

| Fixture name | Site | Notes |
|---|---|---|
| `leukerecepten` | leukerecepten.nl | WP Recipe Maker structure |
| `lekkerensimpel` | lekkerensimpel.com | WP Recipe Maker, HowToSection steps |
| `miljuschka` | miljuschka.nl | WP Recipe Maker, un-decoded HTML entities |
| `uitpaulineskeuken` | uitpaulineskeuken.nl | Dutch food blog |
| `ah` | ah.nl/allerhande | Corporate site, `@graph` wrapping — may block bots |
| `24kitchen` | 24kitchen.nl | TV-network site |
| `jumbo` | jumbo.com/recepten | Corporate site — may block bots |
| `bbcgoodfood` | bbcgoodfood.com | International, usually has full nutrition |
| `allrecipes` | allrecipes.com | International |

If a site blocks the fetch (403/bot wall) or has no Recipe JSON-LD, skip it and substitute another Dutch recipe site (e.g. 15gram.be, keukenliefde.nl, brenda-kookt.nl, ohmyfoodness.nl, culy.nl) until ≥ 6 fixtures exist. Record every URL + capture date for the README as you go.

- [ ] **Step 3: Inspect each fixture**

Read each captured `.json` and note: the recipe `name`, whether `recipeYield` exists (and its shape — string/number/array), whether `nutrition` exists and which properties it has, and any structural oddity (`@graph`, `mainEntity`, arrays where strings are expected). These observations become the assertions.

- [ ] **Step 4: Write the fixture test file (failing first where extraction gaps exist)**

Create `convex/lib/recipeParsingFixtures.test.ts` with one `describe` per fixture. Skeleton + one fully-worked example — replicate the pattern per fixture with each site's **actual** values from Step 3:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { extractJsonLdRecipe } from './recipeParsing'

// Real JSON-LD payloads captured from live recipe sites (see
// __fixtures__/jsonld/README.md for source URLs and capture dates).
// These test the parser against real-world mess, not the spec.
function fixtureHtml(name: string): string {
  const json = readFileSync(
    new URL(`./__fixtures__/jsonld/${name}.json`, import.meta.url),
    'utf8',
  )
  return `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`
}

describe('leukerecepten.nl', () => {
  const recipe = extractJsonLdRecipe(fixtureHtml('leukerecepten'))
  test('extracts the core recipe', () => {
    expect(recipe?.title).toBe('<ACTUAL TITLE FROM FIXTURE>')
    expect(recipe?.ingredients.length).toBeGreaterThan(2)
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })
  test('extracts servings and nutrition', () => {
    expect(recipe?.servings).toBe(4) // ← actual value
    expect(recipe?.nutrition).toMatchObject({ calories: 520 }) // ← actual values, add every nutrient the fixture provides
  })
})

// …one describe block per fixture, same shape.
```

Assertion rules (apply to every fixture):
- `title` asserted exactly; `ingredients.length`/`steps.length` as `toBeGreaterThan` bounds.
- When the source JSON-LD has `recipeYield`: assert the exact parsed `servings`. When absent: `expect(recipe?.servings).toBeUndefined()`.
- When the source has `nutrition`: assert **every nutrient the source provides** with exact parsed values via `toMatchObject`. When absent: `expect(recipe?.nutrition).toBeUndefined()` — that documents reality per spec.
- At least 2 fixtures must assert a non-empty `nutrition` — if none of the captured sites publish it, capture more sites until two do (bbcgoodfood/allrecipes usually do).

- [ ] **Step 5: Run the suite; fix extraction gaps**

Run: `pnpm vitest run convex/lib/recipeParsingFixtures.test.ts`

For every failure decide: (a) the assertion was written wrong → fix the assertion to the source's truth; or (b) the parser misses/garbles data the source provides → extend `recipeParsing.ts`/`nutrition.ts`, add a synthetic regression test to `recipeParsing.test.ts` or `nutrition.test.ts` reproducing that structure, and re-run. Repeat until green.

- [ ] **Step 6: Write the README**

Create `convex/lib/__fixtures__/jsonld/README.md`:

```markdown
# Real-site JSON-LD fixtures

Captured `application/ld+json` Recipe payloads from live recipe sites, used
by `convex/lib/recipeParsingFixtures.test.ts` to test extraction against
real-world variety (spec: docs/superpowers/specs/2026-07-17-nutrition-tracking-design.md §7.1).

Refresh or add a fixture with:

    node convex/lib/__fixtures__/jsonld/capture.mjs "<recipe-url>" <name>

When a site changes structure and breaks imports in production, capture the
new payload here and fix the parser against it.

| Fixture | Source URL | Captured |
|---|---|---|
| leukerecepten.json | <url> | 2026-07-17 |
| … | … | … |
```

(fill the table with the real URLs and dates from Step 2).

- [ ] **Step 7: Full test suite + commit**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS.

```bash
pnpm check && git add convex/lib/__fixtures__ convex/lib/recipeParsingFixtures.test.ts convex/lib/recipeParsing.ts convex/lib/recipeParsing.test.ts convex/lib/nutrition.ts convex/lib/nutrition.test.ts && git commit -m "test(nutrition): real Dutch-site JSON-LD fixture suite for servings + nutrition extraction"
```

---

### Task 13: Final verification

**Files:** none new.

- [ ] **Step 1: Full gate**

Run: `pnpm check && pnpm typecheck && pnpm test`
Expected: all PASS, no lint diffs.

- [ ] **Step 2: End-to-end verification via the project's verify skill**

Invoke the project-local `verify` skill (route → module map lives there) to exercise the changed flows in the running app: import a recipe from a URL that has JSON-LD nutrition (pick one from the fixture README) and confirm the form prefills nutrition + servings with an "Imported" badge after save; edit that recipe's ingredients and confirm the stale banner appears on the detail page; use "Estimate with AI" on a manual recipe (requires `ANTHROPIC_API_KEY` on the dev deployment — if unset, confirm the button is absent instead); enter nutrition manually and confirm the "Manual" badge.

- [ ] **Step 3: Update CLAUDE.md's Convex function list**

In `CLAUDE.md`, update the line
`- **Convex** backend (`convex/`) — functions: `recipes.ts`, `groups.ts`, `users.ts`, `lib/sharing.ts`. Schema in `convex/schema.ts`.`
to also name `recipeImport.ts`, `recipeNutrition.ts`, and `lib/nutrition.ts`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: note nutrition modules in CLAUDE.md convex function list"
```

---

## Phases 2 and 3

Foods library + barcode scanning (spec §3.3, §4.3, §4.4) and the consumption diary + targets (spec §3.4, §3.5, §4.5) get their own plan documents once this phase has landed — they build on `convex/lib/nutrition.ts` and the shipped recipe-nutrition UI, and planning them against the real post-phase-1 codebase avoids drift.
