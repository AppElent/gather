// Records what the AI fallback answers for every eval line (tuned and fresh)
// the bundled dictionary does not know, so CI can score "local + shared AI
// cache" without calling a model
// (packages/core/src/groceries/eval/aiCacheSnapshot.json).
// The question goes through the real internal action on a Convex deployment,
// with that deployment's key; only ever dev, never production:
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/ask-ai.ts [--times 3]
// Every name is asked --times times (default 3) and the majority answer is
// recorded, a tie going to the first answer: one answer per name is noisy near
// the 90% AI-only gate. The questions do not use the app's daily grocery AI
// budget (`askNames` takes nothing from it); the run is capped instead.
// It exits non-zero unless the selected deployment (CONVEX_DEPLOY_KEY,
// CONVEX_DEPLOYMENT or .env.local) is a `dev:` one (APP-751).
// Re-run it after the dictionary, the prompt or the model changes; the
// snapshot records a hash of the prompt and the model id, and the eval fails
// when they no longer match. It writes nothing when a name that may be asked
// gets no answer.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { SMALL_MODEL } from '../../convex/lib/anthropic'
import { groceryAiFingerprint, isAskableGroceryName } from '../../convex/lib/groceryAi'
import type { GroceryAisle } from '../../packages/core/src/groceries/aisles'
import {
  majorityAisle,
  parseEvalSet,
  unknownEvalNames,
} from '../../packages/core/src/groceries/eval/groceryEval'
import { groceryDictionary } from '../../packages/core/src/groceries/index'
import { assertDevDeployment } from './devOnly'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const evalDir = path.join(root, 'packages/core/src/groceries/eval')

const envLocalPath = path.join(root, '.env.local')
try {
  const deployment = assertDevDeployment(
    process.env,
    fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : null,
  )
  console.error(`asking through ${deployment}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

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

const { values } = parseArgs({ options: { times: { type: 'string', default: '3' } } })
const TIMES = Number(values.times)
// Questions one run may ask, whatever --times says.
const MAX_QUESTIONS = 600
if (!Number.isInteger(TIMES) || TIMES < 1 || askable.length * TIMES > MAX_QUESTIONS) {
  console.error(
    `--times must be a whole number with names × times at most ${MAX_QUESTIONS} (${askable.length} names asked)`,
  )
  process.exit(1)
}
console.error(`asking ${askable.length} names ${TIMES} times each`)

const answers: Record<string, GroceryAisle> = {}
const BATCH = 50
for (let start = 0; start < askable.length; start += BATCH) {
  const batch = askable.slice(start, start + BATCH)
  const rounds: (GroceryAisle | null)[][] = batch.map(() => [])
  for (let round = 0; round < TIMES; round++) {
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
    for (const index of batch.keys()) rounds[index]?.push(result[index]?.aisle ?? null)
  }
  for (const [index, [key, name]] of batch.entries()) {
    const given = rounds[index] ?? []
    const aisle = majorityAisle(given)
    if (aisle) answers[key] = aisle
    if (new Set(given).size > 1) console.error(`  split: ${name} → ${given.join(', ')} → ${aisle}`)
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
        'Answers of the grocery AI fallback (convex/lib/groceryAi.ts) for the eval lines the dictionary does not know, keyed by groceryKey. notAsked: names the server refuses to send to the model. promptHash: SHA-256 of the model id, tool and prompt the answers were recorded with. Written by scripts/groceries/ask-ai.ts; never edit by hand.',
      model: SMALL_MODEL,
      promptHash: createHash('sha256').update(groceryAiFingerprint()).digest('hex'),
      recordedOn: new Date().toISOString().slice(0, 10),
      notAsked,
      answers: sorted,
    },
    null,
    2,
  )}\n`,
)
console.error(`recorded ${Object.keys(sorted).length} answers`)
