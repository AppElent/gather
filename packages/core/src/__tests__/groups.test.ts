import { describe, expect, test } from 'vitest'
import { landingGroupId, selectGroup } from '../groups'

const FIRST = { _id: 'group-alice' }
const SECOND = { _id: 'group-jansen' }
const OTHER = { _id: 'group-wine' }

describe('the Group an ambient client lands in', () => {
  test('is the first Group in the stable membership order', () => {
    expect(landingGroupId([SECOND, FIRST, OTHER])).toBe('group-jansen')
  })

  test('is nowhere when I am in no Group at all', () => {
    expect(landingGroupId([])).toBeNull()
  })

  // Not a stored active Group: the same input gives the same answer, and
  // nothing about having been asked changes what it answers next time.
  test('is decided from the list alone and remembers nothing', () => {
    const groups = [FIRST, SECOND]
    expect(landingGroupId(groups)).toBe(landingGroupId(groups))
    expect(landingGroupId([OTHER])).toBe('group-wine')
  })
})

describe('the Group the phone reopens in', () => {
  test('is the one it was left in, when that is still mine', () => {
    expect(selectGroup('group-wine', [FIRST, SECOND, OTHER])).toEqual({
      status: 'ready',
      groupId: 'group-wine',
      source: 'retained',
    })
  })

  test('is the landing Group when nothing was retained', () => {
    expect(selectGroup(null, [SECOND, FIRST])).toEqual({
      status: 'ready',
      groupId: 'group-jansen',
      source: 'landing',
    })
  })

  test('falls back rather than opening a Group I am no longer in', () => {
    expect(selectGroup('group-wine', [SECOND, FIRST])).toEqual({
      status: 'ready',
      groupId: 'group-jansen',
      source: 'landing',
    })
  })

  test('falls back for a slug that never named a Group at all', () => {
    expect(selectGroup('', [SECOND])).toEqual({
      status: 'ready',
      groupId: 'group-jansen',
      source: 'landing',
    })
    expect(selectGroup('   ', [SECOND])).toEqual({
      status: 'ready',
      groupId: 'group-jansen',
      source: 'landing',
    })
  })

  // An unanswered query is not an empty list. Choosing a Group here would mean
  // opening one Group and then swapping it for another a round-trip later.
  test('is undecided while the Groups have not arrived', () => {
    expect(selectGroup('group-wine', undefined)).toEqual({ status: 'pending' })
    expect(selectGroup(null, undefined)).toEqual({ status: 'pending' })
  })

  test('is nowhere at all when I am in no Group', () => {
    expect(selectGroup('group-wine', [])).toEqual({ status: 'none' })
    expect(selectGroup(null, [])).toEqual({ status: 'none' })
  })
})
