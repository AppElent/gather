import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  INFISICAL_ENVIRONMENTS,
  mergeInfisicalFolders,
  normalizeInfisicalExport,
  readInfisicalConfig,
} from '../../../scripts/env-source.mjs'

describe('Infisical source configuration', () => {
  it('maps manifest targets to the verified Infisical slugs', () => {
    expect(INFISICAL_ENVIRONMENTS).toEqual({
      local: 'dev',
      preview: 'staging',
      stg: 'staging',
      production: 'prod',
    })
  })

  it('requires an initialized repository project file', () => {
    const root = mkdtempSync(join(tmpdir(), 'gather-infisical-'))
    expect(() => readInfisicalConfig(root)).toThrow('Missing .infisical.json')
    writeFileSync(join(root, '.infisical.json'), '{}')
    expect(() => readInfisicalConfig(root)).toThrow('workspaceId or projectId')
    writeFileSync(join(root, '.infisical.json'), '{not json')
    expect(() => readInfisicalConfig(root)).toThrow('Invalid .infisical.json')
  })

  it('accepts the project pointer written by infisical init', () => {
    const root = mkdtempSync(join(tmpdir(), 'gather-infisical-'))
    writeFileSync(
      join(root, '.infisical.json'),
      JSON.stringify({ workspaceId: 'project-id' }),
    )
    expect(readInfisicalConfig(root).workspaceId).toBe('project-id')
  })

  it('lets gather override root without mutating either input', () => {
    const rootValues = { SHARED: 'root', GLOBAL_ONLY: 'yes' }
    const gatherValues = { SHARED: 'gather', GATHER_ONLY: 'yes' }
    expect(mergeInfisicalFolders(rootValues, gatherValues)).toEqual({
      values: { SHARED: 'gather', GLOBAL_ONLY: 'yes', GATHER_ONLY: 'yes' },
      overrides: ['SHARED'],
    })
    expect(rootValues.SHARED).toBe('root')
  })

  it('normalizes object and CLI-array export shapes', () => {
    expect(normalizeInfisicalExport({ KEY: 'value' })).toEqual({ KEY: 'value' })
    expect(
      normalizeInfisicalExport([{ secretKey: 'KEY', secretValue: 'value' }]),
    ).toEqual({ KEY: 'value' })
  })
})
