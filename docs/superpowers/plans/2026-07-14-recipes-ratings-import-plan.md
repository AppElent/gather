# Recipes: Ratings, Photos, and URL Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Recipes module a star-rating widget, photo-forward switchable card layouts (with real photo upload, which doesn't exist yet), and the ability to import a recipe from an external URL (schema.org/Recipe JSON-LD, with a Claude fallback).

**Architecture:** Backend additions live in `convex/` following the existing per-domain-file pattern (`recipes.ts` for CRUD, a new `recipeImport.ts` Node-runtime action for the URL fetch + AI call, pure/testable parsing helpers under `convex/lib/`). Frontend additions are small, focused, mostly Convex-free components under `src/components/recipes/`, wired together by the existing route files. Nothing here changes the existing per-owner sharing model.

**Tech Stack:** Convex (schema, queries, mutations, a Node-runtime action), `@anthropic-ai` Messages API via plain `fetch` (not `@tanstack/ai-anthropic` — see Task 5 note), React 19, TanStack Router/Start, Tailwind v4, Vitest + Testing Library, lucide-react icons.

**Design doc:** [docs/superpowers/specs/2026-07-14-recipes-ratings-import-design.md](../specs/2026-07-14-recipes-ratings-import-design.md)

---

## Before you start

This plan calls the real Anthropic Messages API from a Convex action. That needs a secret:

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

Set it on your dev deployment before Task 18 (manual verification). If it's unset, the AI-fallback path simply returns "no recipe found" instead of erroring — JSON-LD-only imports still work fine without it.

---

## Task 1: Schema — `sourceUrl` field

**Files:**
- Modify: `convex/schema.ts:27-38`

- [ ] **Step 1: Add the field**

In `convex/schema.ts`, add `sourceUrl` to the `recipes` table definition:

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
  }).index('by_owner', ['ownerId']),
```

- [ ] **Step 2: Regenerate Convex types and typecheck**

Run: `npx convex dev --once && pnpm run typecheck`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(recipes): add sourceUrl field to schema"
```

---

## Task 2: `recipes.ts` — `sourceUrl` field + resolve `imageUrl` in `list`

**Files:**
- Modify: `convex/recipes.ts:5-19` (the `list` query)
- Modify: `convex/recipes.ts:50-60` (`recipeFields`)

- [ ] **Step 1: Add `sourceUrl` to `recipeFields`**

In `convex/recipes.ts`, update the shared field set:

```ts
const recipeFields = {
  title: v.string(),
  description: v.optional(v.string()),
  imageId: v.optional(v.id('_storage')),
  ingredients: v.array(v.string()),
  steps: v.array(v.string()),
  tags: v.array(v.string()),
  rating: v.optional(v.number()),
  prepMinutes: v.optional(v.number()),
  sourceUrl: v.optional(v.string()),
  sharedGroupIds: v.optional(v.array(v.id('groups'))),
}
```

- [ ] **Step 2: Resolve `imageUrl` in `list`**

Replace the `list` query's handler body:

```ts
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    const groupIds = await getMyGroupIds(ctx, user._id)
    const all = await ctx.db.query('recipes').collect()
    const visible = all.filter((r) =>
      isVisibleTo(
        { ownerId: r.ownerId, sharedGroupIds: r.sharedGroupIds },
        { userId: user._id, groupIds },
      ),
    )
    return await Promise.all(
      visible.map(async (r) => ({
        ...r,
        imageUrl: r.imageId ? await ctx.storage.getUrl(r.imageId) : null,
      })),
    )
  },
})
```

- [ ] **Step 3: Typecheck**

Run: `npx convex dev --once && pnpm run typecheck`
Expected: succeeds. (`create`/`update` already accept the new `sourceUrl` field via `recipeFields`; no other changes needed there.)

- [ ] **Step 4: Commit**

```bash
git add convex/recipes.ts
git commit -m "feat(recipes): resolve imageUrl in list, accept sourceUrl"
```

---

## Task 3: `convex/lib/recipeParsing.ts` — pure JSON-LD + text parsing

**Files:**
- Create: `convex/lib/recipeParsing.ts`
- Test: `convex/lib/recipeParsing.test.ts`

This is the JSON-LD `schema.org/Recipe` extractor, an ISO-8601 duration parser, and an HTML-to-text stripper for the AI fallback. All pure functions, no Convex/network dependency — fully unit testable.

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/recipeParsing.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import {
  extractJsonLdRecipe,
  htmlToText,
  parseIsoDurationMinutes,
} from './recipeParsing'

function htmlWithJsonLd(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`
}

describe('extractJsonLdRecipe', () => {
  test('returns null when there is no ld+json script', () => {
    expect(
      extractJsonLdRecipe('<html><body>no recipe here</body></html>'),
    ).toBeNull()
  })

  test('parses a single Recipe object with string instructions', () => {
    const html = htmlWithJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Sunday Roast Chicken',
      description: 'A classic Sunday roast.',
      image: ['https://example.com/roast.jpg'],
      recipeIngredient: ['1 whole chicken', '2 tbsp butter', 'salt'],
      recipeInstructions: 'Preheat oven to 200C.\nRoast for 90 minutes.',
      keywords: 'dinner, comfort food',
      prepTime: 'PT20M',
    })

    expect(extractJsonLdRecipe(html)).toEqual({
      title: 'Sunday Roast Chicken',
      description: 'A classic Sunday roast.',
      ingredients: ['1 whole chicken', '2 tbsp butter', 'salt'],
      steps: ['Preheat oven to 200C.', 'Roast for 90 minutes.'],
      tags: ['dinner', 'comfort food'],
      prepMinutes: 20,
      imageUrl: 'https://example.com/roast.jpg',
    })
  })

  test('parses HowToStep instruction objects', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Pasta',
      recipeIngredient: ['pasta', 'salt'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Boil water.' },
        { '@type': 'HowToStep', text: 'Cook pasta for 10 minutes.' },
      ],
    })

    expect(extractJsonLdRecipe(html)?.steps).toEqual([
      'Boil water.',
      'Cook pasta for 10 minutes.',
    ])
  })

  test('finds a Recipe node nested inside a @graph array', () => {
    const html = htmlWithJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Some Blog' },
        {
          '@type': 'Recipe',
          name: 'Graph Recipe',
          recipeIngredient: ['flour'],
          recipeInstructions: ['Mix it.'],
        },
      ],
    })

    expect(extractJsonLdRecipe(html)?.title).toBe('Graph Recipe')
  })

  test('returns null when the ld+json has no Recipe type', () => {
    const html = htmlWithJsonLd({ '@type': 'WebSite', name: 'Some Blog' })
    expect(extractJsonLdRecipe(html)).toBeNull()
  })

  test('returns null when the ld+json is malformed', () => {
    const html = '<script type="application/ld+json">{not valid json</script>'
    expect(extractJsonLdRecipe(html)).toBeNull()
  })
})

describe('extractJsonLdRecipe — real-world site quirks', () => {
  test('flattens HowToSection-grouped instructions (WP Recipe Maker style — leukerecepten.nl, lekkerensimpel.com)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Sectioned Recipe',
      recipeIngredient: ['flour', 'sugar'],
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Make the batter',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Mix flour and sugar.' },
            { '@type': 'HowToStep', text: 'Add water.' },
          ],
        },
        {
          '@type': 'HowToSection',
          name: 'Bake it',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Bake for 30 minutes.' },
          ],
        },
      ],
    })

    expect(extractJsonLdRecipe(html)?.steps).toEqual([
      'Mix flour and sugar.',
      'Add water.',
      'Bake for 30 minutes.',
    ])
  })

  test('accepts recipeCategory/recipeCuisine as arrays, not just strings (lekkerensimpel.com, miljuschka.nl)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Array Tags Recipe',
      recipeIngredient: ['pasta'],
      recipeInstructions: ['Cook it.'],
      recipeCategory: ['Hoofdgerecht'],
      recipeCuisine: ['Italiaanse keuken'],
    })

    expect(extractJsonLdRecipe(html)?.tags).toEqual(
      expect.arrayContaining(['Hoofdgerecht', 'Italiaanse keuken']),
    )
  })

  test('skips a leading empty string in an image array and finds the real URL (ah.nl)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Empty Image Slot Recipe',
      recipeIngredient: ['egg'],
      recipeInstructions: ['Fry it.'],
      image: ['', 'https://example.com/real-photo.jpg'],
    })

    expect(extractJsonLdRecipe(html)?.imageUrl).toBe(
      'https://example.com/real-photo.jpg',
    )
  })

  test('falls back to ImageObject.contentUrl when .url is absent', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'ContentUrl Recipe',
      recipeIngredient: ['egg'],
      recipeInstructions: ['Fry it.'],
      image: {
        '@type': 'ImageObject',
        contentUrl: 'https://example.com/content.jpg',
      },
    })

    expect(extractJsonLdRecipe(html)?.imageUrl).toBe(
      'https://example.com/content.jpg',
    )
  })

  test('decodes HTML entities embedded in JSON-LD string values (miljuschka.nl)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Salt &amp; Pepper Chicken',
      recipeIngredient: ['chicken'],
      recipeInstructions: ['Season with salt &amp; pepper.'],
      recipeCategory: 'Koek &amp; Gebak',
    })

    const result = extractJsonLdRecipe(html)
    expect(result?.title).toBe('Salt & Pepper Chicken')
    expect(result?.steps).toEqual(['Season with salt & pepper.'])
    expect(result?.tags).toEqual(['Koek & Gebak'])
  })

  test('finds a Recipe nested under a WebPage mainEntity', () => {
    const html = htmlWithJsonLd({
      '@type': 'WebPage',
      name: 'Some Page',
      mainEntity: {
        '@type': 'Recipe',
        name: 'Nested Under mainEntity',
        recipeIngredient: ['flour'],
        recipeInstructions: ['Bake it.'],
      },
    })

    expect(extractJsonLdRecipe(html)?.title).toBe('Nested Under mainEntity')
  })

  test('ignores an @id-only mainEntity reference without crashing', () => {
    const html = htmlWithJsonLd({
      '@type': 'WebPage',
      name: 'Some Page',
      mainEntity: [{ '@id': 'https://example.com/#faq-1' }],
    })

    expect(extractJsonLdRecipe(html)).toBeNull()
  })

  test('falls back to cookTime for prepMinutes when prepTime/totalTime are absent (lekkerensimpel.com)', () => {
    const html = htmlWithJsonLd({
      '@type': 'Recipe',
      name: 'Cook Time Only Recipe',
      recipeIngredient: ['pasta'],
      recipeInstructions: ['Boil it.'],
      cookTime: 'PT20M',
    })

    expect(extractJsonLdRecipe(html)?.prepMinutes).toBe(20)
  })
})

describe('parseIsoDurationMinutes', () => {
  test('parses hours and minutes', () => {
    expect(parseIsoDurationMinutes('PT1H30M')).toBe(90)
  })

  test('parses minutes only', () => {
    expect(parseIsoDurationMinutes('PT45M')).toBe(45)
  })

  test('returns undefined for an invalid duration', () => {
    expect(parseIsoDurationMinutes('not a duration')).toBeUndefined()
  })
})

describe('htmlToText', () => {
  test('strips tags, scripts, and styles, and decodes entities', () => {
    const html =
      '<html><head><style>body{color:red}</style></head><body><script>evil()</script><p>Salt &amp; pepper</p></body></html>'
    expect(htmlToText(html)).toBe('Salt & pepper')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run convex/lib/recipeParsing.test.ts`
Expected: FAIL with "Cannot find module './recipeParsing'"

- [ ] **Step 3: Implement `convex/lib/recipeParsing.ts`**

```ts
export interface ParsedRecipe {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  prepMinutes?: number
  imageUrl?: string
}

interface JsonLdNode {
  '@type'?: string | string[]
  [key: string]: unknown
}

function isRecipeNode(node: unknown): node is JsonLdNode {
  if (typeof node !== 'object' || node === null) return false
  const type = (node as JsonLdNode)['@type']
  if (typeof type === 'string') return type === 'Recipe'
  if (Array.isArray(type)) return type.includes('Recipe')
  return false
}

function findRecipeNode(data: unknown): JsonLdNode | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  if (isRecipeNode(data)) return data as JsonLdNode
  const graph = (data as { '@graph'?: unknown })['@graph']
  if (Array.isArray(graph)) {
    const found = findRecipeNode(graph)
    if (found) return found
  }
  // Some sites wrap the Recipe as the mainEntity of a WebPage instead of
  // (or in addition to) using @graph. mainEntity may also just be an
  // @id-reference to another node (no @type) — findRecipeNode safely
  // returns null for those rather than throwing.
  const mainEntity = (data as { mainEntity?: unknown }).mainEntity
  if (mainEntity !== undefined) {
    const found = findRecipeNode(mainEntity)
    if (found) return found
  }
  return null
}

export function parseIsoDurationMinutes(iso: string): number | undefined {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim())
  if (!match) return undefined
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  const total = hours * 60 + minutes + Math.round(seconds / 60)
  return total > 0 ? total : undefined
}

// Some sites' JSON-LD (notably WordPress/WP Recipe Maker output, e.g.
// miljuschka.nl) leaves HTML entities un-decoded inside string values
// (e.g. "Koek &amp; Gebak"). Decode the common ones for clean display.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return decodeHtmlEntities(value.trim())
  if (typeof value === 'object' && value !== null && 'text' in value) {
    const text = (value as { text?: unknown }).text
    return typeof text === 'string' ? decodeHtmlEntities(text.trim()) : ''
  }
  return ''
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(textOf).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((s) => decodeHtmlEntities(s.trim()))
      .filter(Boolean)
  }
  return []
}

// recipeInstructions varies a lot in practice: a plain string, a flat array
// of strings or HowToStep objects, or (very common with the WP Recipe Maker
// plugin — leukerecepten.nl, lekkerensimpel.com) an array of HowToSection
// objects that each group their own HowToStep itemListElement. Flatten all
// of these into a single ordered list of step strings.
function extractSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractSteps(item))
  }
  if (typeof value === 'string') {
    return toStringArray(value)
  }
  if (typeof value === 'object' && value !== null) {
    const node = value as { '@type'?: unknown; itemListElement?: unknown }
    if (node['@type'] === 'HowToSection' && Array.isArray(node.itemListElement)) {
      return extractSteps(node.itemListElement)
    }
    const text = textOf(value)
    return text ? [text] : []
  }
  return []
}

// image is one of: a URL string, an array of URL strings (sometimes with
// empty-string placeholder entries — ah.nl does this), a single ImageObject,
// or an array of ImageObjects. ImageObject may use .url or .contentUrl.
function firstImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstImageUrl(item)
      if (url) return url
    }
    return undefined
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as { url?: unknown; contentUrl?: unknown }
    if (typeof obj.url === 'string' && obj.url.trim()) return obj.url.trim()
    if (typeof obj.contentUrl === 'string' && obj.contentUrl.trim()) {
      return obj.contentUrl.trim()
    }
  }
  return undefined
}

// recipeCategory/recipeCuisine are documented as a single string but many
// sites (lekkerensimpel.com, miljuschka.nl) emit an array instead.
function stringOrArrayToTags(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = decodeHtmlEntities(value.trim())
    return trimmed ? [trimmed] : []
  }
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => decodeHtmlEntities(v.trim()))
  }
  return []
}

function tagsOf(node: JsonLdNode): string[] {
  const tags = new Set<string>()
  const keywords = node.keywords
  if (typeof keywords === 'string') {
    for (const k of keywords
      .split(',')
      .map((s) => decodeHtmlEntities(s.trim()))
      .filter(Boolean)) {
      tags.add(k)
    }
  } else {
    for (const k of stringOrArrayToTags(keywords)) tags.add(k)
  }
  for (const k of stringOrArrayToTags(node.recipeCategory)) tags.add(k)
  for (const k of stringOrArrayToTags(node.recipeCuisine)) tags.add(k)
  return Array.from(tags)
}

export function extractJsonLdRecipe(html: string): ParsedRecipe | null {
  const scriptRe =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(scriptRe)) {
    let data: unknown
    try {
      data = JSON.parse(match[1].trim())
    } catch {
      continue
    }
    const node = findRecipeNode(data)
    if (!node) continue

    const title = textOf(node.name)
    const ingredients = toStringArray(node.recipeIngredient)
    const steps = extractSteps(node.recipeInstructions)
    if (!title || ingredients.length === 0 || steps.length === 0) continue

    const description = textOf(node.description) || undefined
    const prepTimeRaw = node.prepTime ?? node.totalTime ?? node.cookTime
    const prepMinutes =
      typeof prepTimeRaw === 'string'
        ? parseIsoDurationMinutes(prepTimeRaw)
        : undefined

    return {
      title,
      description,
      ingredients,
      steps,
      tags: tagsOf(node),
      prepMinutes,
      imageUrl: firstImageUrl(node.image),
    }
  }
  return null
}

const HTML_TEXT_MAX_LENGTH = 15_000

export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ')
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  const collapsed = decoded.replace(/\s+/g, ' ').trim()
  return collapsed.slice(0, HTML_TEXT_MAX_LENGTH)
}
```

Note: `description: textOf(node.description) || undefined` — the test fixture in Step 1 doesn't set `description` in every case; when absent, `textOf(undefined)` returns `''`, so `|| undefined` normalizes it away. The "HowToStep" and "@graph" tests only assert `.steps`/`.title`, so this doesn't need to match exactly there.

This implementation was hardened against four real Dutch recipe sites' actual JSON-LD (inspected directly via browser `document.querySelectorAll('script[type="application/ld+json"]')`, not guessed): leukerecepten.nl and lekkerensimpel.com both group `recipeInstructions` under `HowToSection` (WP Recipe Maker plugin); lekkerensimpel.com and miljuschka.nl both emit `recipeCategory`/`recipeCuisine` as arrays; ah.nl's `image` array has a leading empty-string entry; miljuschka.nl leaves `&amp;` un-decoded inside JSON string values. `mainEntity`-nested Recipe and `ImageObject.contentUrl` are handled defensively even though none of the four sites happened to use them — they're documented, known-real patterns elsewhere.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run convex/lib/recipeParsing.test.ts`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/lib/recipeParsing.ts convex/lib/recipeParsing.test.ts
git commit -m "feat(recipes): add JSON-LD recipe parsing helpers"
```

---

## Task 4: `convex/lib/recipeAiExtract.ts` — Claude fallback extraction

**Files:**
- Create: `convex/lib/recipeAiExtract.ts`
- Test: `convex/lib/recipeAiExtract.test.ts`

**Note on approach:** the design doc named `@tanstack/ai-anthropic` for this. Having inspected the package (`node_modules/.pnpm/@tanstack+ai-anthropic@.../src/adapters/text.ts`), it's built around a streaming chat-engine abstraction (`AnthropicTextAdapter`, driven by `@tanstack/ai`'s internal logger/event-stream machinery) meant for conversational UIs — not a simple one-shot "extract structured JSON" call. Forcing a single extraction call through it would mean correctly wiring up `@tanstack/ai`'s internal `StructuredOutputOptions` (including a hand-built `InternalLogger`), which adds real complexity for no benefit over calling the Anthropic Messages API directly. This task calls `https://api.anthropic.com/v1/messages` with `fetch` and a forced tool-call — the same tool-forcing technique `@tanstack/ai-anthropic` uses internally (see its `structuredOutput()` method) — with the `fetch` implementation injected as a parameter so this is fully unit-testable without a real network call.

- [ ] **Step 1: Write the failing tests**

Create `convex/lib/recipeAiExtract.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { extractRecipeWithAi } from './recipeAiExtract'

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

describe('extractRecipeWithAi', () => {
  test('maps a successful tool_use response to a ParsedRecipe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'extract_recipe',
            input: {
              found: true,
              title: 'Weeknight Tacos',
              ingredients: ['tortillas', 'beef'],
              steps: ['Cook beef.', 'Fill tortillas.'],
              tags: ['dinner'],
              prepMinutes: 15,
            },
          },
        ],
      }),
    )

    const result = await extractRecipeWithAi(
      'some page text',
      'test-key',
      fetchImpl,
    )

    expect(result).toEqual({
      title: 'Weeknight Tacos',
      description: undefined,
      ingredients: ['tortillas', 'beef'],
      steps: ['Cook beef.', 'Fill tortillas.'],
      tags: ['dinner'],
      prepMinutes: 15,
      imageUrl: undefined,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      }),
    )
  })

  test('returns null when the model reports no recipe found', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          { type: 'tool_use', name: 'extract_recipe', input: { found: false } },
        ],
      }),
    )
    expect(
      await extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null when the request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({}, false))
    expect(
      await extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    expect(
      await extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run convex/lib/recipeAiExtract.test.ts`
Expected: FAIL with "Cannot find module './recipeAiExtract'"

- [ ] **Step 3: Implement `convex/lib/recipeAiExtract.ts`**

```ts
import type { ParsedRecipe } from './recipeParsing'

const ANTHROPIC_MODEL = 'claude-sonnet-5'
const ANTHROPIC_MAX_TOKENS = 4096
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const EXTRACT_TOOL = {
  name: 'extract_recipe',
  description:
    'Extract recipe details from the page text, or report that none was found.',
  input_schema: {
    type: 'object' as const,
    properties: {
      found: {
        type: 'boolean',
        description: 'Whether a recipe was found in the page text',
      },
      title: { type: 'string' },
      description: { type: 'string' },
      ingredients: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } },
      prepMinutes: { type: 'number' },
      imageUrl: { type: 'string' },
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
  content: Array<{ type: string } & Record<string, unknown>>
}

export async function extractRecipeWithAi(
  pageText: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedRecipe | null> {
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
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_recipe' },
        messages: [
          {
            role: 'user',
            content: `Extract the recipe from this web page text. If there's no recipe on the page, set found to false.\n\n${pageText}`,
          },
        ],
      }),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const data = (await response.json()) as AnthropicMessagesResponse
  const toolUse = data.content.find(
    (block): block is AnthropicToolUseBlock =>
      block.type === 'tool_use' && block.name === 'extract_recipe',
  )
  if (!toolUse) return null

  const input = toolUse.input
  if (input.found !== true) return null
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return null

  return {
    title,
    description:
      typeof input.description === 'string' ? input.description : undefined,
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.filter((i): i is string => typeof i === 'string')
      : [],
    steps: Array.isArray(input.steps)
      ? input.steps.filter((s): s is string => typeof s === 'string')
      : [],
    tags: Array.isArray(input.tags)
      ? input.tags.filter((t): t is string => typeof t === 'string')
      : [],
    prepMinutes:
      typeof input.prepMinutes === 'number' ? input.prepMinutes : undefined,
    imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl : undefined,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run convex/lib/recipeAiExtract.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/lib/recipeAiExtract.ts convex/lib/recipeAiExtract.test.ts
git commit -m "feat(recipes): add Claude fallback recipe extraction"
```

---

## Task 5: `convex/recipeImport.ts` — the action

**Files:**
- Create: `convex/recipeImport.ts`

This is a thin Node-runtime action that wires Tasks 3+4's pure helpers to a real `fetch` and Convex file storage. It has no automated test — this codebase has no Convex action-testing harness (`convex-test` isn't installed, and no existing `convex/*.ts` action/query/mutation handler has a direct unit test; only pure helpers like `convex/lib/sharing.ts` do, via `convex/lib/sharing.test.ts`). It's verified manually in Task 18.

- [ ] **Step 1: Implement `convex/recipeImport.ts`**

```ts
'use node'

import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import { extractRecipeWithAi } from './lib/recipeAiExtract'
import { extractJsonLdRecipe, htmlToText } from './lib/recipeParsing'

const IMPORT_USER_AGENT =
  'Mozilla/5.0 (compatible; GatherRecipeImport/1.0; +https://github.com/AppElent/gather)'
const FETCH_TIMEOUT_MS = 10_000
const BLOCKED_MESSAGE =
  'That site blocks automated access — try pasting the recipe manually.'
const NOT_FOUND_MESSAGE =
  "Couldn't find a recipe on that page — try pasting the details manually."

export const importFromUrl = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    let html: string
    try {
      const response = await fetch(args.url, {
        headers: { 'User-Agent': IMPORT_USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error('fetch not ok')
      html = await response.text()
    } catch {
      throw new Error(BLOCKED_MESSAGE)
    }

    let parsed = extractJsonLdRecipe(html)
    if (!parsed) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      parsed = apiKey ? await extractRecipeWithAi(htmlToText(html), apiKey) : null
    }
    if (!parsed) throw new Error(NOT_FOUND_MESSAGE)

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
    }
  },
})

async function storeRemoteImage(
  ctx: ActionCtx,
  url: string,
): Promise<Id<'_storage'> | undefined> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await ctx.storage.store(blob)
  } catch {
    return undefined
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx convex dev --once && pnpm run typecheck`
Expected: succeeds. `npx convex dev --once` regenerates `convex/_generated/api.d.ts` to include `api.recipeImport.importFromUrl`.

- [ ] **Step 3: Commit**

```bash
git add convex/recipeImport.ts
git commit -m "feat(recipes): add importFromUrl action (JSON-LD + Claude fallback)"
```

---

## Task 6: `StarRating` component

**Files:**
- Create: `src/components/recipes/StarRating.tsx`
- Test: `src/components/recipes/StarRating.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/recipes/StarRating.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { StarRating } from './StarRating'

test('clicking a star sets the rating', () => {
  const onChange = vi.fn()
  render(<StarRating value={undefined} onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
  expect(onChange).toHaveBeenCalledWith(3)
})

test('clicking the already-selected star clears the rating', () => {
  const onChange = vi.fn()
  render(<StarRating value={3} onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
  expect(onChange).toHaveBeenCalledWith(undefined)
})

test('only the star matching the current value is marked checked', () => {
  render(<StarRating value={3} onChange={() => {}} />)
  expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(screen.getByRole('radio', { name: '4 stars' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/recipes/StarRating.test.tsx`
Expected: FAIL with "Cannot find module './StarRating'"

- [ ] **Step 3: Implement `src/components/recipes/StarRating.tsx`**

```tsx
const STAR_VALUES = [1, 2, 3, 4, 5]

interface StarRatingProps {
  value?: number
  onChange: (value: number | undefined) => void
}

export function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {STAR_VALUES.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className="text-2xl leading-none"
          onClick={() => onChange(value === star ? undefined : star)}
        >
          <span
            aria-hidden="true"
            className={value != null && star <= value ? 'opacity-100' : 'opacity-30'}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/recipes/StarRating.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/StarRating.tsx src/components/recipes/StarRating.test.tsx
git commit -m "feat(recipes): add StarRating component"
```

---

## Task 7: Wire `StarRating` into `RecipeForm`

**Files:**
- Modify: `src/components/recipes/RecipeForm.tsx`
- Modify: `src/components/recipes/RecipeForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/recipes/RecipeForm.test.tsx` (keep the existing test as-is):

```tsx
test('star rating can be set and submitted', () => {
  const onSubmit = vi.fn()
  render(<RecipeForm onSubmit={onSubmit} submitting={false} />)

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Pasta' },
  })
  fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
  fireEvent.click(screen.getByRole('button', { name: /save/i }))

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ rating: 4 }),
  )
})
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `pnpm exec vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: the original test still PASSes; the new one FAILs (no `radio` role exists yet — the rating field is currently a numeric `<input>`).

- [ ] **Step 3: Update `RecipeForm.tsx`**

Add the import:

```tsx
import { StarRating } from './StarRating'
```

Change the rating state declaration from:

```tsx
const [rating, setRating] = useState(initial?.rating?.toString() ?? '')
```

to:

```tsx
const [rating, setRating] = useState<number | undefined>(initial?.rating)
```

In the `onSubmit` handler, change:

```tsx
          rating: rating ? Number(rating) : undefined,
```

to:

```tsx
          rating,
```

Replace the rating `<label>` block:

```tsx
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Rating (1–5)</span>
        <input
          type="number"
          min="1"
          max="5"
          className="w-24 rounded border px-2 py-1"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        />
      </label>
```

with:

```tsx
      <div className="block text-sm">
        <span className="mb-1 block font-medium">Rating</span>
        <StarRating value={rating} onChange={setRating} />
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/recipes/RecipeForm.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/recipes/RecipeForm.tsx src/components/recipes/RecipeForm.test.tsx
git commit -m "feat(recipes): replace numeric rating input with StarRating"
```

---

## Task 8: `RecipeCard` component (three view modes)

**Files:**
- Create: `src/components/recipes/RecipeCard.tsx`
- Test: `src/components/recipes/RecipeCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/recipes/RecipeCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RecipeCard } from './RecipeCard'

const recipe = {
  title: 'Sunday Roast',
  rating: 4,
  tags: ['dinner', 'comfort food'],
  imageUrl: 'https://example.com/photo.jpg',
}

test('grid mode shows title, stars, tags, and photo', () => {
  render(<RecipeCard recipe={recipe} mode="grid" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByText('★★★★')).toBeInTheDocument()
  expect(screen.getByText('dinner, comfort food')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sunday Roast' })).toBeInTheDocument()
})

test('recipes without a photo render a placeholder, not a broken image', () => {
  render(<RecipeCard recipe={{ ...recipe, imageUrl: null }} mode="grid" />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

test('compact mode renders the same content in a row layout', () => {
  render(<RecipeCard recipe={recipe} mode="compact" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sunday Roast' })).toBeInTheDocument()
})

test('banner mode renders title and stars overlaid on the photo', () => {
  render(<RecipeCard recipe={recipe} mode="banner" />)
  expect(screen.getByText('Sunday Roast')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sunday Roast' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/recipes/RecipeCard.test.tsx`
Expected: FAIL with "Cannot find module './RecipeCard'"

- [ ] **Step 3: Implement `src/components/recipes/RecipeCard.tsx`**

```tsx
export type RecipeViewMode = 'grid' | 'banner' | 'compact'

export interface RecipeCardData {
  title: string
  rating?: number
  tags: string[]
  imageUrl: string | null
}

interface RecipeCardProps {
  recipe: RecipeCardData
  mode: RecipeViewMode
}

function Stars({ rating }: { rating?: number }) {
  if (rating == null) return null
  return <p className="text-xs opacity-60">{'★'.repeat(rating)}</p>
}

function Photo({
  imageUrl,
  title,
  className,
}: {
  imageUrl: string | null
  title: string
  className: string
}) {
  if (!imageUrl) {
    return <div className={`${className} bg-black/5 dark:bg-white/10`} />
  }
  return <img src={imageUrl} alt={title} className={`${className} object-cover`} />
}

export function RecipeCard({ recipe, mode }: RecipeCardProps) {
  if (mode === 'banner') {
    return (
      <div className="relative h-56 overflow-hidden rounded-xl">
        <Photo
          imageUrl={recipe.imageUrl}
          title={recipe.title}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="font-medium">{recipe.title}</p>
          <Stars rating={recipe.rating} />
        </div>
      </div>
    )
  }

  if (mode === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-xl border p-2">
        <Photo
          imageUrl={recipe.imageUrl}
          title={recipe.title}
          className="h-16 w-16 flex-shrink-0 rounded-lg"
        />
        <div>
          <p className="font-medium">{recipe.title}</p>
          <Stars rating={recipe.rating} />
          {recipe.tags.length > 0 && (
            <p className="mt-1 text-xs opacity-50">{recipe.tags.join(', ')}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-4">
      <Photo
        imageUrl={recipe.imageUrl}
        title={recipe.title}
        className="mb-3 h-32 w-full rounded-lg"
      />
      <p className="font-medium">{recipe.title}</p>
      <Stars rating={recipe.rating} />
      {recipe.tags.length > 0 && (
        <p className="mt-1 text-xs opacity-50">{recipe.tags.join(', ')}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/recipes/RecipeCard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/RecipeCard.tsx src/components/recipes/RecipeCard.test.tsx
git commit -m "feat(recipes): add RecipeCard with grid/banner/compact view modes"
```

---

## Task 9: `useRecipeViewMode` hook

**Files:**
- Create: `src/components/recipes/useRecipeViewMode.ts`
- Test: `src/components/recipes/useRecipeViewMode.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/recipes/useRecipeViewMode.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { useRecipeViewMode } from './useRecipeViewMode'

afterEach(() => {
  window.localStorage.clear()
})

test('defaults to grid mode', () => {
  const { result } = renderHook(() => useRecipeViewMode())
  expect(result.current[0]).toBe('grid')
})

test('reads a previously stored mode on mount', () => {
  window.localStorage.setItem('gather.recipes.viewMode', 'compact')
  const { result } = renderHook(() => useRecipeViewMode())
  expect(result.current[0]).toBe('compact')
})

test('setMode updates state and persists to localStorage', () => {
  const { result } = renderHook(() => useRecipeViewMode())
  act(() => {
    result.current[1]('banner')
  })
  expect(result.current[0]).toBe('banner')
  expect(window.localStorage.getItem('gather.recipes.viewMode')).toBe('banner')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/recipes/useRecipeViewMode.test.ts`
Expected: FAIL with "Cannot find module './useRecipeViewMode'"

- [ ] **Step 3: Implement `src/components/recipes/useRecipeViewMode.ts`**

```ts
import { useEffect, useState } from 'react'
import type { RecipeViewMode } from './RecipeCard'

const STORAGE_KEY = 'gather.recipes.viewMode'
const DEFAULT_MODE: RecipeViewMode = 'grid'

function readStoredMode(): RecipeViewMode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'grid' || stored === 'banner' || stored === 'compact') {
    return stored
  }
  return DEFAULT_MODE
}

export function useRecipeViewMode(): [
  RecipeViewMode,
  (mode: RecipeViewMode) => void,
] {
  const [mode, setModeState] = useState<RecipeViewMode>(DEFAULT_MODE)

  // Read localStorage after mount (not during the initial render) so
  // server-rendered and first-client-render markup match; avoids a
  // hydration mismatch on this TanStack Start (SSR) app.
  useEffect(() => {
    setModeState(readStoredMode())
  }, [])

  const setMode = (next: RecipeViewMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return [mode, setMode]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/recipes/useRecipeViewMode.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/useRecipeViewMode.ts src/components/recipes/useRecipeViewMode.test.ts
git commit -m "feat(recipes): add useRecipeViewMode localStorage hook"
```

---

## Task 10: `ViewModeToggle` component

**Files:**
- Create: `src/components/recipes/ViewModeToggle.tsx`
- Test: `src/components/recipes/ViewModeToggle.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/recipes/ViewModeToggle.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ViewModeToggle } from './ViewModeToggle'

test('clicking an option calls onChange with that mode', () => {
  const onChange = vi.fn()
  render(<ViewModeToggle mode="grid" onChange={onChange} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Compact view' }))
  expect(onChange).toHaveBeenCalledWith('compact')
})

test('the active mode is marked checked', () => {
  render(<ViewModeToggle mode="banner" onChange={() => {}} />)
  expect(screen.getByRole('radio', { name: 'Banner view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(screen.getByRole('radio', { name: 'Grid view' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/recipes/ViewModeToggle.test.tsx`
Expected: FAIL with "Cannot find module './ViewModeToggle'"

- [ ] **Step 3: Implement `src/components/recipes/ViewModeToggle.tsx`**

```tsx
import { GalleryVerticalEnd, LayoutGrid, Rows3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RecipeViewMode } from './RecipeCard'

const OPTIONS: Array<{
  mode: RecipeViewMode
  label: string
  icon: LucideIcon
}> = [
  { mode: 'grid', label: 'Grid view', icon: LayoutGrid },
  { mode: 'banner', label: 'Banner view', icon: GalleryVerticalEnd },
  { mode: 'compact', label: 'Compact view', icon: Rows3 },
]

interface ViewModeToggleProps {
  mode: RecipeViewMode
  onChange: (mode: RecipeViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Recipe view"
      className="flex gap-1 rounded-lg border p-1"
    >
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
        <button
          key={optionMode}
          type="button"
          role="radio"
          aria-checked={mode === optionMode}
          aria-label={label}
          onClick={() => onChange(optionMode)}
          className={`rounded-md p-1.5 ${mode === optionMode ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/recipes/ViewModeToggle.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/recipes/ViewModeToggle.tsx src/components/recipes/ViewModeToggle.test.tsx
git commit -m "feat(recipes): add ViewModeToggle component"
```

---

## Task 11: Wire cards + toggle into the recipe list page

**Files:**
- Modify: `src/routes/_app/recipes/index.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { RecipeCard } from '../../../components/recipes/RecipeCard'
import { useRecipeViewMode } from '../../../components/recipes/useRecipeViewMode'
import { ViewModeToggle } from '../../../components/recipes/ViewModeToggle'

export const Route = createFileRoute('/_app/recipes/')({
  component: RecipeList,
})

function RecipeList() {
  const recipes = useQuery(api.recipes.list)
  const [viewMode, setViewMode] = useRecipeViewMode()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <div className="flex items-center gap-3">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Link
            to="/recipes/new"
            className="rounded-md border px-3 py-1.5 text-sm no-underline"
          >
            Add recipe
          </Link>
        </div>
      </div>

      {recipes === undefined ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border bg-black/5"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border p-10 text-center">
          <p className="mb-3 text-sm opacity-70">No recipes yet.</p>
          <Link
            to="/recipes/new"
            className="rounded-md border px-3 py-1.5 text-sm no-underline"
          >
            Add your first recipe
          </Link>
        </div>
      ) : (
        <div
          className={
            viewMode === 'compact'
              ? 'flex flex-col gap-2'
              : 'grid grid-cols-2 gap-4 sm:grid-cols-3'
          }
        >
          {recipes.map((r) => (
            <Link
              key={r._id}
              to="/recipes/$recipeId"
              params={{ recipeId: r._id }}
              className="block no-underline transition hover:opacity-90"
            >
              <RecipeCard recipe={r} mode={viewMode} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds. (`recipes.list` now returns `imageUrl` per Task 2, matching `RecipeCardData`.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app/recipes/index.tsx
git commit -m "feat(recipes): use RecipeCard + view mode toggle on the list page"
```

---

## Task 12: `ImageUploadField` component

**Files:**
- Create: `src/components/recipes/ImageUploadField.tsx`

No automated test for this one — like the other Convex-`useMutation`-calling code in this app (route components), it isn't unit-tested; no test file in this codebase currently mocks `convex/react` (`grep -r "useMutation\|useQuery" src` only ever turns up route files, never a `*.test.tsx`). It's verified manually in Task 18.

- [ ] **Step 1: Implement `src/components/recipes/ImageUploadField.tsx`**

```tsx
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

interface ImageUploadFieldProps {
  imageUrl: string | null
  onChange: (imageId: Id<'_storage'> | undefined) => void
}

export function ImageUploadField({ imageUrl, onChange }: ImageUploadFieldProps) {
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
      setPreviewUrl(URL.createObjectURL(file))
      onChange(storageId)
    } catch {
      setError('Could not upload that image')
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = previewUrl ?? imageUrl

  return (
    <div className="mx-auto mb-6 max-w-2xl rounded-xl border p-4">
      <span className="mb-2 block text-sm font-medium">Photo</span>
      <div className="flex items-center gap-3">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-lg bg-black/5 dark:bg-white/10" />
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {uploading && <p className="text-xs opacity-60">Uploading…</p>}
          {error && <p className="text-xs text-red-800">{error}</p>}
          {displayUrl && !uploading && (
            <button
              type="button"
              className="mt-1 block text-xs underline"
              onClick={() => {
                setPreviewUrl(null)
                onChange(undefined)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/recipes/ImageUploadField.tsx
git commit -m "feat(recipes): add ImageUploadField component"
```

---

## Task 13: New Recipe page — photo upload + URL import + `?url=` param

**Files:**
- Modify: `src/routes/_app/recipes/new.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ImageUploadField } from '../../../components/recipes/ImageUploadField'
import {
  RecipeForm,
  type RecipeFormValues,
} from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/new')({
  component: NewRecipe,
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === 'string' ? search.url : undefined,
  }),
})

function NewRecipe() {
  const create = useMutation(api.recipes.create)
  const importFromUrl = useAction(api.recipeImport.importFromUrl)
  const navigate = useNavigate()
  const { url: initialUrl } = Route.useSearch()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [importUrl, setImportUrl] = useState(initialUrl ?? '')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [imported, setImported] = useState<{
    values: RecipeFormValues
    sourceUrl: string
    version: number
  } | null>(null)

  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>()
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const runImport = async (url: string) => {
    if (!url.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const result = await importFromUrl({ url: url.trim() })
      setImported({
        values: {
          title: result.title,
          description: result.description,
          ingredients: result.ingredients,
          steps: result.steps,
          tags: result.tags,
        },
        sourceUrl: result.sourceUrl,
        version: Date.now(),
      })
      setImageId(result.imageId)
      setImageUrl(result.imageUrl)
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Could not import that recipe',
      )
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    if (initialUrl) runImport(initialUrl)
    // Only ever run once, for the URL present when the page first loaded.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>

      <div className="mx-auto mb-6 max-w-2xl rounded-xl border p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Import from URL</span>
          <div className="flex gap-2">
            <input
              className="w-full rounded border px-2 py-1"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://example.com/some-recipe"
            />
            <button
              type="button"
              disabled={importing || !importUrl.trim()}
              onClick={() => runImport(importUrl)}
              className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </label>
        {importError && (
          <p className="mt-2 text-sm text-red-800">{importError}</p>
        )}
        {imported && !importing && !importError && (
          <p className="mt-2 text-sm text-green-700">
            Imported — review the details below, then save.
          </p>
        )}
      </div>

      <ImageUploadField
        imageUrl={imageUrl}
        onChange={(id) => {
          setImageId(id)
          if (id === undefined) setImageUrl(null)
        }}
      />

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <RecipeForm
        key={imported?.version ?? 'blank'}
        submitting={submitting}
        initial={imported?.values}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id = await create({
              ...values,
              sourceUrl: imported?.sourceUrl,
              imageId,
            })
            navigate({ to: '/recipes/$recipeId', params: { recipeId: id } })
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Could not save recipe',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app/recipes/new.tsx
git commit -m "feat(recipes): add photo upload, URL import, and ?url= support to New Recipe"
```

---

## Task 14: Edit Recipe page — photo upload

**Files:**
- Modify: `src/routes/_app/recipes/$recipeId.edit.tsx`

Restructures the route into an outer `EditRecipe` (data loading + the loading/not-found guards) and an inner `EditRecipeForm` that only mounts once the recipe has loaded — this is required so `useState(recipe.imageId)` can safely seed its initial value from the loaded recipe (calling that hook conditionally, after an early return that sometimes fires, would violate the Rules of Hooks; `RecipeForm`'s `initial` prop already relies on this same "child only mounts once data is ready" pattern).

- [ ] **Step 1: Replace the file contents**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { ImageUploadField } from '../../../components/recipes/ImageUploadField'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/$recipeId/edit')({
  component: EditRecipe,
})

type RecipeDetail = Doc<'recipes'> & { imageUrl: string | null }

function EditRecipe() {
  const { recipeId } = Route.useParams()
  const recipe = useQuery(api.recipes.get, { id: recipeId as Id<'recipes'> })

  if (recipe === undefined)
    return <p className="text-sm opacity-60">Loading…</p>
  if (recipe === null)
    return <p className="text-sm opacity-60">Recipe not found.</p>

  return <EditRecipeForm recipe={recipe} />
}

function EditRecipeForm({ recipe }: { recipe: RecipeDetail }) {
  const update = useMutation(api.recipes.update)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>(
    recipe.imageId,
  )
  const [imageUrl, setImageUrl] = useState<string | null>(recipe.imageUrl)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit recipe</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <ImageUploadField
        imageUrl={imageUrl}
        onChange={(id) => {
          setImageId(id)
          if (id === undefined) setImageUrl(null)
        }}
      />

      <RecipeForm
        submitting={submitting}
        initial={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          rating: recipe.rating,
        }}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({ id: recipe._id, ...values, imageId })
            navigate({ to: '/recipes/$recipeId', params: { recipeId: recipe._id } })
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Could not save recipe',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app/recipes/\$recipeId.edit.tsx
git commit -m "feat(recipes): add photo upload to Edit Recipe"
```

---

## Task 15: Recipe detail page — show import source

**Files:**
- Modify: `src/routes/_app/recipes/$recipeId.tsx`

- [ ] **Step 1: Add the source link**

In `src/routes/_app/recipes/$recipeId.tsx`, right after the `{recipe.description && ...}` block, add:

```tsx
      {recipe.sourceUrl && (
        <p className="mb-4 text-xs opacity-60">
          Imported from{' '}
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')}
          </a>
        </p>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds. (`recipe.sourceUrl` is available because `get`'s `{ ...recipe, imageUrl }` spread now includes the schema field from Task 1.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app/recipes/\$recipeId.tsx
git commit -m "feat(recipes): show import source link on the detail page"
```

---

## Task 16: Document the new env var

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Env vars" section**

In `CLAUDE.md`, find the line describing Convex deployment env vars and extend it:

```markdown
Convex deployment (server-side, set via `convex env set` / `convex env default set`,
never in a committed file): `CLERK_JWT_ISSUER_DOMAIN` — set on dev, prod, and as the
default for preview deployments (PR previews create a fresh Convex backend per PR
that doesn't inherit dev/prod env vars). `ANTHROPIC_API_KEY` — powers the recipe
URL-import action's AI fallback; optional (JSON-LD-only imports work without it, and
recipes without matching JSON-LD simply fail to import if it's unset).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document ANTHROPIC_API_KEY env var for recipe import"
```

---

## Task 17: Full test suite + typecheck + lint

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm run test`
Expected: all tests pass, including every new file from Tasks 3, 4, 6, 7, 8, 9, 10.

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: succeeds.

- [ ] **Step 3: Lint the `src/` changes**

Run: `pnpm run check`
Expected: succeeds. (Note: `biome.json`'s `files.includes` only covers `src/**` and a few root files — it does not lint `convex/**`. This is a pre-existing project configuration, not something to fix as part of this plan.)

- [ ] **Step 4: Fix any failures**

If anything fails, fix it before moving on — don't proceed to manual verification with a red test suite.

---

## Task 18: Manual verification

**Files:** none (manual browser/CLI verification)

This covers everything Tasks 5 and 12 couldn't cover with automated tests: the real `fetch`-driven Convex action, and the real Convex-`useMutation`-driven upload component.

- [ ] **Step 1: Set the Anthropic API key (if not already set)**

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

- [ ] **Step 2: Start the dev server**

Run: `pnpm run dev:watch`

- [ ] **Step 3: Verify ratings**

In the browser: open a recipe's Edit page, click stars to set a rating, save, confirm the list/detail views show the right number of filled stars. Click the same star again on Edit to clear it; save; confirm it's gone.

- [ ] **Step 4: Verify manual photo upload**

On New Recipe (or Edit), use the Photo field to upload an image. Confirm the preview shows immediately, save the recipe, and confirm the photo appears on the detail page and in the recipe list.

- [ ] **Step 5: Verify view mode toggle**

On the recipe list page, click through Grid / Banner / Compact. Confirm the layout changes, a recipe without a photo shows a placeholder (no broken image icon) in all three modes, and reloading the page keeps the last-selected mode.

- [ ] **Step 6: Verify URL import — JSON-LD path**

Find a recipe URL on an ordinary food blog (most embed `schema.org/Recipe` JSON-LD for Google's rich snippets — any WordPress site using a recipe plugin like Tasty Recipes or WP Recipe Maker qualifies). Paste it into "Import from URL" on the New Recipe page, click Import, confirm the form fields prefill correctly, then save and check the detail page shows "Imported from ⟨host⟩".

- [ ] **Step 7: Verify the `?url=` query param**

Navigate directly to `/recipes/new?url=<the same URL, URL-encoded>`. Confirm the import box prefills and the fetch fires automatically on load.

- [ ] **Step 8: Verify failure handling**

Try importing a clearly invalid URL (e.g. `https://localhost:1/nope`) and confirm a friendly inline error appears and the form stays usable for manual entry. If you can find a site known to block bots, try that too and confirm the "blocks automated access" message appears rather than a crash.

- [ ] **Step 9: Invoke the project's verify skill**

Use the `verify` skill (per `.claude/skills/verify/SKILL.md`) for a final end-to-end pass over the Recipes routes before considering this complete.
