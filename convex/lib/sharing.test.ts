import { describe, expect, test } from 'vitest'
import { isVisibleTo } from './sharing'

const viewer = { userId: 'u1', groupIds: ['gA', 'gB'] }

describe('isVisibleTo', () => {
  test('owner sees their own private record', () => {
    const rec = { ownerId: 'u1', sharedGroupIds: [] }
    expect(isVisibleTo(rec, viewer)).toBe(true)
  })

  test('non-owner cannot see a private record', () => {
    const rec = { ownerId: 'u2', sharedGroupIds: [] }
    expect(isVisibleTo(rec, viewer)).toBe(false)
  })

  test('member of a shared group sees the record', () => {
    const rec = { ownerId: 'u2', sharedGroupIds: ['gB'] }
    expect(isVisibleTo(rec, viewer)).toBe(true)
  })

  test('record shared only with a group the viewer is not in is hidden', () => {
    const rec = { ownerId: 'u2', sharedGroupIds: ['gC'] }
    expect(isVisibleTo(rec, viewer)).toBe(false)
  })

  test('owner always sees their record regardless of groups', () => {
    const rec = { ownerId: 'u1', sharedGroupIds: ['gC'] }
    expect(isVisibleTo(rec, viewer)).toBe(true)
  })
})
