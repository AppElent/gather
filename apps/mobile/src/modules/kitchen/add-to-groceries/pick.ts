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
  type GroceryAddLine,
  type GroceryAmount,
  type GroceryListItem,
  groceryAddFields,
  planGroceryAdds,
  scaleGroceryQuantity,
} from '@gather/core/groceries'

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
}

/** Why a row reads as it does, under its name. */
export type RowMeta =
  | { kind: 'merge'; from: GroceryAmount; to: GroceryAmount }
  | { kind: 'already' }
  | { kind: 'inStock'; adding: boolean }
  | { kind: 'ai'; earlier: boolean }
  | { kind: 'reading' }
  | { kind: 'text' }

export interface PickRow {
  key: string
  /** What goes on the list: the name, or the whole line as text. */
  title: string
  amount: GroceryAmount
  on: boolean
  meta: RowMeta | null
}

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
  lines: GroceryAddLine[]
  /** Still waiting on the AI: the button waits too. */
  reading: boolean
} {
  const base = input.lines.map((line) => {
    const read = line.read
    const title = read.kind === 'read' ? read.name : line.text.trim()
    const amount = scaled(line, input.servings)
    const stocked =
      read.kind === 'read' && (input.inStock?.(read.name) ?? false)
    const on = input.ticks[line.key] ?? !stocked
    return { line, title, amount, stocked, on }
  })
  const adding = base.filter((row) => row.on && row.line.read.kind !== 'reading')
  const lines: GroceryAddLine[] = adding.map((row) => ({
    title: row.title,
    ...row.amount,
  }))
  const plans = planGroceryAdds(input.items, lines)
  const planOf = new Map(adding.map((row, index) => [row.line.key, plans[index]]))

  const rows = base.map(({ line, title, amount, stocked, on }): PickRow => {
    const plan = planOf.get(line.key)
    let meta: RowMeta | null = null
    if (stocked) meta = { kind: 'inStock', adding: on }
    else if (plan?.kind === 'merge')
      meta =
        amount.quantity === undefined && amount.unit === undefined
          ? { kind: 'already' }
          : { kind: 'merge', from: plan.from, to: plan.to }
    else if (line.read.kind === 'reading') meta = { kind: 'reading' }
    else if (line.read.kind === 'text') meta = { kind: 'text' }
    else if (line.read.via === 'ai' || line.read.via === 'ai-earlier')
      meta = { kind: 'ai', earlier: line.read.via === 'ai-earlier' }
    return { key: line.key, title, amount, on, meta }
  })
  return {
    rows,
    lines,
    reading: input.lines.some(
      (line, index) => line.read.kind === 'reading' && base[index].on,
    ),
  }
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
