import { describe, expect, test } from 'vitest'

import { en } from '../i18n/messages/en'
import { nl } from '../i18n/messages/nl'
import { type BuildInfo, buildInfoLine, updateLabel } from './build-info'

const update: BuildInfo = {
  version: '1.0.0',
  build: '23',
  updateId: '0a1b2c3d-1111-4222-8333-444455556666',
  isEmbeddedLaunch: false,
  createdAt: new Date('2026-11-20T09:12:00Z'),
  sha: 'a1b2c3d4e5f6',
  channel: 'preview',
}

describe('the build line', () => {
  test('names the update by the shared OTA label', () => {
    expect(buildInfoLine(nl.settings.buildInfo, update)).toBe(
      'Versie 1.0.0 (23) · update 1.0.0 · 20 nov · a1b2c3d · preview',
    )
    expect(buildInfoLine(en.settings.buildInfo, update)).toBe(
      'Version 1.0.0 (23) · update 1.0.0 · 20 nov · a1b2c3d · preview',
    )
  })

  test('says there is no update on the embedded bundle', () => {
    const embedded = {
      ...update,
      updateId: null,
      isEmbeddedLaunch: true,
      createdAt: null,
    }
    expect(buildInfoLine(nl.settings.buildInfo, embedded)).toBe(
      'Versie 1.0.0 (23) · geen update · preview',
    )
    expect(buildInfoLine(en.settings.buildInfo, embedded)).toBe(
      'Version 1.0.0 (23) · no update · preview',
    )
  })

  test('treats an embedded launch as no update even when an id is present', () => {
    expect(updateLabel({ ...update, isEmbeddedLaunch: true })).toBeNull()
    expect(updateLabel({ ...update, updateId: null })).toBeNull()
  })

  test('shows the Amsterdam day, not the UTC one', () => {
    expect(
      updateLabel({ ...update, createdAt: new Date('2026-11-20T23:30:00Z') }),
    ).toBe('1.0.0 · 21 nov · a1b2c3d')
  })

  test('falls back to the update id when the commit sha is missing or malformed', () => {
    expect(updateLabel({ ...update, sha: undefined })).toBe('0a1b2c3d')
    expect(updateLabel({ ...update, sha: '' })).toBe('0a1b2c3d')
    expect(updateLabel({ ...update, sha: 'not-a-sha' })).toBe('0a1b2c3d')
    expect(
      buildInfoLine(nl.settings.buildInfo, { ...update, sha: undefined }),
    ).toBe('Versie 1.0.0 (23) · update 0a1b2c3d · preview')
  })

  test('falls back to the update id when the publish date is unknown', () => {
    expect(updateLabel({ ...update, createdAt: null })).toBe('0a1b2c3d')
  })
})
