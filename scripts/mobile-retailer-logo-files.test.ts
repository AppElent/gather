/**
 * The phone's generated logo list (`apps/mobile/src/features/loyalty-cards/
 * components/retailer-logo-files.ts`) against `@gather/core/retailer-logos`
 * (APP-159). The list is read as text: it `require`s image files, which only
 * Metro can load.
 */
import fs from 'node:fs'
import path from 'node:path'
import { RETAILER_LOGOS } from '@gather/core/retailer-logos'
import { expect, test } from 'vitest'

import {
  OUTPUT,
  renderRetailerLogoFiles,
} from '../apps/mobile/scripts/generate-retailer-logo-files.mjs'

const committed = fs.readFileSync(OUTPUT, 'utf8')

test('the committed list is what the generator writes', () => {
  // Stale: run `node apps/mobile/scripts/generate-retailer-logo-files.mjs`.
  expect(committed).toBe(renderRetailerLogoFiles())
})

test('lists every shipped logo once, and a file exists for each', () => {
  const entries = [...committed.matchAll(/^ {2}'([^']+)': require\('([^']+)'\),$/gm)]
  expect(entries.map(([, key]) => key).sort()).toEqual(
    Object.keys(RETAILER_LOGOS).sort(),
  )
  for (const [, key, file] of entries) {
    expect(fs.existsSync(path.resolve(path.dirname(OUTPUT), file)), key).toBe(true)
  }
})
