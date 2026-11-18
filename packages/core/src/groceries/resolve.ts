import type { GroceryAisle } from './aisles'
import type { DictionaryMatch, GroceryDictionary } from './dictionary'
import { cleanGroceryName, groceryKey } from './normalise'
import { type ParsedGroceryLine, parseGroceryLine } from './parse'

/** Which step of the lookup order chose the aisle. */
export type GroceryAisleSource =
  | 'override'
  | 'history'
  | 'dictionary'
  | 'cache'
  | 'none'

/**
 * The places an aisle can come from besides the bundled dictionary, each
 * keyed by `groceryKey`. Every one is optional: the phone offline has none of
 * them, the server has all three.
 */
export interface GroceryAisleContext {
  /** The Group's own earlier choice for this name. */
  override?: (key: string) => GroceryAisle | undefined
  /** The aisle the Group's earlier items with this name were in. */
  history?: (key: string) => GroceryAisle | undefined
  /** The shared AI cache (`groceryCategoryCache`). */
  cache?: (key: string) => GroceryAisle | undefined
}

export interface ResolvedGroceryLine extends ParsedGroceryLine {
  aisle: GroceryAisle
  source: GroceryAisleSource
  /** How the dictionary matched, when it was the dictionary. */
  match?: DictionaryMatch
  /** `groceryKey` of the name: the key overrides and the cache use. */
  key: string
  /** `cleanGroceryName` of the name: what the AI fallback is asked about. */
  cleanName: string
}

/**
 * Read a typed line and choose its aisle, in the order the design sets
 * (`designs/groceries/README.md`, "Recognition" 2): the Group's own choice,
 * the Group's history, the dictionary, the shared AI cache, then `other`.
 */
export function resolveGroceryLine(
  line: string,
  dictionary: GroceryDictionary,
  context: GroceryAisleContext = {},
): ResolvedGroceryLine {
  const parsed = parseGroceryLine(line)
  const key = groceryKey(parsed.name)
  const cleanName = cleanGroceryName(parsed.name)
  const base = { ...parsed, key, cleanName }
  if (!key) return { ...base, aisle: 'other', source: 'none' }

  const override = context.override?.(key)
  if (override) return { ...base, aisle: override, source: 'override' }
  const history = context.history?.(key)
  if (history) return { ...base, aisle: history, source: 'history' }
  const hit = dictionary.lookup(parsed.name)
  if (hit) {
    // "2 blikken tomaten": the tin was read as the unit, but it still says
    // where the tomatoes are — not with the fresh ones.
    const aisle =
      parsed.unit === 'blik' && hit.aisle === 'produce' ? 'tins_sauces' : hit.aisle
    return { ...base, aisle, source: 'dictionary', match: hit.match }
  }
  const cached = context.cache?.(key)
  if (cached) return { ...base, aisle: cached, source: 'cache' }
  return { ...base, aisle: 'other', source: 'none' }
}
