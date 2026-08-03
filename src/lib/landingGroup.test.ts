import { describe, expect, test } from 'vitest'
import { landingGroupSlug } from './landingGroup'

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
