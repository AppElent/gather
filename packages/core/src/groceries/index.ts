/**
 * Grocery recognition shared by the phone, the web, Convex and the MCP server:
 * amount and unit from a typed line, and the aisle it belongs in
 * (`designs/groceries/README.md`, "Recognition"; APP-353).
 *
 * The dictionary is generated (`scripts/groceries/build-dictionary.ts`) from
 * Open Food Facts, Open Beauty Facts and Open Products Facts (ODbL), NEVO
 * online 2025/9.0 (RIVM) and a hand-written list. Attribution and licence:
 * `packages/core/src/groceries/data/README.md`.
 */

import { DICTIONARY_DATA } from './data/dictionary.generated'
import { createGroceryDictionary, type GroceryDictionary } from './dictionary'
import {
  type GroceryAisleContext,
  type ResolvedGroceryLine,
  resolveGroceryLine,
} from './resolve'

export * from './addLines'
export * from './aisles'
export * from './amount'
export type { DictionaryHit, DictionaryMatch, GroceryDictionary } from './dictionary'
export {
  cleanGroceryName,
  groceryKey,
} from './normalise'
export * from './parse'
export type {
  GroceryAisleContext,
  GroceryAisleSource,
  ResolvedGroceryLine,
} from './resolve'

let bundled: GroceryDictionary | undefined

/** The bundled dictionary, built on first use (a few milliseconds). */
export function groceryDictionary(): GroceryDictionary {
  bundled ??= createGroceryDictionary(DICTIONARY_DATA)
  return bundled
}

/** Amount, unit and aisle of a typed line against the bundled dictionary. */
export function recogniseGroceryLine(
  line: string,
  context: GroceryAisleContext = {},
): ResolvedGroceryLine {
  return resolveGroceryLine(line, groceryDictionary(), context)
}
