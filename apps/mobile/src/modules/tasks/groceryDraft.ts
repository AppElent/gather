/**
 * What the keyboard composer holds for a new grocery item (APP-664;
 * `designs/groceries/composer_final.md`), and the item it saves. Kept apart
 * from the component so it can be tested without a React Native tree.
 *
 * The amount comes from a chip or from the line ("2 pak melk"), as a task's
 * details do (`composerDraft.ts`): a tap takes the words it replaces out of
 * the line, and an amount typed later replaces the tapped one. The aisle is
 * the list's own answer for the name until a Member chooses one; a choice goes
 * with its name only, and is dropped when another name replaces it.
 */
import {
  type GroceryAisle,
  type GroceryUnit,
  groceryAddFields,
} from '@gather/core/groceries'

import { newSaveKey } from '../../ui/composer-drafts'

export interface GroceryAmountPick {
  quantity?: number
  unit?: GroceryUnit
}

/** Everything a closed composer keeps until it saves. */
export interface GroceryDraft {
  line: string
  /** `undefined`: the line decides. `null`: none, and the line is all name. */
  amount?: GroceryAmountPick | null
  aisle?: GroceryAisle
  note: string
  showNote: boolean
  staple: boolean
  /** The list picked on the chip; `null` is the one it was opened on. */
  listId: string | null
  /** One per item: sent as `tasks.add`'s idempotency key, retries included. */
  saveKey: string
}

/** The fields one new item is saved with. */
export interface ComposedGrocery extends GroceryAmountPick {
  title: string
  /** Only when a Member chose it: untouched, the server decides. */
  aisle?: GroceryAisle
  note?: string
  staple: boolean
}

export function emptyGroceryDraft(listId: string | null = null): GroceryDraft {
  return {
    line: '',
    note: '',
    showNote: false,
    staple: false,
    listId,
    saveKey: newSaveKey(),
  }
}

/** The next item: empty, on the same list, with a key of its own. */
export function nextGroceryDraft(draft: GroceryDraft): GroceryDraft {
  return emptyGroceryDraft(draft.listId)
}

/** Whether closing should keep it: a word typed or a detail chosen. */
export function isGroceryDirty(draft: GroceryDraft): boolean {
  return Boolean(
    draft.line.trim() ||
      draft.note.trim() ||
      draft.amount ||
      draft.aisle ||
      draft.staple,
  )
}

/** The amount the line itself reads as, if any. */
function lineAmount(line: string): GroceryAmountPick | undefined {
  const { quantity, unit } = groceryAddFields(line)
  if (quantity === undefined && unit === undefined) return undefined
  return {
    ...(quantity !== undefined ? { quantity } : {}),
    ...(unit !== undefined ? { unit } : {}),
  }
}

export function composedGrocery(draft: GroceryDraft): ComposedGrocery {
  const note = draft.note.trim()
  const named =
    draft.amount === undefined
      ? groceryAddFields(draft.line)
      : { title: draft.line.trim(), ...draft.amount }
  return {
    ...named,
    ...(draft.aisle ? { aisle: draft.aisle } : {}),
    ...(note ? { note } : {}),
    staple: draft.staple,
  }
}

const folded = (text: string) => text.trim().toLowerCase()

/** The draft after typing: an amount typed now beats one tapped before. */
export function withLine(draft: GroceryDraft, line: string): GroceryDraft {
  if (!line.trim()) {
    // A cleared line starts over; what was chosen was for the words it had.
    // The very first keys after a choice are not a clear.
    return draft.line.trim()
      ? { ...draft, line, amount: undefined, aisle: undefined }
      : { ...draft, line }
  }
  const before = lineAmount(draft.line)
  const after = lineAmount(line)
  const typed =
    after !== undefined &&
    (before?.quantity !== after.quantity || before?.unit !== after.unit)
  const was = folded(composedGrocery(draft).title)
  const amount = typed ? undefined : draft.amount
  const next = { ...draft, line, amount }
  const is = folded(composedGrocery(next).title)
  const sameName = is.startsWith(was) || was.startsWith(is)
  return sameName ? next : { ...next, aisle: undefined }
}

/** A tapped amount: the words the line read for one come out of it. */
export function withAmount(
  draft: GroceryDraft,
  amount: GroceryAmountPick,
): GroceryDraft {
  const line =
    draft.amount === undefined && lineAmount(draft.line)
      ? groceryAddFields(draft.line).title
      : draft.line
  return { ...draft, line, amount }
}

/** Where the amount stands in the line, to highlight; none once tapped away. */
export function amountSpans(
  draft: Pick<GroceryDraft, 'line' | 'amount'>,
): { start: number; end: number }[] {
  if (draft.amount !== undefined || !lineAmount(draft.line)) return []
  const { line } = draft
  // The name keeps its words but not its spacing, so each gap may be wider.
  const name = groceryAddFields(line)
    .title.split(' ')
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  const first = line.length - line.trimStart().length
  const last = line.trimEnd().length
  const trailingName = new RegExp(`\\s+${name}\\s*$`, 'i').exec(line)
  if (trailingName) return [{ start: first, end: trailingName.index }]
  const leadingName = new RegExp(`^\\s*${name}\\s+`, 'i').exec(line)
  if (leadingName) return [{ start: leadingName[0].length, end: last }]
  return []
}

/** The amounts the chip's menu offers for a unit, the current one included. */
export function quantityChoices(amount: GroceryAmountPick): number[] {
  const { quantity, unit } = amount
  const offered =
    unit === 'g' || unit === 'ml'
      ? [100, 250, 500, 750, 1000]
      : unit === 'kg' || unit === 'l'
        ? [0.5, 1, 1.5, 2, 3]
        : [1, 2, 3, 4, 5, 6]
  return quantity === undefined || offered.includes(quantity)
    ? offered
    : [...offered, quantity].sort((a, b) => a - b)
}

/** "Melk toegevoegd", or "3 toegevoegd: Melk, Bananen, Pindakaas". */
export function addedSummary(
  names: readonly string[],
  words: { added: string; addedMany: string },
): string {
  return names.length === 1
    ? words.added.replace('{name}', () => names[0])
    : words.addedMany
        .replace('{count}', String(names.length))
        .replace('{names}', () => names.join(', '))
}
