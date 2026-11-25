/**
 * What the AI read in a recipe's ingredients, kept on this phone (APP-312):
 * opening the sheet for the same recipe again costs no AI call.
 *
 * Kept per recipe and stamped with the ingredients it was read from
 * (`ingredientsDigest`): a recipe edited anywhere reads afresh, and saving an
 * edit here clears it at once. On the phone rather than on the recipe, so
 * the recipe's schema and every installed app stay as they are; the cost is
 * that another phone in the household asks once for itself.
 */
import { isGroceryUnit } from '@gather/core/groceries'
import type { CachedRead } from '@gather/core/grocery-ai-batches'
import {
  clearPreference,
  readPreference,
  recipeGroceryLinesKey,
  writePreference,
} from '../../../prefs/localPreference'

export type { CachedRead }

/** A reading, or null: the AI read the line as plain text. */
export type CachedLine = CachedRead | null

interface Stored {
  digest: string
  lines: Record<string, CachedLine>
}

/** The cached readings for a recipe, by line text, while they still apply. */
export function readCachedLines(
  recipeId: string,
  digest: string,
): Record<string, CachedLine> {
  const raw = readPreference(recipeGroceryLinesKey(recipeId))
  if (!raw) return {}
  try {
    const stored = JSON.parse(raw) as Partial<Stored>
    if (stored.digest !== digest || typeof stored.lines !== 'object') return {}
    const lines: Record<string, CachedLine> = {}
    for (const [text, read] of Object.entries(stored.lines ?? {})) {
      if (read === null) {
        lines[text] = null
        continue
      }
      if (!read || typeof read.name !== 'string' || !read.name) continue
      lines[text] = {
        name: read.name,
        ...(typeof read.quantity === 'number' ? { quantity: read.quantity } : {}),
        ...(isGroceryUnit(read.unit) ? { unit: read.unit } : {}),
      }
    }
    return lines
  } catch {
    return {}
  }
}

/** Add readings to a recipe's cache; readings for other ingredients go. */
export function cacheLines(
  recipeId: string,
  digest: string,
  lines: Record<string, CachedLine>,
) {
  const merged = { ...readCachedLines(recipeId, digest), ...lines }
  writePreference(
    recipeGroceryLinesKey(recipeId),
    JSON.stringify({ digest, lines: merged } satisfies Stored),
  )
}

/** Editing a recipe clears what was read in it. */
export function clearCachedLines(recipeId: string) {
  clearPreference(recipeGroceryLinesKey(recipeId))
}
