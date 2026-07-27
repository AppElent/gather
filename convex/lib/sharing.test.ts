import { describe, expect, test } from 'vitest'
import { isVisibleTo, pickCanonicalUser } from './sharing'

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

describe('pickCanonicalUser', () => {
  test('no rows resolves to null rather than throwing', () => {
    expect(pickCanonicalUser([])).toBeNull()
  })

  test('a single row is returned as-is', () => {
    const row = { _id: 'a', _creationTime: 5 }
    expect(pickCanonicalUser([row])).toBe(row)
  })

  // The prod outage this guards: two `users` rows shared one clerkId, and the
  // `.unique()` this replaced threw out of every viewer-scoped query, so the
  // whole app 500'd instead of just showing one account's data.
  test('duplicate rows resolve to the oldest instead of throwing', () => {
    const old = { _id: 'old', _creationTime: 1784127307809 }
    const dupe = { _id: 'dupe', _creationTime: 1784921771826 }
    expect(pickCanonicalUser([dupe, old])).toBe(old)
    expect(pickCanonicalUser([old, dupe])).toBe(old)
  })

  test('the pick is stable no matter what order the rows arrive in', () => {
    const rows = [
      { _id: 'b', _creationTime: 20 },
      { _id: 'a', _creationTime: 10 },
      { _id: 'c', _creationTime: 30 },
    ]
    const expected = rows[1]
    expect(pickCanonicalUser(rows)).toBe(expected)
    expect(pickCanonicalUser([...rows].reverse())).toBe(expected)
  })
})
