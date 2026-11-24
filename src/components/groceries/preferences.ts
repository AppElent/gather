import { isGroceryUnit } from '@gather/core/groceries'
import type { CachedRead } from '@gather/core/grocery-ai-batches'

const LAST_LIST_PREFIX = 'gather:last-grocery-list:'
const RECIPE_CACHE_PREFIX = 'gather:recipe-grocery-lines:'

export function readLastGroceryList(groupSlug: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(`${LAST_LIST_PREFIX}${groupSlug}`)
  } catch {
    return null
  }
}

export function writeLastGroceryList(groupSlug: string, listId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${LAST_LIST_PREFIX}${groupSlug}`, listId)
  } catch {
    // Storage may be full or restricted; the list switch still works in memory.
  }
}

/** A cached AI reading, or null when the AI returned plain text. */
export type CachedLine = CachedRead | null

interface StoredRecipeLines {
  digest: string
  lines: Record<string, CachedLine>
}

export function readCachedRecipeLines(
  recipeId: string,
  digest: string,
): Record<string, CachedLine> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(`${RECIPE_CACHE_PREFIX}${recipeId}`)
    if (!raw) return {}
    const stored = JSON.parse(raw) as Partial<StoredRecipeLines>
    if (stored.digest !== digest || typeof stored.lines !== 'object') return {}
    const out: Record<string, CachedLine> = {}
    for (const [text, read] of Object.entries(stored.lines ?? {})) {
      if (read === null) {
        out[text] = null
        continue
      }
      if (!read || typeof read.name !== 'string' || !read.name) continue
      out[text] = {
        name: read.name,
        ...(typeof read.quantity === 'number'
          ? { quantity: read.quantity }
          : {}),
        ...(isGroceryUnit(read.unit) ? { unit: read.unit } : {}),
      }
    }
    return out
  } catch {
    return {}
  }
}

export function cacheRecipeLines(
  recipeId: string,
  digest: string,
  lines: Record<string, CachedLine>,
): void {
  if (typeof window === 'undefined') return
  try {
    const merged = { ...readCachedRecipeLines(recipeId, digest), ...lines }
    window.localStorage.setItem(
      `${RECIPE_CACHE_PREFIX}${recipeId}`,
      JSON.stringify({ digest, lines: merged } satisfies StoredRecipeLines),
    )
  } catch {
    // Cache is best-effort.
  }
}

/** Clear cached AI ingredient readings when a recipe is edited. */
export function clearCachedRecipeLines(recipeId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(`${RECIPE_CACHE_PREFIX}${recipeId}`)
  } catch {
    // Ignore storage errors.
  }
}
