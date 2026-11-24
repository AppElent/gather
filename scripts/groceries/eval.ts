// Prints the grocery recognition score against the labelled eval set, for
// the shipped dictionary and for each data source on its own (APP-353):
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/eval.ts \
//     [--split all|train|holdout|fresh] [--worst 20] [--misses]
// The holdout split (every fifth line) is never used to choose curated terms,
// so its score shows how well the dictionary does on lines nobody tuned for.
// The fresh split is `freshLines.txt`, which nothing is ever tuned on.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { GroceryAisle } from '../../packages/core/src/groceries/aisles'
import { DICTIONARY_DATA } from '../../packages/core/src/groceries/data/dictionary.generated'
import {
  createGroceryDictionary,
  DICTIONARY_SOURCES,
} from '../../packages/core/src/groceries/dictionary'
import {
  type EvalRow,
  formatEvalReport,
  parseEvalSet,
  runGroceryEval,
} from '../../packages/core/src/groceries/eval/groceryEval'

const here = path.dirname(fileURLToPath(import.meta.url))
const evalDir = path.resolve(here, '../../packages/core/src/groceries/eval')

const { values } = parseArgs({
  options: {
    split: { type: 'string', default: 'all' },
    worst: { type: 'string', default: '20' },
    misses: { type: 'boolean', default: false },
  },
})

const file = values.split === 'fresh' ? 'freshLines.txt' : 'groceryLines.txt'
const all = parseEvalSet(fs.readFileSync(path.join(evalDir, file), 'utf8'))
const rows: EvalRow[] = all.filter((_, index) =>
  values.split === 'train'
    ? index % 5 !== 4
    : values.split === 'holdout'
      ? index % 5 === 4
      : true,
)
const cachePath = path.join(evalDir, 'aiCacheSnapshot.json')
const cache = fs.existsSync(cachePath)
  ? new Map(
      Object.entries(
        JSON.parse(fs.readFileSync(cachePath, 'utf8')).answers as Record<
          string,
          GroceryAisle
        >,
      ),
    )
  : undefined

const { openFacts, nevo, curated } = DICTIONARY_SOURCES
const variants: [string, number][] = [
  ['Open Facts only', openFacts],
  ['NEVO only', nevo],
  ['Open Facts + NEVO', openFacts | nevo],
  ['Open Facts + curated', openFacts | curated],
  ['NEVO + curated', nevo | curated],
  ['Open Facts + NEVO + curated (shipped)', openFacts | nevo | curated],
]

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
console.log(`split ${values.split}: ${rows.length} lines\n`)
console.log('source mix                              terms  aisle   other')
for (const [name, sources] of variants) {
  const dictionary = createGroceryDictionary(DICTIONARY_DATA, sources)
  const report = runGroceryEval(rows, dictionary)
  console.log(
    `${name.padEnd(38)} ${String(dictionary.size).padStart(6)}  ${percent(report.accuracy).padStart(6)}  ${percent(report.otherRate).padStart(6)}`,
  )
}
console.log('')

const shipped = createGroceryDictionary(DICTIONARY_DATA)
const worst = values.misses ? 10_000 : Number(values.worst)
console.log(formatEvalReport('local lookup (shipped dictionary)', runGroceryEval(rows, shipped), worst))
console.log('')
if (cache)
  console.log(
    formatEvalReport('local lookup + shared AI cache', runGroceryEval(rows, shipped, cache), worst),
  )
else console.log('no aiCacheSnapshot.json: local + AI cache not measured')
