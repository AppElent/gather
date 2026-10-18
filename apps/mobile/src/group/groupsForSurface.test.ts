import { describe, expect, test } from 'vitest'

import {
  groupsForSurface,
  type RetainedGroups,
  retainGroups,
} from './groupsForSurface'

const home = [{ slug: 'home', name: 'Home' }]
const retained: RetainedGroups<(typeof home)[number]> = {
  account: 'user_a',
  groups: home,
}

describe('groupsForSurface', () => {
  test('keeps the last resolved groups while the live query is unavailable', () => {
    expect(groupsForSurface(undefined, retained, 'user_a')).toBe(home)
  })

  test('uses a newly resolved group list when service recovers', () => {
    const current = [{ slug: 'new', name: 'New' }]
    expect(groupsForSurface(current, retained, 'user_a')).toBe(current)
  })

  test('never shows a previous account its groups after an account switch', () => {
    expect(groupsForSurface(undefined, retained, 'user_b')).toBeUndefined()
  })

  test('never shows retained groups once signed out', () => {
    expect(groupsForSurface(undefined, retained, null)).toBeUndefined()
    expect(groupsForSurface(undefined, retained, undefined)).toBeUndefined()
  })
})

describe('retainGroups', () => {
  test('retains a resolved list under the account it was resolved for', () => {
    expect(retainGroups(undefined, home, 'user_a')).toEqual(retained)
  })

  test('returns the same retention when nothing changed, so render converges', () => {
    expect(retainGroups(retained, home, 'user_a')).toBe(retained)
    expect(retainGroups(retained, undefined, 'user_a')).toBe(retained)
  })

  test('drops the retention on sign-out', () => {
    expect(retainGroups(retained, undefined, null)).toBeUndefined()
  })

  test('drops the retention on an account switch before the new list arrives', () => {
    expect(retainGroups(retained, undefined, 'user_b')).toBeUndefined()
  })

  test('replaces the retention with the new account list once it arrives', () => {
    const theirs = [{ slug: 'theirs', name: 'Theirs' }]
    expect(retainGroups(retained, theirs, 'user_b')).toEqual({
      account: 'user_b',
      groups: theirs,
    })
  })
})
