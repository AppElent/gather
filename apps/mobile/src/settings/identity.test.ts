import { describe, expect, test } from 'vitest'

import { identityInitial } from './identity'

describe('identityInitial', () => {
  test('withholds an initial until Clerk has loaded the account', () => {
    expect(identityInitial(false, 'Ada Lovelace', 'ada@example.com')).toBeNull()
  })

  test('uses the name, then email, once the account is loaded', () => {
    expect(identityInitial(true, 'Ada Lovelace', 'ada@example.com')).toBe('A')
    expect(identityInitial(true, '', 'ada@example.com')).toBe('A')
  })
})
