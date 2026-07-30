import { describe, expect, test } from 'vitest'
import { pickCanonicalUser } from './sharing'

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
