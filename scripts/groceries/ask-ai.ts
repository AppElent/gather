// Records what the AI fallback answers for every eval line the bundled
// dictionary does not know, so CI can score "local + shared AI cache" without
// calling a model (packages/core/src/groceries/eval/aiCacheSnapshot.json).
// The question goes through the real internal action on a Convex deployment,
// with that deployment's key and budget:
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/ask-ai.ts
// Re-run it after the dictionary or the prompt changes.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GroceryAisle } from '../../packages/core/src/groceries/aisles'
import { parseEvalSet } from '../../packages/core/src/groceries/eval/groceryEval'
import { groceryDictionary, recogniseGroceryLine } from '../../packages/core/src/groceries/index'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const evalDir = path.join(root, 'packages/core/src/groceries/eval')
const rows = parseEvalSet(fs.readFileSync(path.join(evalDir, 'groceryLines.txt'), 'utf8'))

const unknown = new Map<string, string>()
for (const row of rows) {
  const result = recogniseGroceryLine(row.line)
  if (result.source === 'none' && result.key) unknown.set(result.key, result.cleanName)
}
console.error(
  `${unknown.size} names unknown to the dictionary (${groceryDictionary().size} terms)`,
)

const answers: Record<string, GroceryAisle> = {}
const entries = [...unknown]
for (let start = 0; start < entries.length; start += 50) {
  const batch = entries.slice(start, start + 50)
  const output = execFileSync(
    'pnpm',
    [
      'exec',
      'convex',
      'run',
      'groceryCategories:askNames',
      JSON.stringify({ names: batch.map(([, cleanName]) => cleanName) }),
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const result = JSON.parse(output) as { name: string; aisle: GroceryAisle | null }[]
  for (const [index, [key]] of batch.entries()) {
    const aisle = result[index]?.aisle
    if (aisle) answers[key] = aisle
  }
}

const sorted = Object.fromEntries(Object.entries(answers).sort(([a], [b]) => (a < b ? -1 : 1)))
fs.writeFileSync(
  path.join(evalDir, 'aiCacheSnapshot.json'),
  `${JSON.stringify(
    {
      about:
        'Answers of the grocery AI fallback (convex/lib/groceryAi.ts) for the eval lines the dictionary does not know, keyed by groceryKey. Written by scripts/groceries/ask-ai.ts.',
      model: 'claude-haiku-5-5',
      recordedOn: new Date().toISOString().slice(0, 10),
      answers: sorted,
    },
    null,
    2,
  )}\n`,
)
console.error(`recorded ${Object.keys(sorted).length} answers`)
