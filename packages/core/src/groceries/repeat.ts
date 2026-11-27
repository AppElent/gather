/**
 * A repeat typed in a grocery line (APP-993): "koffie elke week" is the item
 * "koffie", back on the list every week. The words are the task composer's
 * (`taskQuickAdd.ts`), in English and Dutch; a grocery line reads only the
 * repeat, so "melk morgen" stays the item "melk morgen".
 *
 * The item is on the list from today: the rule is anchored on today, so
 * "elke week" is today's weekday and "elke maand" today's day of the month.
 */
import type { QuickAddPart } from '../taskQuickAdd'
import { parseOnly } from '../taskQuickAddLine'
import { normalizeRepeat, type TaskRepeat } from '../taskRepeat'

export type GroceryRepeatPart = Extract<QuickAddPart, { kind: 'repeat' }>

export interface GroceryRepeatRead {
  /**
   * The line with the repeat's words blanked to spaces: as long as the line,
   * so a span in it is a span in the line.
   */
  rest: string
  /** The words read as a repeat, where they stand in the line. */
  part?: GroceryRepeatPart
  /** The rule, anchored on today as the server stores it. */
  repeat?: TaskRepeat
}

const REPEAT_ONLY = ['repeat'] as const

/** The repeat in a grocery line, unless its chip was dismissed. */
export function readGroceryRepeat(
  line: string,
  today: string,
  dismissed: readonly string[] = [],
): GroceryRepeatRead {
  // No time is read, so the clock does not matter.
  const parsed = parseOnly(line, { today, now: '00:00', dismissed }, REPEAT_ONLY)
  const part = parsed.parts.find(
    (each): each is GroceryRepeatPart => each.kind === 'repeat',
  )
  if (!part) return { rest: line }
  return {
    rest: `${line.slice(0, part.start)}${' '.repeat(part.end - part.start)}${line.slice(part.end)}`,
    part,
    repeat: normalizeRepeat(part.repeat, today) ?? part.repeat,
  }
}
