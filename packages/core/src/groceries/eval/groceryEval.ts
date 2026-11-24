/**
 * Scores recognition against the labelled eval set (`groceryLines.txt`):
 * exact-aisle accuracy per aisle and overall, how often an item lands in
 * `other`, how often amount, unit and name are read right, and the misses.
 * `groceryEval.test.ts` holds the thresholds; `scripts/groceries/eval.ts`
 * prints the full report, with the score per data source.
 */

import { GROCERY_AISLES, type GroceryAisle, isGroceryAisle } from '../aisles'
import type { GroceryDictionary } from '../dictionary'
import { type GroceryUnit, parseGroceryLine } from '../parse'
import { type GroceryAisleSource, resolveGroceryLine } from '../resolve'

export interface EvalRow {
  line: string
  aisle: GroceryAisle
  quantity: number | null
  unit: GroceryUnit | null
  name: string
}

export function parseEvalSet(text: string): EvalRow[] {
  const rows: EvalRow[] = []
  for (const [index, raw] of text.split('\n').entries()) {
    if (!raw.trim() || raw.startsWith('#')) continue
    const [line, aisle, quantity, unit, name] = raw.split('|').map((part) =>
      part.trim(),
    )
    if (!line || !isGroceryAisle(aisle))
      throw new Error(`groceryLines.txt:${index + 1}: bad row "${raw}"`)
    rows.push({
      line,
      aisle,
      quantity: quantity ? Number(quantity) : null,
      unit: (unit || null) as GroceryUnit | null,
      name: name || line,
    })
  }
  return rows
}

/**
 * The aisle most of the answers agree on; a tie goes to the one asked first.
 * One model answer per name is noisy, so a recording asks several times.
 */
export function majorityAisle(answers: readonly (GroceryAisle | null)[]): GroceryAisle | null {
  const counts = new Map<GroceryAisle, number>()
  for (const aisle of answers) if (aisle) counts.set(aisle, (counts.get(aisle) ?? 0) + 1)
  let best: GroceryAisle | null = null
  let bestCount = 0
  // Map keeps insertion order, so the first-asked answer wins a tie.
  for (const [aisle, count] of counts)
    if (count > bestCount) {
      best = aisle
      bestCount = count
    }
  return best
}

/** Names of these lines the dictionary does not know: `groceryKey` → the name the model is asked. */
export function unknownEvalNames(
  rows: readonly EvalRow[],
  dictionary: GroceryDictionary,
): Map<string, string> {
  const unknown = new Map<string, string>()
  for (const row of rows) {
    const result = resolveGroceryLine(row.line, dictionary)
    if (result.source === 'none' && result.key)
      unknown.set(result.key, result.cleanName)
  }
  return unknown
}

export interface EvalMiss {
  line: string
  expected: GroceryAisle
  got: GroceryAisle
  source: GroceryAisleSource
  how?: string
}

export interface EvalReport {
  total: number
  /** Share of lines whose aisle is exactly right, 0–1. */
  accuracy: number
  /** Share of lines that ended in `other` while another aisle was expected. */
  otherRate: number
  /** Share of lines whose amount, unit and name are all read right. */
  unitAccuracy: number
  perAisle: Record<GroceryAisle, { total: number; correct: number }>
  bySource: Partial<Record<GroceryAisleSource, number>>
  /** Only the lines the AI cache answered: how many, and how many it got right. */
  ai: { total: number; correct: number; accuracy: number }
  misses: EvalMiss[]
  unitMisses: string[]
}

/**
 * Run the set. `cache` stands in for the shared AI cache: name key → aisle.
 */
export function runGroceryEval(
  rows: readonly EvalRow[],
  dictionary: GroceryDictionary,
  cache?: ReadonlyMap<string, GroceryAisle>,
): EvalReport {
  const perAisle = Object.fromEntries(
    GROCERY_AISLES.map((aisle) => [aisle, { total: 0, correct: 0 }]),
  ) as EvalReport['perAisle']
  const bySource: EvalReport['bySource'] = {}
  const misses: EvalMiss[] = []
  const unitMisses: string[] = []
  let correct = 0
  let aiTotal = 0
  let aiCorrect = 0
  let other = 0
  let unitsRight = 0

  for (const row of rows) {
    const result = resolveGroceryLine(row.line, dictionary, {
      cache: cache ? (key) => cache.get(key) : undefined,
    })
    perAisle[row.aisle].total++
    bySource[result.source] = (bySource[result.source] ?? 0) + 1
    if (result.source === 'cache') aiTotal++
    if (result.aisle === row.aisle) {
      correct++
      if (result.source === 'cache') aiCorrect++
      perAisle[row.aisle].correct++
    } else {
      if (result.aisle === 'other') other++
      misses.push({
        line: row.line,
        expected: row.aisle,
        got: result.aisle,
        source: result.source,
        how: result.match,
      })
    }

    const parsed = parseGroceryLine(row.line)
    if (
      sameNumber(parsed.quantity, row.quantity) &&
      parsed.unit === row.unit &&
      parsed.name.toLowerCase() === row.name.toLowerCase()
    )
      unitsRight++
    else
      unitMisses.push(
        `${row.line} → ${parsed.quantity ?? '-'} ${parsed.unit ?? '-'} "${parsed.name}" (expected ${row.quantity ?? '-'} ${row.unit ?? '-'} "${row.name}")`,
      )
  }

  const total = rows.length
  return {
    total,
    accuracy: correct / total,
    otherRate: other / total,
    unitAccuracy: unitsRight / total,
    perAisle,
    bySource,
    ai: {
      total: aiTotal,
      correct: aiCorrect,
      accuracy: aiTotal === 0 ? 0 : aiCorrect / aiTotal,
    },
    misses: rankMisses(misses),
    unitMisses,
  }
}

function sameNumber(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) < 1e-9
}

/**
 * Worst first: a miss whose confusion (expected → got) happens most often
 * points at the biggest gap, and a miss into `other` before a wrong aisle,
 * since a wrong aisle is at least a guess.
 */
function rankMisses(misses: EvalMiss[]): EvalMiss[] {
  const count = new Map<string, number>()
  for (const miss of misses) {
    const pair = `${miss.expected}>${miss.got}`
    count.set(pair, (count.get(pair) ?? 0) + 1)
  }
  return [...misses].sort(
    (a, b) =>
      (count.get(`${b.expected}>${b.got}`) ?? 0) -
        (count.get(`${a.expected}>${a.got}`) ?? 0) ||
      a.expected.localeCompare(b.expected) ||
      a.line.localeCompare(b.line),
  )
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`

/** The report as the PR and CI log show it. */
export function formatEvalReport(
  title: string,
  report: EvalReport,
  worst = 20,
): string {
  const lines = [
    `== ${title}`,
    `lines ${report.total}  exact aisle ${percent(report.accuracy)}  other ${percent(report.otherRate)}  amount+unit ${percent(report.unitAccuracy)}`,
    `chosen by: ${Object.entries(report.bySource)
      .map(([source, n]) => `${source} ${n}`)
      .join(', ')}`,
    ...(report.ai.total > 0
      ? [
          `AI-answered lines only: ${percent(report.ai.accuracy)} (${report.ai.correct}/${report.ai.total})`,
        ]
      : []),
    'per aisle:',
  ]
  for (const aisle of GROCERY_AISLES) {
    const { total, correct } = report.perAisle[aisle]
    if (total === 0) continue
    lines.push(
      `  ${aisle.padEnd(12)} ${percent(correct / total).padStart(6)}  (${correct}/${total})`,
    )
  }
  if (worst > 0 && report.misses.length > 0) {
    lines.push(`${Math.min(worst, report.misses.length)} worst misses:`)
    for (const miss of report.misses.slice(0, worst))
      lines.push(
        `  ${miss.line}: expected ${miss.expected}, got ${miss.got} (${miss.source}${miss.how ? `/${miss.how}` : ''})`,
      )
  }
  if (worst > 0 && report.unitMisses.length > 0) {
    lines.push('amount/unit misses:')
    for (const miss of report.unitMisses.slice(0, worst))
      lines.push(`  ${miss}`)
  }
  return lines.join('\n')
}
