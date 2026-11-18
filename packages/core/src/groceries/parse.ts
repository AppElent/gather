/**
 * Amount and unit from a typed grocery line (`designs/groceries/README.md`,
 * "Recognition" 1): "2 pakken melk" is 2 pak of "melk", "500g gehakt" is 500 g
 * of "gehakt", "melk 2" is 2 of "melk". Local and offline; the eval set
 * (`eval/groceryLines.txt`) holds it to 98%.
 */

export const GROCERY_UNITS = [
  'stuks',
  'pak',
  'fles',
  'pot',
  'zak',
  'tros',
  'bos',
  'blik',
  'doos',
  'bak',
  'krat',
  'rol',
  'net',
  'krop',
  'stronk',
  'tube',
  'reep',
  'plak',
  'bol',
  'teentje',
  'el',
  'tl',
  'snuf',
  'g',
  'kg',
  'ml',
  'cl',
  'dl',
  'l',
] as const

export type GroceryUnit = (typeof GROCERY_UNITS)[number]

export interface ParsedGroceryLine {
  /** Null when the line names no amount; the list shows such an item as 1. */
  quantity: number | null
  unit: GroceryUnit | null
  /** The line without its amount and unit, as typed otherwise. */
  name: string
}

/** Every spelling a unit is typed in, Dutch and English, singular and plural. */
const UNIT_WORDS: Record<GroceryUnit, readonly string[]> = {
  stuks: ['stuks', 'stuk', 'st', 'stk', 'piece', 'pieces', 'pc', 'pcs'],
  pak: ['pak', 'pakken', 'pakje', 'pakjes', 'pack', 'packs', 'packet', 'packets'],
  fles: ['fles', 'flessen', 'flesje', 'flesjes', 'bottle', 'bottles'],
  pot: ['pot', 'potten', 'potje', 'potjes', 'jar', 'jars'],
  zak: ['zak', 'zakken', 'zakje', 'zakjes', 'bag', 'bags'],
  tros: ['tros', 'trossen'],
  bos: ['bos', 'bossen', 'bosje', 'bosjes', 'bunch', 'bunches'],
  blik: ['blik', 'blikken', 'blikje', 'blikjes', 'tin', 'tins', 'can', 'cans'],
  doos: ['doos', 'dozen', 'doosje', 'doosjes', 'box', 'boxes'],
  bak: ['bak', 'bakken', 'bakje', 'bakjes', 'tub', 'tubs', 'punnet', 'punnets'],
  krat: ['krat', 'kratten', 'crate', 'crates'],
  rol: ['rol', 'rollen', 'rolletje', 'rolletjes', 'roll', 'rolls'],
  net: ['net', 'netten', 'netje', 'netjes'],
  krop: ['krop', 'kroppen'],
  stronk: ['stronk', 'stronken'],
  tube: ['tube', 'tubes'],
  reep: ['reep', 'repen', 'bar', 'bars'],
  plak: ['plak', 'plakken', 'plakje', 'plakjes', 'slice', 'slices'],
  bol: ['bol', 'bollen'],
  teentje: ['teentje', 'teentjes', 'teen', 'tenen', 'clove', 'cloves'],
  el: ['el', 'eetlepel', 'eetlepels', 'tbsp', 'tablespoon', 'tablespoons'],
  tl: ['tl', 'theelepel', 'theelepels', 'tsp', 'teaspoon', 'teaspoons'],
  snuf: ['snuf', 'snufje', 'snufjes', 'pinch'],
  g: ['g', 'gr', 'gram', 'grams', 'gramm'],
  kg: ['kg', 'kilo', 'kilos', "kilo's", 'kilogram'],
  ml: ['ml', 'milliliter', 'millilitre'],
  cl: ['cl', 'centiliter'],
  dl: ['dl', 'deciliter'],
  l: ['l', 'liter', 'liters', 'litre', 'litres', 'ltr'],
}

const UNIT_BY_WORD = new Map<string, GroceryUnit>(
  Object.entries(UNIT_WORDS).flatMap(([unit, words]) =>
    words.map((word) => [word, unit as GroceryUnit] as const),
  ),
)

/**
 * Units that read as an amount of one when typed without a number: "zak sla",
 * "blik tomaten". A weight or a spoon without a number is not an amount.
 */
const COUNTABLE_UNITS = new Set<GroceryUnit>([
  'pak',
  'fles',
  'pot',
  'zak',
  'tros',
  'bos',
  'blik',
  'doos',
  'bak',
  'krat',
  'rol',
  'net',
  'krop',
  'stronk',
  'tube',
  'reep',
])

/** A number after these words is part of the name: "Pampers maat 4". */
const NOT_AN_AMOUNT_BEFORE = new Set([
  'maat',
  'size',
  'factor',
  'spf',
  'stage',
  'nr',
  'nummer',
  'no',
  'type',
])

const FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
}

const NUMBER = String.raw`(?:\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔]|\d+\/\d+)`

function toNumber(text: string): number | null {
  const compact = text.replace(/\s+/g, '')
  const fraction = /^(\d+)\/(\d+)$/.exec(compact)
  if (fraction) {
    const denominator = Number(fraction[2])
    return denominator === 0 ? null : Number(fraction[1]) / denominator
  }
  const glyph = /^(\d*)([½¼¾⅓⅔])$/.exec(compact)
  if (glyph) return Number(glyph[1] || 0) + (FRACTIONS[glyph[2]] ?? 0)
  const value = Number(compact.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function unitOf(word: string): GroceryUnit | null {
  return UNIT_BY_WORD.get(word.toLowerCase().replace(/\.$/, '')) ?? null
}

/** Drop a leading "of" ("2 tins of tomatoes"); English only. */
function trimOf(name: string): string {
  return name.replace(/^of\s+/i, '').trim()
}

function result(
  quantity: number | null,
  unit: GroceryUnit | null,
  name: string,
): ParsedGroceryLine | null {
  if (quantity !== null && !(quantity > 0)) return null
  const trimmed = trimOf(name)
  if (!trimmed) return null
  return { quantity, unit, name: trimmed }
}

/**
 * Split a typed line into amount, unit and name. A line it cannot read keeps
 * the whole text as the name, so nothing typed is ever lost.
 */
export function parseGroceryLine(line: string): ParsedGroceryLine {
  const text = line.replace(/\s+/g, ' ').trim()
  return (
    leading(text) ?? trailing(text) ?? { quantity: null, unit: null, name: text }
  )
}

function leading(text: string): ParsedGroceryLine | null {
  // "3x yoghurt", "2 x kaas"
  const times = new RegExp(String.raw`^(${NUMBER})\s*x\s+(.+)$`, 'i').exec(text)
  if (times) return result(toNumber(times[1]), null, times[2])

  // "500g gehakt", "2 pakken melk", "1,5 l cola", "½ kilo uien"
  const withUnit = new RegExp(
    String.raw`^(${NUMBER})\s*([a-zA-Z']+\.?)\s+(.+)$`,
  ).exec(text)
  if (withUnit) {
    const unit = unitOf(withUnit[2])
    if (unit) return result(toNumber(withUnit[1]), unit, withUnit[3])
  }

  // "6 eieren", "2 milk"; the number stands alone, so "7up" stays a name.
  const bare = new RegExp(String.raw`^(${NUMBER})\s+(.+)$`).exec(text)
  if (bare) return result(toNumber(bare[1]), null, bare[2])

  // "zak sla", "blik tomaten", "bag of rice": a container means one. An
  // English container word needs its "of", so "tin foil" stays a name.
  const container = /^([a-zA-Z]+)\s+(.+)$/.exec(text)
  if (container) {
    const word = container[1].toLowerCase()
    const unit = unitOf(word)
    const needsOf = ENGLISH_CONTAINER_WORDS.has(word)
    if (
      unit &&
      COUNTABLE_UNITS.has(unit) &&
      (!needsOf || /^of\s/i.test(container[2]))
    )
      return result(1, unit, container[2])
  }
  return null
}

const ENGLISH_CONTAINER_WORDS = new Set([
  'pack',
  'packet',
  'bottle',
  'jar',
  'bag',
  'bunch',
  'tin',
  'can',
  'box',
  'tub',
  'punnet',
  'crate',
  'roll',
  'bar',
])

function trailing(text: string): ParsedGroceryLine | null {
  // "volle melk 1l", "kipfilet 500 gram", "eieren 10 st", "thee 20 zakjes"
  const withUnit = new RegExp(
    String.raw`^(.+?)\s+(${NUMBER})\s*([a-zA-Z']+\.?)$`,
  ).exec(text)
  if (withUnit) {
    const unit = unitOf(withUnit[3])
    if (unit && !endsWithLabelWord(withUnit[1]))
      return result(toNumber(withUnit[2]), unit, withUnit[1])
  }

  // "melk x2"
  const times = new RegExp(String.raw`^(.+?)\s+x\s*(${NUMBER})$`, 'i').exec(
    text,
  )
  if (times) return result(toNumber(times[2]), null, times[1])

  // "melk 2", but not "Pampers maat 4", "Bavaria 0.0" or "Milner 30+".
  const bare = new RegExp(String.raw`^(.+?)\s+(${NUMBER})$`).exec(text)
  if (bare && !endsWithLabelWord(bare[1]))
    return result(toNumber(bare[2]), null, bare[1])
  return null
}

function endsWithLabelWord(name: string): boolean {
  const last = name.split(' ').at(-1)?.toLowerCase() ?? ''
  return NOT_AN_AMOUNT_BEFORE.has(last)
}
