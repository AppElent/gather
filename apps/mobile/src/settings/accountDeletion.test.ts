import { describe, expect, test } from 'vitest'

import { accountDeletion } from './accountDeletion'

describe('whether the phone offers account deletion', () => {
  test('only when Clerk has said yes', () => {
    expect(accountDeletion({ deleteSelfEnabled: true })).toBe('allowed')
  })

  test('not when Clerk has said no', () => {
    expect(accountDeletion({ deleteSelfEnabled: false })).toBe('withheld')
  })

  test('not when Clerk has said nothing — absent is not permission', () => {
    expect(accountDeletion({})).toBe('withheld')
    expect(accountDeletion({ deleteSelfEnabled: undefined })).toBe('withheld')
    expect(accountDeletion({ deleteSelfEnabled: null })).toBe('withheld')
  })

  test('undecided while the user is still loading, so nothing claims it was withheld', () => {
    expect(accountDeletion(undefined)).toBe('unknown')
    expect(accountDeletion(null)).toBe('unknown')
  })
})
