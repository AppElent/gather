import { describe, expect, test } from 'vitest'
import { nextBase, overlaps } from './noteConflict'

describe('overlaps', () => {
  const base = { title: 'T', body: 'b' }
  test('a field they changed that this edit writes is a conflict', () => {
    expect(overlaps({ body: 'mine' }, base, { title: 'T', body: 'theirs' })).toBe(
      true,
    )
  })
  test('a field they changed that this edit leaves alone is not', () => {
    expect(overlaps({ body: 'mine' }, base, { title: 'Theirs', body: 'b' })).toBe(
      false,
    )
  })
})

describe('nextBase', () => {
  const note = { title: 'T', body: 'b', updatedAt: 2 }
  test('starts from the note', () => {
    expect(nextBase(null, note, { title: '', body: '' })).toBe(note)
  })
  test('moves on once every field shows the note', () => {
    const old = { ...note, body: 'a', updatedAt: 1 }
    expect(nextBase(old, note, { title: 'T', body: 'b' })).toBe(note)
  })
  test('stays while a field holds text typed over the old version', () => {
    const old = { ...note, body: 'a', updatedAt: 1 }
    expect(nextBase(old, note, { title: 'T', body: 'mine' })).toBe(old)
  })
  test('never goes back to an older version', () => {
    const newer = { ...note, updatedAt: 3 }
    expect(nextBase(newer, note, { title: 'T', body: 'b' })).toBe(newer)
  })
})
