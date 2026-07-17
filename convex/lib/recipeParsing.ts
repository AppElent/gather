import {
  type NutritionFacts,
  parseNutritionValue,
  parseServings,
} from './nutrition'

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
      servings: parseServings(node.recipeYield),
      nutrition: extractNutrition(node.nutrition),
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
  const decoded = decodeHtmlEntities(withoutTags)
  const collapsed = decoded.replace(/\s+/g, ' ').trim()
  return collapsed.slice(0, HTML_TEXT_MAX_LENGTH)
}
