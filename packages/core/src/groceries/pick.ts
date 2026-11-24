/**
 * What the add-to-groceries sheet shows and adds (APP-312,
 * `designs/groceries/README.md` section 5), as plain data: one row per source
 * line, ticked or not, with its amount for the chosen servings and why it
 * reads the way it does (merged, in stock, read by the AI, plain text).
 *
 * Source-agnostic: a recipe hands in its ingredients with the recipe's
 * servings; the week menu (APP-321) hands in lines from several meals, each
 * with its own servings and source. The merge itself is `@gather/core`'s
 * `planGroceryAdds`, the same plan Convex runs when the lines are added.
 */
import {
  capitalise,
  GROCERY_AISLES,
  type GroceryAddLine,
  type GroceryAisle,
  type GroceryAmount,
  type GroceryListItem,
  groceryAddFields,
  planGroceryAdds,
  roundGroceryQuantity,
  scaleGroceryQuantity,
} from './index'

/** How a source line was read. */
export type LineRead =
  /** By the local parser, by the AI (now or earlier), or retyped in the sheet. */
  | {
      kind: 'read'
      via: 'local' | 'ai' | 'ai-earlier' | 'edited'
      name: string
      quantity?: number
      unit?: GroceryAmount['unit']
    }
  /** Waiting on the AI. */
  | { kind: 'reading' }
  /** Nobody could read it: it goes on the list as written. */
  | { kind: 'text' }

/** One line of the source, as the sheet receives it. */
export interface SourceLine {
  /** Stable within the sheet: the line's position in its source. */
  key: string
  /** As the source wrote it ("2 rode paprika's, in reepjes"). */
  text: string
  read: LineRead
  /** The servings the amount is for; absent when it does not scale. */
  servings?: number
  /**
   * Where the line comes from, under its name ("Shakshuka di, Tacos do"),
   * and the note it carries onto the list. The week menu sets it per line;
   * a recipe's lines share the sheet's source instead.
   */
  detail?: string
  /**
   * Keys this line had before it became this one (the week menu, APP-423): a
   * line still being read is its own row, and once read it merges into an
   * item's row. A tick or a retype made on the earlier row carries over
   * (`byLineKey`).
   */
  was?: readonly string[]
  /**
   * Keys of rows this line's sources were in before and that are gone (the
   * week menu when a day leaves, APP-590). Asked after `was`; a new tick or
   * retype on this row replaces what was done to them (`settleLine`).
   */
  former?: readonly string[]
  /**
   * Bring the list up to this amount rather than add it (the week menu,
   * APP-321): an item the list already has enough of starts unticked.
   */
  topUp?: boolean
}

/** Why a row reads as it does, under its name. */
export type RowMeta =
  | { kind: 'merge'; from: GroceryAmount; to: GroceryAmount }
  | { kind: 'already' }
  /** A top-up line the list already has enough of. */
  | { kind: 'covered'; have: GroceryAmount }
  | { kind: 'inStock'; adding: boolean }
  | { kind: 'ai'; earlier: boolean }
  | { kind: 'reading' }
  | { kind: 'text' }

export interface PickRow {
  key: string
  /** What goes on the list: the name, or the whole line as text. */
  title: string
  amount: GroceryAmount
  /**
   * What a top-up adds to the item already on the list ("+2"), when that is
   * less than the row's amount.
   */
  adds?: GroceryAmount
  on: boolean
  meta: RowMeta | null
  detail?: string
}

/** A line the button adds, with its own note for the list. */
export type PickLine = GroceryAddLine & { source?: string }

export interface PickInput {
  lines: readonly SourceLine[]
  /** The servings chosen in the sheet; absent when there is no stepper. */
  servings?: number
  /** What is on the chosen list now. */
  items: readonly GroceryListItem[]
  /** Rows ticked or unticked by hand, by key. */
  ticks: Readonly<Record<string, boolean>>
  /**
   * Whether the house has this in stock (APP-314, Groceries' In stock):
   * `useInStock`. Such a row starts unticked.
   */
  inStock?: (name: string) => boolean
  /**
   * Lines still being read go on the list as written instead of holding the
   * button back (APP-479): a long week is read in batches, and the person
   * need not wait for the last one.
   */
  readingAsText?: boolean
}

/** A line retyped in the sheet, read the way the composer reads a line. */
export function editedRead(typed: string): LineRead {
  const fields = groceryAddFields(typed)
  return {
    kind: 'read',
    via: 'edited',
    name: capitalise(fields.title),
    ...(fields.quantity !== undefined ? { quantity: fields.quantity } : {}),
    ...(fields.unit !== undefined ? { unit: fields.unit } : {}),
  }
}

/**
 * What the person did to a line, by key: under its own key, else under the
 * first earlier key (`SourceLine.was`) they did something to.
 */
export function byLineKey<T>(
  byKey: Readonly<Record<string, T>>,
  line: Pick<SourceLine, 'key' | 'was' | 'former'>,
): T | undefined {
  if (byKey[line.key] !== undefined) return byKey[line.key]
  for (const key of [...(line.was ?? []), ...(line.former ?? [])])
    if (byKey[key] !== undefined) return byKey[key]
  return undefined
}

/**
 * `byKey` with `value` for the line, and nothing left under its former rows'
 * keys: what the person does now is what holds when such a row returns.
 */
export function settleLine<T>(
  byKey: Readonly<Record<string, T>>,
  line: Pick<SourceLine, 'key' | 'former'>,
  value: T,
): Record<string, T> {
  const next = { ...byKey, [line.key]: value }
  for (const key of line.former ?? []) delete next[key]
  return next
}

/** The lines with the person's retypes in place of what was read. */
export function withEdits(
  lines: readonly SourceLine[],
  edits: Readonly<Record<string, LineRead>>,
): SourceLine[] {
  return lines.map((line) => {
    const edit = byLineKey(edits, line)
    return edit ? { ...line, read: edit } : line
  })
}

/**
 * Rows in sections, one per aisle in walking order. A row still being read,
 * or only readable as text, waits under Other; `aisleOf` answers for the
 * rest (the Group's own aisles, `groceryLines.aisles`).
 */
export function sectionsByAisle(
  rows: readonly PickRow[],
  aisleOf: (title: string) => GroceryAisle,
): Array<{ id: GroceryAisle; rows: PickRow[] }> {
  const byId = new Map<GroceryAisle, PickRow[]>()
  for (const row of rows) {
    const aisle =
      row.meta?.kind === 'reading' || row.meta?.kind === 'text'
        ? 'other'
        : aisleOf(row.title)
    byId.set(aisle, [...(byId.get(aisle) ?? []), row])
  }
  return GROCERY_AISLES.filter((aisle) => byId.has(aisle)).map((aisle) => ({
    id: aisle,
    rows: byId.get(aisle) ?? [],
  }))
}

function scaled(line: SourceLine, servings: number | undefined): GroceryAmount {
  const { read } = line
  if (read.kind !== 'read') return {}
  const unit = read.unit !== undefined ? { unit: read.unit } : {}
  if (read.quantity === undefined) return unit
  // A retyped line says exactly how much; only what the source wrote scales.
  const factor =
    read.via !== 'edited' && servings && line.servings
      ? servings / line.servings
      : 1
  return { quantity: scaleGroceryQuantity(read.quantity, read.unit, factor), ...unit }
}

/** The sheet's rows, and the lines the button adds, in source order. */
export function pickRows(input: PickInput): {
  rows: PickRow[]
  lines: PickLine[]
  /** Still waiting on the AI: the button waits too, unless `readingAsText`. */
  reading: boolean
} {
  const base = input.lines.map((line) => {
    const read = line.read
    const title = read.kind === 'read' ? read.name : line.text.trim()
    const amount = scaled(line, input.servings)
    const stocked =
      read.kind === 'read' && (input.inStock?.(read.name) ?? false)
    return { line, title, amount, stocked }
  })
  const toLine = (row: (typeof base)[number], topUp: boolean): PickLine => ({
    title: row.title,
    ...row.amount,
    ...(topUp ? { topUp: true } : {}),
    ...(row.line.detail ? { source: row.line.detail } : {}),
  })

  // A top-up line the list already covers starts unticked; ticked by hand on
  // that row, it adds its whole amount on top, like a recipe's line.
  const ready = base.filter((row) => row.line.read.kind !== 'reading')
  const before = planGroceryAdds(
    input.items,
    ready.map((row) => toLine(row, row.line.topUp === true)),
  )
  const covered = new Map(
    ready.flatMap((row, index) => {
      const plan = before[index]
      return plan.kind === 'covered' && row.line.topUp
        ? [[row.line.key, plan.have] as const]
        : []
    }),
  )

  const withTicks = base.map((row) => {
    const own = byLineKey(input.ticks, row.line)
    const on = own ?? !(row.stocked || covered.has(row.line.key))
    // Only a covered row ticked by hand stops topping up, and only when the
    // person ticked this row, which said it was covered. A tick made on an
    // earlier key (`was`) was made on a line still being read, before anyone
    // knew the list had enough of it: that row still tops up (APP-479).
    const deliberate = input.ticks[row.line.key] !== undefined
    const topUp =
      row.line.topUp === true && !(deliberate && covered.has(row.line.key))
    return { ...row, on, topUp }
  })
  const adding = withTicks.filter(
    (row) =>
      row.on && (row.line.read.kind !== 'reading' || input.readingAsText),
  )
  const lines = adding.map((row) => toLine(row, row.topUp))
  const plans = planGroceryAdds(input.items, lines)
  const planOf = new Map(adding.map((row, index) => [row.line.key, plans[index]]))

  const rows = withTicks.map(
    ({ line, title, amount, stocked, on, topUp }): PickRow => {
      const plan = planOf.get(line.key)
      const have = covered.get(line.key)
      let meta: RowMeta | null = null
      let adds: GroceryAmount | undefined
      if (stocked) meta = { kind: 'inStock', adding: on }
      else if (plan?.kind === 'merge') {
        meta =
          amount.quantity === undefined && amount.unit === undefined
            ? { kind: 'already' }
            : { kind: 'merge', from: plan.from, to: plan.to }
        if (topUp) adds = difference(plan.from, plan.to)
      } else if (plan?.kind === 'covered' || (!on && have))
        meta = { kind: 'covered', have: have ?? {} }
      else if (line.read.kind === 'reading') meta = { kind: 'reading' }
      else if (line.read.kind === 'text') meta = { kind: 'text' }
      else if (line.read.via === 'ai' || line.read.via === 'ai-earlier')
        meta = { kind: 'ai', earlier: line.read.via === 'ai-earlier' }
      return {
        key: line.key,
        title,
        amount,
        ...(adds ? { adds } : {}),
        on,
        meta,
        ...(line.detail ? { detail: line.detail } : {}),
      }
    },
  )
  return {
    rows,
    // A covered line changes nothing on the list: it is not counted.
    lines: lines.filter((_, index) => plans[index].kind !== 'covered'),
    reading:
      !input.readingAsText &&
      input.lines.some(
        (line, index) => line.read.kind === 'reading' && withTicks[index].on,
      ),
  }
}

/** What a top-up merge adds: `to` less `from`, both in the item's unit. */
function difference(
  from: GroceryAmount,
  to: GroceryAmount,
): GroceryAmount | undefined {
  if (to.quantity === undefined) return undefined
  const added = roundGroceryQuantity(to.quantity - (from.quantity ?? 1))
  if (!(added > 0)) return undefined
  return { quantity: added, ...(to.unit !== undefined ? { unit: to.unit } : {}) }
}

/**
 * A short fingerprint of a recipe's ingredients (FNV-1a): a cached AI reading
 * is used only while the ingredients are what they were when it was read.
 */
export function ingredientsDigest(lines: readonly string[]): string {
  let hash = 0x811c9dc5
  const text = lines.join('\n')
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${lines.length}:${hash.toString(36)}`
}
