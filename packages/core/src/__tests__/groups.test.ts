import { describe, expect, test } from 'vitest'
import { landingGroupSlug, selectGroup } from '../groups'

const PERSONAL = { slug: 'me-alice', isPersonal: true }
const SHARED = { slug: 'jansen-household', isPersonal: false }
const OTHER = { slug: 'wine-club', isPersonal: false }

describe('the Group an address that names none lands in', () => {
  test('is my own, wherever it sits in the list', () => {
    expect(landingGroupSlug([SHARED, PERSONAL, OTHER])).toBe('me-alice')
  })

  test('is the first Group I am in when I somehow have no Personal one', () => {
    expect(landingGroupSlug([SHARED, OTHER])).toBe('jansen-household')
  })

  test('is nowhere when I am in no Group at all', () => {
    expect(landingGroupSlug([])).toBeNull()
  })

  // Not a stored active Group: the same input gives the same answer, and
  // nothing about having been asked changes what it answers next time.
  test('is decided from the list alone and remembers nothing', () => {
    const groups = [SHARED, PERSONAL]
    expect(landingGroupSlug(groups)).toBe(landingGroupSlug(groups))
    expect(landingGroupSlug([OTHER])).toBe('wine-club')
  })
})

describe('the Group the phone reopens in', () => {
  test('is the one it was left in, when that is still mine', () => {
    expect(selectGroup('wine-club', [PERSONAL, SHARED, OTHER])).toEqual({
      status: 'ready',
      slug: 'wine-club',
      source: 'retained',
    })
  })

  test('is the landing Group when nothing was retained', () => {
    expect(selectGroup(null, [SHARED, PERSONAL])).toEqual({
      status: 'ready',
      slug: 'me-alice',
      source: 'landing',
    })
  })

  test('falls back rather than opening a Group I am no longer in', () => {
    expect(selectGroup('wine-club', [SHARED, PERSONAL])).toEqual({
      status: 'ready',
      slug: 'me-alice',
      source: 'landing',
    })
  })

  test('falls back for a slug that never named a Group at all', () => {
    expect(selectGroup('', [SHARED])).toEqual({
      status: 'ready',
      slug: 'jansen-household',
      source: 'landing',
    })
    expect(selectGroup('   ', [SHARED])).toEqual({
      status: 'ready',
      slug: 'jansen-household',
      source: 'landing',
    })
  })

  // An unanswered query is not an empty list. Choosing a Group here would mean
  // opening one Group and then swapping it for another a round-trip later.
  test('is undecided while the Groups have not arrived', () => {
    expect(selectGroup('wine-club', undefined)).toEqual({ status: 'pending' })
    expect(selectGroup(null, undefined)).toEqual({ status: 'pending' })
  })

  test('is nowhere at all when I am in no Group', () => {
    expect(selectGroup('wine-club', [])).toEqual({ status: 'none' })
    expect(selectGroup(null, [])).toEqual({ status: 'none' })
  })
})
