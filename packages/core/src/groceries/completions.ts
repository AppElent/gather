/**
 * The composer's autocomplete (APP-311; `designs/groceries/README.md`,
 * section 2): what is being typed, completed from the Group's own history
 * first, then from the bundled names. Local, no AI, works offline.
 */
import { GROCERY_AISLES, type GroceryAisle } from './aisles'
import type { GroceryHabit } from './habits'
import { groceryKey } from './normalise'
import { parseGroceryLine } from './parse'

/** Per aisle, readable names joined by `|` (`data/names.generated.ts`). */
export type GroceryNamesData = Partial<Record<GroceryAisle, string>>

/** One readable name the composer can complete to. */
export interface GroceryName {
  name: string
  aisle: GroceryAisle
  key: string
  /** Lower case, accents off: what typing is matched against. */
  folded: string
}

/** Typing shorter than this completes nothing. */
export const COMPLETION_MIN_LENGTH = 2

/** The most rows the autocomplete card shows. */
export const COMPLETIONS_LIMIT = 3

export type GroceryCompletion =
  | { source: 'history'; habit: GroceryHabit }
  | { source: 'dictionary'; name: GroceryName }

/** Lower case, accents and apostrophes off. */
export function foldGroceryText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ']/g, '')
    .trim()
}

/** The names of a names table, in aisle order. */
export function groceryNameList(data: GroceryNamesData): GroceryName[] {
  return GROCERY_AISLES.flatMap((aisle) =>
    (data[aisle] ?? '')
      .split('|')
      .filter(Boolean)
      .map((name) => ({
        name,
        aisle,
        key: groceryKey(name),
        folded: foldGroceryText(name),
      })),
  )
}

/**
 * How well a name matches what is typed: 0 when it starts with it, 1 when a
 * later word does, 2 when it only contains it ("karnemelk" for "melk"), and
 * null for no match.
 */
function matchRank(folded: string, typed: string): number | null {
  if (folded.startsWith(typed)) return 0
  if (folded.split(/[\s-]+/).some((word) => word.startsWith(typed))) return 1
  return folded.includes(typed) ? 2 : null
}

/**
 * Completions for a typed line: the name part of it (an amount typed with it
 * stays the line's), matched against the Group's history and then the names,
 * at most `limit`. History is ranked by match, then by how often it was
 * bought; names by match, then shortest. A name the history already offers
 * is not offered again from the names.
 */
export function groceryCompletions(
  line: string,
  habits: readonly GroceryHabit[],
  names: readonly GroceryName[],
  limit = COMPLETIONS_LIMIT,
): GroceryCompletion[] {
  const typed = foldGroceryText(parseGroceryLine(line).name)
  if (typed.length < COMPLETION_MIN_LENGTH) return []

  const history = habits
    .map((habit) => ({
      habit,
      rank: matchRank(foldGroceryText(habit.title), typed),
    }))
    .filter((hit): hit is { habit: GroceryHabit; rank: number } => hit.rank !== null)
    .sort((a, b) => a.rank - b.rank || b.habit.count - a.habit.count)
    .slice(0, limit)
  const offered = new Set(history.map(({ habit }) => habit.key))
  const completions: GroceryCompletion[] = history.map(({ habit }) => ({
    source: 'history',
    habit,
  }))
  if (completions.length >= limit) return completions

  const fromNames = names
    .filter((name) => !offered.has(name.key))
    .map((name) => ({ name, rank: matchRank(name.folded, typed) }))
    .filter((hit): hit is { name: GroceryName; rank: number } => hit.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.name.folded.length - b.name.folded.length ||
        a.name.folded.localeCompare(b.name.folded),
    )
  for (const { name } of fromNames) {
    if (completions.length >= limit) break
    if (offered.has(name.key)) continue
    offered.add(name.key)
    completions.push({ source: 'dictionary', name })
  }
  return completions
}

/**
 * Where what is typed sits in a completed name, as `[start, end)` in `title`,
 * for the row to set that part in 600 (`designs/groceries/README.md`,
 * section 2): the same match as the ranking, at the start, at a word, or
 * anywhere, with case and accents ignored. Null when it is not in the name.
 */
export function typedSpan(
  title: string,
  line: string,
): [number, number] | null {
  const typed = foldGroceryText(parseGroceryLine(line).name)
  if (typed.length === 0) return null
  // The name folded a character at a time, remembering where each folded
  // character came from, so a match maps back onto the name as written.
  let folded = ''
  const from: number[] = []
  for (let i = 0; i < title.length; i++) {
    const piece = title[i]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f']/g, '')
    for (const char of piece) {
      folded += char
      from.push(i)
    }
  }
  const words = [...folded.matchAll(/(^|[\s-])(?=\S)/g)].map(
    (hit) => hit.index + hit[1].length,
  )
  const at = folded.startsWith(typed)
    ? 0
    : (words.find((start) => folded.startsWith(typed, start)) ??
      folded.indexOf(typed))
  if (at < 0) return null
  return [from[at], from[at + typed.length - 1] + 1]
}
