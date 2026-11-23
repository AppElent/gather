/**
 * Loyalty cards: the rules both clients and Convex share (APP-141).
 *
 * The Retailer catalog's categories, its search, and how a card's tile is
 * drawn without a logo (a monogram on the brand colour). The barcode rules
 * are their own module, `./barcodes`.
 */

/**
 * The picker's categories. `pharmacy` was dropped in APP-198, once production
 * had re-seeded with Holland & Barrett and Vitaminstore under `health`.
 * `programme` (APP-262) is a savings programme that runs across several
 * stores, such as Air Miles, rather than a store of its own.
 */
export const RETAILER_CATEGORIES = [
  'supermarket',
  'wholesale',
  'liquor',
  'drugstore',
  'health',
  'beauty',
  'diy',
  'garden',
  'home',
  'fashion',
  'electronics',
  'books',
  'sports',
  'toys',
  'pets',
  'department',
  'fuel',
  'mobility',
  'programme',
] as const
export type RetailerCategory = (typeof RETAILER_CATEGORIES)[number]

/** Free-text fields on a card, and the longest each may be. */
export const LOYALTY_CARD_LIMITS = {
  storeName: 80,
  holder: 60,
  note: 1000,
} as const

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

/**
 * Lowercase, accents stripped, and only letters and digits kept, so "Hema",
 * "HEMA" and "héma" are one thing and "C&A" matches "c en a". (It folds
 * to "cena"; "ca" finds C&A through its alias.)
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface SearchableRetailer {
  name: string
  aliases: readonly string[]
}

/**
 * How well a retailer answers a query, or null when it does not.
 *
 * Lower is better: the name starting with the query beats a word in the name
 * starting with it, which beats an alias doing either, which beats the query
 * appearing anywhere. Spaces are ignored in the comparison as a last resort,
 * so "albertheijn" still finds Albert Heijn.
 */
export function retailerMatchRank(
  retailer: SearchableRetailer,
  query: string,
): number | null {
  const needle = foldForSearch(query)
  if (!needle) return 0
  const squashedNeedle = needle.replace(/ /g, '')
  const fields = [retailer.name, ...retailer.aliases].map(foldForSearch)
  let best: number | null = null
  fields.forEach((field, index) => {
    const offset = index === 0 ? 0 : 10
    let rank: number | null = null
    if (field.startsWith(needle)) rank = 0
    else if (field.split(' ').some((word) => word.startsWith(needle))) rank = 1
    else if (field.includes(needle)) rank = 2
    else if (field.replace(/ /g, '').includes(squashedNeedle)) rank = 3
    if (rank !== null && (best === null || rank + offset < best)) {
      best = rank + offset
    }
  })
  return best
}

/**
 * The retailers matching a query, best first, then by name. An empty query
 * returns every retailer by name.
 */
export function searchRetailers<T extends SearchableRetailer>(
  retailers: readonly T[],
  query: string,
): T[] {
  const ranked: { retailer: T; rank: number }[] = []
  for (const retailer of retailers) {
    const rank = retailerMatchRank(retailer, query)
    if (rank !== null) ranked.push({ retailer, rank })
  }
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank || a.retailer.name.localeCompare(b.retailer.name),
    )
    .map((entry) => entry.retailer)
}

/**
 * One or two letters for a store tile with no logo: the initials of the
 * first two words, or the first letter of a one-word name. "Albert Heijn" is
 * AH, "Kruidvat" is K, "C&A" is CA.
 */
export function storeMonogram(name: string): string {
  const words = name
    .normalize('NFC')
    .split(/[\s\-&./]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
  if (words.length === 0) return '?'
  const first = [...words[0]].find((char) => /[\p{L}\p{N}]/u.test(char)) ?? ''
  if (words.length === 1) return first.toUpperCase()
  const second = [...words[1]].find((char) => /[\p{L}\p{N}]/u.test(char)) ?? ''
  return `${first}${second}`.toUpperCase()
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Black or white, whichever reads better on a brand colour. Picks the higher
 * WCAG contrast ratio, so a mid-tone yellow gets black and a deep blue white.
 */
export function textOnBrand(hex: string): '#000000' | '#ffffff' {
  if (!isHexColor(hex)) return '#ffffff'
  const luminance = relativeLuminance(hex)
  const withWhite = 1.05 / (luminance + 0.05)
  const withBlack = (luminance + 0.05) / 0.05
  return withBlack >= withWhite ? '#000000' : '#ffffff'
}

/** The tile colour of a custom store with no brand colour: a neutral slate. */
export const DEFAULT_STORE_COLOR = '#475569'

/**
 * The colours a store typed by hand can take (APP-160): the phone offers
 * these as swatches and the web's colour input suggests them, so a colour
 * chosen on either looks the same on both. Lowercase, as Convex stores them.
 */
export const STORE_COLOR_PRESETS = [
  { id: 'slate', hex: DEFAULT_STORE_COLOR },
  { id: 'red', hex: '#dc2626' },
  { id: 'orange', hex: '#ea580c' },
  { id: 'yellow', hex: '#facc15' },
  { id: 'green', hex: '#16a34a' },
  { id: 'teal', hex: '#0d9488' },
  { id: 'blue', hex: '#2563eb' },
  { id: 'purple', hex: '#7c3aed' },
  { id: 'pink', hex: '#db2777' },
  { id: 'brown', hex: '#78350f' },
] as const

export type StoreColorPreset = (typeof STORE_COLOR_PRESETS)[number]

export interface SortableLoyaltyCard {
  storeName: string
  holder?: string
  lastUsedAt?: number
  /** The Group's own arrangement (APP-440); absent until someone reorders. */
  order?: number
}

/** Last used first, then never-used cards by store name and then holder. */
function byUse(a: SortableLoyaltyCard, b: SortableLoyaltyCard): number {
  const used = (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
  if (used !== 0) return used
  return (
    a.storeName.localeCompare(b.storeName) ||
    (a.holder ?? '').localeCompare(b.holder ?? '')
  )
}

/**
 * The list's order (APP-440). Cards the Group never arranged come first, last
 * used first and then by store name and holder, so two Bonuskaarten sit
 * together in a stable order. Cards with an `order` follow, by that order.
 *
 * So a Group that never reorders sees exactly the old rule, and a card added
 * after an arrangement lands on top, where the person who just added it looks.
 */
export function compareLoyaltyCards(
  a: SortableLoyaltyCard,
  b: SortableLoyaltyCard,
): number {
  const arranged = (a.order === undefined ? 0 : 1) - (b.order === undefined ? 0 : 1)
  if (arranged !== 0) return arranged
  if (a.order !== undefined && b.order !== undefined && a.order !== b.order)
    return a.order - b.order
  return byUse(a, b)
}

/**
 * The arrangement a `reorder` writes, as ids top to bottom (APP-440).
 *
 * `listed` is what the client sent; `current` is every card the Group has, in
 * the list's current order. Listed ids the Group does not have (deleted
 * meanwhile) drop out, a repeated id counts once, and cards the client did not
 * list keep their relative order after the listed ones.
 */
export function arrangedLoyaltyCardIds<Id extends string>(
  listed: readonly Id[],
  current: readonly Id[],
): Id[] {
  const known = new Set(current)
  const placed = new Set<Id>()
  const arranged: Id[] = []
  for (const id of listed) {
    if (!known.has(id) || placed.has(id)) continue
    placed.add(id)
    arranged.push(id)
  }
  for (const id of current) if (!placed.has(id)) arranged.push(id)
  return arranged
}

/**
 * The cards as a `reorder` with `ids` leaves them: what both clients show
 * before Convex answers, by the same rule the server writes.
 */
export function cardsInArrangement<Card extends { _id: string }>(
  cards: readonly Card[],
  ids: readonly string[],
): Card[] {
  const byId = new Map(cards.map((card) => [card._id, card]))
  return arrangedLoyaltyCardIds(
    ids,
    cards.map((card) => card._id),
  ).flatMap((id) => byId.get(id) ?? [])
}

export interface HintedRetailer {
  numberLength?: number
  numberPrefix?: string
}

/**
 * The retailers whose card-number hint a number fits, in the order given.
 *
 * Only a retailer with a prefix hint can be suggested: a length on its own
 * fits every EAN-13 card in the country, so it narrows nothing. When the
 * retailer also has a length, the number must have it too. Spaces and dashes
 * are ignored, as people copy "2620 0123 4567 8" off the card. Used after a
 * scan, so a scanned Bonuskaart offers Albert Heijn without a search.
 */
export function retailersMatchingNumber<T extends HintedRetailer>(
  retailers: readonly T[],
  cardNumber: string,
): T[] {
  const value = cardNumber.replace(/[\s-]/g, '')
  if (!value) return []
  return retailers.filter(
    (retailer) =>
      Boolean(retailer.numberPrefix) &&
      value.startsWith(retailer.numberPrefix as string) &&
      (retailer.numberLength === undefined ||
        value.length === retailer.numberLength),
  )
}
