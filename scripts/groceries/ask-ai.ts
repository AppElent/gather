// Records what the AI fallback answers for every eval line (tuned and fresh)
// the bundled dictionary does not know, so CI can score "local + shared AI
// cache" without calling a model
// (packages/core/src/groceries/eval/aiCacheSnapshot.json).
// The question goes through the real internal action on a Convex deployment,
// with that deployment's key and budget; only ever dev, never production:
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/ask-ai.ts
// Re-run it after the dictionary or the prompt changes. It writes nothing when
// a name that may be asked gets no answer.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SMALL_MODEL } from '../../convex/lib/anthropic'
import { isAskableGroceryName } from '../../convex/lib/groceryAi'
import type { GroceryAisle } from '../../packages/core/src/groceries/aisles'
import { parseEvalSet, unknownEvalNames } from '../../packages/core/src/groceries/eval/groceryEval'
import { groceryDictionary } from '../../packages/core/src/groceries/index'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const evalDir = path.join(root, 'packages/core/src/groceries/eval')
const rows = ['groceryLines.txt', 'freshLines.txt'].flatMap((file) =>
  parseEvalSet(fs.readFileSync(path.join(evalDir, file), 'utf8')),
)

const unknown = [...unknownEvalNames(rows, groceryDictionary())]
const askable = unknown.filter(([, name]) => isAskableGroceryName(name))
const notAsked = unknown
  .filter(([, name]) => !isAskableGroceryName(name))
  .map(([key]) => key)
  .sort()
console.error(
  `${unknown.length} names unknown to the dictionary (${groceryDictionary().size} terms), ${notAsked.length} of them never sent to the model`,
)

const answers: Record<string, GroceryAisle> = {}
const BATCH = 50
for (let start = 0; start < askable.length; start += BATCH) {
  const batch = askable.slice(start, start + BATCH)
  const output = execFileSync(
    'pnpm',
    [
      'exec',
      'convex',
      'run',
      'groceryCategories:askNames',
      JSON.stringify({ names: batch.map(([, name]) => name) }),
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const result = JSON.parse(output) as { name: string; aisle: GroceryAisle | null }[]
  for (const [index, [key]] of batch.entries()) {
    const aisle = result[index]?.aisle
    if (aisle) answers[key] = aisle
  }
}

const unanswered = askable.filter(([key]) => !answers[key]).map(([, name]) => name)
if (unanswered.length > 0) {
  console.error(`no answer for ${unanswered.join(', ')}; snapshot not written`)
  process.exit(1)
}

const sorted = Object.fromEntries(Object.entries(answers).sort(([a], [b]) => (a < b ? -1 : 1)))
fs.writeFileSync(
  path.join(evalDir, 'aiCacheSnapshot.json'),
  `${JSON.stringify(
    {
      about:
        'Answers of the grocery AI fallback (convex/lib/groceryAi.ts) for the eval lines the dictionary does not know, keyed by groceryKey. notAsked: names the server refuses to send to the model. Written by scripts/groceries/ask-ai.ts; never edit by hand.',
      model: SMALL_MODEL,
      recordedOn: new Date().toISOString().slice(0, 10),
      notAsked,
      answers: sorted,
    },
    null,
    2,
  )}\n`,
)
console.error(`recorded ${Object.keys(sorted).length} answers`)
