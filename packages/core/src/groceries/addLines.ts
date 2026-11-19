/**
 * Lines from somewhere else onto a grocery list (APP-312,
 * `designs/groceries/README.md` section 5): a recipe's ingredients today, the
 * week menu's later (APP-321). Source-agnostic on purpose: the input is lines
 * with an amount, a unit, the servings they are for and a source label.
 *
 * - `readIngredientLine`: an ingredient as a recipe writes it ("2 rode
 *   paprika's, in reepjes") read into name and amount with the same parser
 *   the composer uses (`parse.ts`), or null when only the AI can read it.
 * - `scaleGroceryQuantity`: the amount for another number of servings.
 * - `planGroceryAdds`: which lines merge into an item already on the list
 *   (same name, compatible unit: the amounts add up) and which are new. The
 *   phone shows the plan before adding; Convex runs the same plan when it
 *   adds, against the list as it is then.
 */

import {
  GROCERY_QUANTITY_MAX,
  groceryAddFields,
  roundGroceryQuantity,
} from './amount'
import { groceryKey } from './normalise'
import { GROCERY_UNITS, type GroceryUnit, parseGroceryLine } from './parse'

/** An amount as an item carries it: either part may be absent. */
export interface GroceryAmount {
  quantity?: number
  unit?: GroceryUnit
}

/** One line to put on a list: what the item will be called, and how much. */
export interface GroceryAddLine extends GroceryAmount {
  title: string
}

/** What `readIngredientLine` made of a line it could read. */
export interface ReadIngredient extends GroceryAmount {
  name: string
}

/**
 * Words that measure by eye. A line built on one is not something the local
 * parser can turn into an amount, so it goes to the AI ("een handje
 * basilicum", "1 kopje rijst").
 */
const VAGUE_MEASURES = new Set([
  'hand',
  'handen',
  'handje',
  'handjes',
  'handjevol',
  'handvol',
  'scheut',
  'scheutje',
  'scheutjes',
  'beetje',
  'kopje',
  'kopjes',
  'kop',
  'glas',
  'glaasje',
  'takje',
  'takjes',
  'plukje',
  'klontje',
  'klont',
  'mespunt',
  'mespuntje',
  'stukje',
  'stukjes',
  'paar',
  'wat',
  'cup',
  'cups',
  'handful',
  'splash',
  'dash',
  'drizzle',
  'sprig',
  'sprigs',
  'some',
  'few',
])

/** What a recipe adds after the ingredient that a list does not need. */
const SERVING_HINTS =
  /\s+(?:naar smaak|to taste|optioneel|optional|\(optioneel\)|\(optional\)|voor erbij|for serving|om te serveren)$/i

/**
 * An ingredient as a recipe writes it, read into name and amount, or null
 * when the line needs the AI.
 *
 * Before the composer's parser sees it, the line loses what only a cook
 * needs: a note in brackets ("(400 g)"), the preparation after a comma
 * (", gesnipperd"; "1,5 l" keeps its comma), "naar smaak". "Een ui" is one
 * ui, "1 1/2" is 1.5, and a range buys the most ("2-3 tomaten" is 3).
 */
export function readIngredientLine(line: string): ReadIngredient | null {
  let text = line
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,(?!\d).*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  for (let round = 0; round < 2; round++) text = text.replace(SERVING_HINTS, '')
  text = text
    .replace(/^(?:een|a|an)\s+/i, '1 ')
    .replace(/^(\d+)\s+(\d+)\/(\d+)(?=\s)/, (_, whole, top, bottom) =>
      Number(bottom) > 0
        ? String(Number(whole) + Number(top) / Number(bottom))
        : whole,
    )
    .replace(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)(?=\s)/, '$2')
  if (!text) return null

  // "snufje zout", "teentje knoflook": a unit without a number is one of it.
  const firstWord = /^([a-zA-Z]+)\s+(.+)$/.exec(text)
  if (firstWord && !/^\d/.test(text)) {
    const unit = unitWord(firstWord[1])
    if (unit) return named(firstWord[2], 1, unit)
  }

  const parsed = parseGroceryLine(text)
  const name = parsed.name
  if (/\d/.test(name)) return null
  const words = name.toLowerCase().split(' ')
  if (words.some((word) => VAGUE_MEASURES.has(word))) return null
  return named(name, parsed.quantity ?? undefined, parsed.unit ?? undefined)
}

function named(
  name: string,
  quantity: number | undefined,
  unit: GroceryUnit | undefined,
): ReadIngredient | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (quantity !== undefined && !(quantity > 0 && quantity <= GROCERY_QUANTITY_MAX))
    return null
  return {
    name: capitalise(trimmed),
    ...(quantity !== undefined
      ? { quantity: roundGroceryQuantity(quantity) }
      : {}),
    ...(unit !== undefined ? { unit } : {}),
  }
}

function unitWord(word: string): GroceryUnit | null {
  // The composer's parser owns the unit words; ask it with a stand-in name.
  const parsed = parseGroceryLine(`1 ${word} x`)
  return parsed.unit
}

/** A list item reads as a name: "tomatenblokjes" is "Tomatenblokjes". */
export function capitalise(name: string): string {
  return name.charAt(0).toLocaleUpperCase() + name.slice(1)
}

/** Whether a unit is a weight or volume that rounds to 25 when scaled. */
const ROUND_TO_25 = new Set<GroceryUnit>(['g', 'ml'])
/** Measures that scale in halves: "1,5 el", "0,5 kg". */
const HALVES = new Set<GroceryUnit>(['kg', 'l', 'cl', 'dl', 'el', 'tl'])

/**
 * An amount for another number of servings (`factor` = wanted / written).
 * Grams and millilitres round to 25, spoons and kilos to halves, and
 * anything counted — eggs, tins, packs — rounds up: nobody buys 2.4 tins.
 * At the recipe's own servings the amount stays as written.
 */
export function scaleGroceryQuantity(
  quantity: number,
  unit: GroceryUnit | undefined,
  factor: number,
): number {
  if (factor === 1 || !(factor > 0)) return quantity
  const value = quantity * factor
  let scaled: number
  if (unit && ROUND_TO_25.has(unit))
    scaled = Math.max(25, Math.round(value / 25) * 25)
  else if (unit && HALVES.has(unit))
    scaled = Math.max(0.5, Math.ceil(value * 2 - 1e-9) / 2)
  else scaled = Math.max(1, Math.ceil(value - 1e-9))
  return Math.min(roundGroceryQuantity(scaled), GROCERY_QUANTITY_MAX)
}

/** Units of one measure, as a multiple of its smallest. */
const MEASURES: ReadonlyArray<Partial<Record<GroceryUnit, number>>> = [
  { g: 1, kg: 1000 },
  { ml: 1, cl: 10, dl: 100, l: 1000 },
]

/** A count is no unit or `stuks`: "6 eieren" and "6 stuks eieren" add up. */
function counted(unit: GroceryUnit | undefined): boolean {
  return unit === undefined || unit === 'stuks'
}

/**
 * `line` added to `item`'s amount, in the item's unit; null when the two do
 * not add up (a tin and grams). A line without any amount ("olijfolie") is
 * already covered by the item and changes nothing. An item without an amount
 * is one of it, as the list shows it.
 */
export function addGroceryAmounts(
  item: GroceryAmount,
  line: GroceryAmount,
): GroceryAmount | null {
  if (line.quantity === undefined && line.unit === undefined) return { ...item }
  const have = item.quantity ?? 1
  const add = line.quantity ?? 1
  const total = (value: number) =>
    Math.min(roundGroceryQuantity(value), GROCERY_QUANTITY_MAX)
  if (item.unit === line.unit || (counted(item.unit) && counted(line.unit)))
    return { quantity: total(have + add), ...unitOf(item.unit) }
  if (item.unit === undefined || line.unit === undefined) return null
  for (const measure of MEASURES) {
    const into = measure[item.unit]
    const from = measure[line.unit]
    if (into !== undefined && from !== undefined)
      return { quantity: total(have + (add * from) / into), unit: item.unit }
  }
  return null
}

function unitOf(unit: GroceryUnit | undefined) {
  return unit === undefined ? {} : { unit }
}

/** An item already on the list, as the merge sees it. */
export interface GroceryListItem extends GroceryAddLine {
  id: string
  done: boolean
}

/** What happens to one line when it is added. */
export type GroceryAddPlan =
  | { kind: 'new' }
  | {
      kind: 'merge'
      /** The item it merges into: an id on the list, or `pending:{n}`, the n-th line of this same add. */
      into: string
      from: GroceryAmount
      to: GroceryAmount
      /**
       * The item's title without the amount it was typed with, when it came
       * from before amounts ("2 pak melk" is "melk" with 2 pak): the merged
       * amount goes beside it, so the title loses its own.
       */
      title?: string
    }

/** The id a line that is new in this add goes by until it has a real one. */
export function pendingItemId(lineIndex: number): string {
  return `pending:${lineIndex}`
}

/**
 * An item as the merge reads it. One typed before amounts kept its amount in
 * the title ("2 pak melk"), so a title without an amount beside it is read
 * again first; `retitled` says so.
 */
function readItem(item: GroceryAddLine): GroceryAddLine & { retitled: boolean } {
  if (item.quantity !== undefined || item.unit !== undefined)
    return { ...item, retitled: false }
  const fields = groceryAddFields(item.title)
  return { ...fields, retitled: fields.title !== item.title.trim() }
}

/**
 * For each line in order: the open item with the same name whose amount it
 * adds up with, or new. A line merges into an earlier new line of the same
 * add too, so a recipe that names eggs twice puts them on the list once.
 */
export function planGroceryAdds(
  items: readonly GroceryListItem[],
  lines: readonly GroceryAddLine[],
): GroceryAddPlan[] {
  const open = items
    .filter((item) => !item.done)
    .map((item) => {
      const read = readItem(item)
      return { ...read, id: item.id, key: groceryKey(read.title) }
    })
  return lines.map((line, index): GroceryAddPlan => {
    const key = groceryKey(line.title)
    if (key) {
      for (const item of open) {
        if (item.key !== key) continue
        const to = addGroceryAmounts(item, line)
        if (!to) continue
        const from: GroceryAmount = {
          ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
          ...unitOf(item.unit),
        }
        const retitle = item.retitled ? { title: item.title } : {}
        item.quantity = to.quantity
        item.unit = to.unit
        item.retitled = false
        return { kind: 'merge', into: item.id, from, to, ...retitle }
      }
    }
    open.push({
      ...line,
      id: pendingItemId(index),
      key,
      retitled: false,
    })
    return { kind: 'new' }
  })
}

/** Whether a value is one of the list's units (an AI answer, a stored cache). */
export function isGroceryUnit(value: unknown): value is GroceryUnit {
  return (
    typeof value === 'string' &&
    (GROCERY_UNITS as readonly string[]).includes(value)
  )
}
