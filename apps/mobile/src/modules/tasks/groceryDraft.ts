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
 *
 * A repeat is read from the line as the task composer reads it ("koffie elke
 * week", APP-993) and follows the same rules: a tap on the chip takes the
 * words out of the line, a repeat typed later replaces the tapped one, and
 * Remove leaves the words in the name.
 */
import {
  type GroceryAisle,
  type GroceryRepeatPart,
  type GroceryUnit,
  groceryAddFields,
  readGroceryRepeat,
} from '@gather/core/groceries'
import type { TaskRepeat } from '@gather/core/task-repeat'

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
  /** A repeat tapped on the chip; otherwise the line decides. */
  repeat?: TaskRepeat
  /** Keys of repeats read from the line and removed: their words stay. */
  dismissed?: readonly string[]
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
  /** Anchored on today: the item is on the list now and comes back. */
  repeat?: TaskRepeat
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
      draft.repeat ||
      draft.staple,
  )
}

// Which words are a repeat does not depend on the day; only its anchor does.
const ANY_DAY = '2026-01-05'

/** The repeat the line reads, and the line with its words blanked out. */
function lineRepeat(draft: Pick<GroceryDraft, 'line' | 'dismissed'>, today = ANY_DAY) {
  return readGroceryRepeat(draft.line, today, draft.dismissed)
}

/** The words the line reads as a repeat, to highlight and to show on a chip. */
export function repeatPart(
  draft: Pick<GroceryDraft, 'line' | 'dismissed'>,
): GroceryRepeatPart | undefined {
  return lineRepeat(draft).part
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim()

/** The amount the line itself reads as, if any. */
function lineAmount(line: string): GroceryAmountPick | undefined {
  const { quantity, unit } = groceryAddFields(tidy(line))
  if (quantity === undefined && unit === undefined) return undefined
  return {
    ...(quantity !== undefined ? { quantity } : {}),
    ...(unit !== undefined ? { unit } : {}),
  }
}

/** The item the draft saves; a repeat is anchored on the Group's `today`. */
export function composedGrocery(draft: GroceryDraft, today: string): ComposedGrocery {
  const note = draft.note.trim()
  const read = lineRepeat(draft, today)
  const named =
    draft.amount === undefined
      ? groceryAddFields(tidy(read.rest))
      : { title: tidy(read.rest), ...draft.amount }
  const repeat = draft.repeat ?? read.repeat
  return {
    ...named,
    ...(draft.aisle ? { aisle: draft.aisle } : {}),
    ...(repeat ? { repeat } : {}),
    ...(note ? { note } : {}),
    staple: draft.staple,
  }
}

const folded = (text: string) => text.trim().toLowerCase()

/**
 * The draft after typing: an amount or a repeat typed now beats one tapped
 * before.
 */
export function withLine(draft: GroceryDraft, line: string): GroceryDraft {
  if (!line.trim()) {
    // A cleared line starts over; what was chosen was for the words it had.
    // The very first keys after a choice are not a clear.
    return draft.line.trim()
      ? {
          ...draft,
          line,
          amount: undefined,
          aisle: undefined,
          repeat: undefined,
          dismissed: [],
        }
      : { ...draft, line }
  }
  const before = lineAmount(lineRepeat(draft).rest)
  const after = lineAmount(lineRepeat({ ...draft, line }).rest)
  const typed =
    after !== undefined &&
    (before?.quantity !== after.quantity || before?.unit !== after.unit)
  const repeatBefore = repeatPart(draft)?.key
  const repeatAfter = repeatPart({ ...draft, line })?.key
  const repeatTyped = repeatAfter !== undefined && repeatAfter !== repeatBefore
  const was = folded(composedGrocery(draft, ANY_DAY).title)
  const amount = typed ? undefined : draft.amount
  const next = {
    ...draft,
    line,
    amount,
    repeat: repeatTyped ? undefined : draft.repeat,
  }
  const is = folded(composedGrocery(next, ANY_DAY).title)
  const sameName = is.startsWith(was) || was.startsWith(is)
  return sameName ? next : { ...next, aisle: undefined }
}

/** The line with a span's words taken out, spaces tidied. */
const cut = (line: string, span: { start: number; end: number }) =>
  tidy(`${line.slice(0, span.start)} ${line.slice(span.end)}`)

/** A tapped amount: the words the line read for one come out of it. */
export function withAmount(
  draft: GroceryDraft,
  amount: GroceryAmountPick,
): GroceryDraft {
  if (draft.amount !== undefined || !lineAmount(lineRepeat(draft).rest))
    return { ...draft, amount }
  const [span] = amountSpans(draft)
  const line = span
    ? cut(draft.line, span)
    : repeatPart(draft)
      ? draft.line
      : groceryAddFields(draft.line).title
  return { ...draft, line, amount }
}

/** A tapped repeat: the words the line read for one come out of it. */
export function withRepeat(draft: GroceryDraft, repeat: TaskRepeat): GroceryDraft {
  const part = repeatPart(draft)
  return { ...draft, line: part ? cut(draft.line, part) : draft.line, repeat }
}

/** Remove: a tapped repeat goes, and the line's words stay in the name. */
export function withoutRepeat(draft: GroceryDraft): GroceryDraft {
  const part = repeatPart(draft)
  return {
    ...draft,
    repeat: undefined,
    dismissed: part ? [...(draft.dismissed ?? []), part.key] : draft.dismissed,
  }
}

/**
 * Where the amount stands in the line, to highlight; none once tapped away.
 * A repeat's words are read around, as spaces.
 */
export function amountSpans(
  draft: Pick<GroceryDraft, 'line' | 'amount' | 'dismissed'>,
): { start: number; end: number }[] {
  const line = lineRepeat(draft).rest
  if (draft.amount !== undefined || !lineAmount(line)) return []
  // The name keeps its words but not its spacing, so each gap may be wider.
  const name = groceryAddFields(tidy(line))
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

/** The parts of the line to highlight, in order: its amount and its repeat. */
export function lineSpans(
  draft: Pick<GroceryDraft, 'line' | 'amount' | 'dismissed'>,
): { start: number; end: number }[] {
  const part = repeatPart(draft)
  return [...amountSpans(draft), ...(part ? [part] : [])].sort(
    (a, b) => a.start - b.start,
  )
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
