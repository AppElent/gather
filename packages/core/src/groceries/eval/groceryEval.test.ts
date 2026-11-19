import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GroceryAisle } from '../aisles'
import { groceryDictionary } from '../index'
import { formatEvalReport, parseEvalSet, runGroceryEval } from './groceryEval'

// The measured score of grocery recognition (APP-353). The thresholds come
// from the issue; `scripts/groceries/eval.ts` prints the same report per
// data source and for the holdout split.
const here = path.dirname(fileURLToPath(import.meta.url))
const rows = parseEvalSet(fs.readFileSync(path.join(here, 'groceryLines.txt'), 'utf8'))
const snapshot = JSON.parse(
  fs.readFileSync(path.join(here, 'aiCacheSnapshot.json'), 'utf8'),
) as { answers: Record<string, GroceryAisle> }
const cache = new Map(Object.entries(snapshot.answers))

describe('grocery recognition eval', () => {
  const local = runGroceryEval(rows, groceryDictionary())
  const withCache = runGroceryEval(rows, groceryDictionary(), cache)
  console.log(formatEvalReport('local lookup', local))
  console.log(formatEvalReport('local lookup + shared AI cache', withCache))

  it('has at least 600 labelled lines', () => {
    expect(rows.length).toBeGreaterThanOrEqual(600)
  })

  // Floors at the measured score (APP-368), so a change that loses ground
  // fails here instead of slipping through.
  it('places at least 95% in the exact aisle from the bundled dictionary alone', () => {
    expect(local.accuracy).toBeGreaterThanOrEqual(0.95)
  })

  // Curated terms were chosen from misses on the other four fifths only, so
  // this split shows what the dictionary does on lines nobody tuned for.
  it('places at least 91% in the exact aisle on the holdout fifth', () => {
    const holdout = rows.filter((_, index) => index % 5 === 4)
    expect(runGroceryEval(holdout, groceryDictionary()).accuracy).toBeGreaterThanOrEqual(0.91)
  })

  // APP-368: the rules of that change were drawn partly from misses in the
  // holdout fifth, so it is no longer unseen. `freshLines.txt` is: written by
  // a separate agent that saw only the aisle guide and the unit list, scored
  // once (96.0% before APP-368, 98.5% after) and never tuned on.
  it('places at least 95% of the unseen fresh lines in the exact aisle', () => {
    const fresh = parseEvalSet(fs.readFileSync(path.join(here, 'freshLines.txt'), 'utf8'))
    expect(fresh.length).toBeGreaterThanOrEqual(200)
    expect(runGroceryEval(fresh, groceryDictionary()).accuracy).toBeGreaterThanOrEqual(0.95)
  })

  // Errands typed on the list ("kapper bellen") belong in Overig: a
  // dictionary that matches every stray piece of a word fails here.
  it('leaves at least 70% of the non-grocery lines in Overig', () => {
    const { total, correct } = local.perAisle.other
    expect(total).toBeGreaterThanOrEqual(40)
    expect(correct / total).toBeGreaterThanOrEqual(0.7)
  })

  // The cache snapshot is recorded with `scripts/groceries/ask-ai.ts`, which
  // needs ANTHROPIC_API_KEY. Until it has answers (`recordedOn` is null) these
  // two checks measure the dictionary alone on all lines, curated ones
  // included; they are not yet a measure of the AI fallback.
  it('places at least 95% in the exact aisle with the shared AI cache', () => {
    expect(withCache.accuracy).toBeGreaterThanOrEqual(0.95)
  })

  it('leaves under 3% in Overig once the AI cache has answered', () => {
    expect(withCache.otherRate).toBeLessThan(0.03)
  })

  it('reads amount, unit and name right on at least 98% of lines', () => {
    expect(local.unitAccuracy).toBeGreaterThanOrEqual(0.98)
  })

  it('keeps the dictionary at 3,000 terms or more', () => {
    expect(groceryDictionary().size).toBeGreaterThanOrEqual(3000)
  })
})
