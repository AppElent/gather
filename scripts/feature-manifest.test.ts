import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FEATURES } from '@gather/core/features'
import { expect, it } from 'vitest'
import { checkFeatureManifest, listRouteFiles } from './feature-manifest-check'

const repo = path.resolve(import.meta.dirname, '..')

it('maps every route to a feature', () => {
  const routes = {
    web: listRouteFiles(path.join(repo, 'src/routes')),
    mobile: listRouteFiles(path.join(repo, 'apps/mobile/app')),
  }
  expect(checkFeatureManifest(FEATURES, routes)).toEqual([])
})

it('lists flat routes but skips layouts and "-" files and folders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-routes-'))
  try {
    for (const file of [
      '_app.tsx',
      '_app.new-feature.tsx',
      '_app/_layout.tsx',
      '_app/page.tsx',
      '_app/-helpers.ts',
      '_app/-components/Card.tsx',
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), '')
    }
    expect(listRouteFiles(root)).toEqual(['_app.new-feature', '_app/page'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
