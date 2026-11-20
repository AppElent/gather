// Writes packages/core/src/groceries/data/names.generated.ts from
// curated.txt (APP-311). Run it after changing curated.txt:
//   node --import ./scripts/groceries/ts-hooks.mjs scripts/groceries/build-names.ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { curatedNames, namesModule } from './names'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const output = path.join(
  root,
  'packages/core/src/groceries/data/names.generated.ts',
)
const text = fs.readFileSync(path.join(here, 'curated.txt'), 'utf8')
fs.writeFileSync(output, namesModule(curatedNames(text)))
console.error(`wrote ${path.relative(root, output)}`)
