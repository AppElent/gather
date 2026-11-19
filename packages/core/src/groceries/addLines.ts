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
  /**
   * Bring the list up to this amount instead of adding it (the week menu,
   * APP-321): an open item with the same name that already has enough is
   * left as it is, one with less grows to the amount, and a name already on
   * the list never gets a second row. Run it twice and nothing changes.
   */
  topUp?: boolean
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

/** Grams and millilitres: rounded to a step that grows with the amount. */
const FINE = new Set<GroceryUnit>(['g', 'ml'])
/** Measures that scale in halves: "1,5 el", "0,5 kg"; quarters below one. */
const HALVES = new Set<GroceryUnit>(['kg', 'l', 'cl', 'dl', 'el', 'tl'])

/** 1 g below 50, 5 g below 250, then 25 g: "7 g gist", "120 g", "300 g". */
function fineStep(value: number): number {
  return value < 50 ? 1 : value < 250 ? 5 : 25
}

/**
 * An amount for another number of servings (`factor` = wanted / written).
 * Grams and millilitres round to a step that grows with the amount, spoons
 * and kilos to halves (quarters below one), and anything counted — eggs,
 * tins, packs — rounds up: nobody buys 2.4 tins. Fewer servings never ask
 * for more than the recipe wrote, and the recipe's own servings keep the
 * amount as written.
 */
export function scaleGroceryQuantity(
  quantity: number,
  unit: GroceryUnit | undefined,
  factor: number,
): number {
  if (factor === 1 || !(factor > 0)) return quantity
  const value = quantity * factor
  let scaled: number
  if (unit && FINE.has(unit)) {
    const step = fineStep(value)
    scaled = Math.max(1, Math.round(value / step) * step)
  } else if (unit && HALVES.has(unit)) {
    const parts = value < 1 ? 4 : 2
    scaled = Math.max(0.25, Math.ceil(value * parts - 1e-9) / parts)
  } else scaled = Math.max(1, Math.ceil(value - 1e-9))
  if (factor < 1) scaled = Math.min(scaled, quantity)
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
  if (line.quantity === undefined && line.unit === undefined)
    return {
      ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
      ...unitOf(item.unit),
    }
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
    }
  /** A top-up line the list already has enough of: nothing changes. */
  | { kind: 'covered'; by: string; have: GroceryAmount }

/** The id a line that is new in this add goes by until it has a real one. */
export function pendingItemId(lineIndex: number): string {
  return `pending:${lineIndex}`
}

/**
 * For each line in order: the open item with the same name whose amount it
 * adds up with, or new. A line merges into an earlier new line of the same
 * add too, so a recipe that names eggs twice puts them on the list once.
 *
 * A `topUp` line (the week menu) measures itself against an item that was on
 * the list before this add: covered when the item already has as much,
 * otherwise the item grows to what the line asks. Top-up lines for the same
 * item ask together, so "6 eieren" and "4 eieren" want 10. A name already on
 * the list is never added beside it, even when the units do not add up
 * ("2 blik tomaten" covers "400 g tomaten").
 */
export function planGroceryAdds(
  items: readonly GroceryListItem[],
  lines: readonly GroceryAddLine[],
): GroceryAddPlan[] {
  const open: OpenItem[] = items
    .filter((item) => !item.done)
    // An item is matched by its title as stored: the merge never reads an
    // amount out of a title (APP-309), so "2 pak melk" from before amounts
    // stays as it is and "Melk" is added beside it.
    .map((item) => ({
      id: item.id,
      key: groceryKey(item.title),
      listed: true,
      need: 0,
      ...amountOf(item),
    }))
  return lines.map((line, index): GroceryAddPlan => {
    const key = groceryKey(line.title)
    const same = key ? open.filter((item) => item.key === key) : []
    for (const item of same) {
      const plan =
        line.topUp && item.listed ? topUpPlan(item, line) : mergePlan(item, line)
      if (plan) return plan
    }
    const listed = line.topUp && same.find((item) => item.listed)
    if (listed)
      return { kind: 'covered', by: listed.id, have: amountOf(listed) }
    open.push({
      id: pendingItemId(index),
      key,
      listed: false,
      need: 0,
      ...amountOf(line),
    })
    return { kind: 'new' }
  })
}

/** An open item as the plan sees it, its amount updated as lines land. */
interface OpenItem extends GroceryAmount {
  id: string
  key: string
  /** On the list before this add, rather than a line of it. */
  listed: boolean
  /** What this add's top-up lines ask of it so far, in its unit. */
  need: number
}

function amountOf(amount: GroceryAmount): GroceryAmount {
  return {
    ...(amount.quantity !== undefined ? { quantity: amount.quantity } : {}),
    ...unitOf(amount.unit),
  }
}

function mergePlan(item: OpenItem, line: GroceryAddLine): GroceryAddPlan | null {
  const to = addGroceryAmounts(item, line)
  if (!to) return null
  const from = amountOf(item)
  item.quantity = to.quantity
  item.unit = to.unit
  return { kind: 'merge', into: item.id, from, to }
}

function topUpPlan(item: OpenItem, line: GroceryAddLine): GroceryAddPlan | null {
  const have = amountOf(item)
  // A line without an amount ("olijfolie") is covered by the item itself.
  if (line.quantity === undefined && line.unit === undefined)
    return { kind: 'covered', by: item.id, have }
  // The line's amount in the item's unit: added to nothing.
  const asked = addGroceryAmounts({ quantity: 0, ...unitOf(item.unit) }, line)
  if (!asked || asked.quantity === undefined) return null
  item.need = Math.min(
    roundGroceryQuantity(item.need + asked.quantity),
    GROCERY_QUANTITY_MAX,
  )
  const current = item.quantity ?? 1
  if (item.need <= current) return { kind: 'covered', by: item.id, have }
  item.quantity = item.need
  return {
    kind: 'merge',
    into: item.id,
    from: have,
    to: { quantity: item.need, ...unitOf(item.unit) },
  }
}

/** One line of `combineGroceryLines`: an item, and the lines it came from. */
export interface CombinedGroceryLine extends GroceryAddLine {
  /** Indexes into the lines given, in order. */
  from: number[]
}

/**
 * Lines from several sources as one line per item (the week menu, APP-321):
 * when two recipes name onions, the list is asked for them once. The same
 * name with units that add up merges, by the same rule as `planGroceryAdds`;
 * anything else stays a line of its own. In order of first appearance.
 */
export function combineGroceryLines(
  lines: readonly GroceryAddLine[],
): CombinedGroceryLine[] {
  const plain = lines.map(({ title, quantity, unit }) => ({
    title,
    ...amountOf({ quantity, unit }),
  }))
  const combined = new Map<string, CombinedGroceryLine>()
  planGroceryAdds([], plain).forEach((plan, index) => {
    if (plan.kind === 'merge') {
      const into = combined.get(plan.into)
      if (into) {
        into.from.push(index)
        delete into.quantity
        delete into.unit
        Object.assign(into, amountOf(plan.to))
        return
      }
    }
    combined.set(pendingItemId(index), { ...plain[index], from: [index] })
  })
  return [...combined.values()]
}

/** Whether a value is one of the list's units (an AI answer, a stored cache). */
export function isGroceryUnit(value: unknown): value is GroceryUnit {
  return (
    typeof value === 'string' &&
    (GROCERY_UNITS as readonly string[]).includes(value)
  )
}
