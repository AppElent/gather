import { describe, expect, test } from 'vitest'
import { FALLBACK_MEMBER_NAME, nameFromIdentity, storedName } from './displayName'

describe('nameFromIdentity', () => {
  test('takes the full name first', () => {
    expect(nameFromIdentity({ name: ' Sanne  de Vries ', givenName: 'S' })).toBe(
      'Sanne de Vries',
    )
  })

  test('joins given and family name when there is no full name', () => {
    expect(nameFromIdentity({ givenName: 'Sanne' })).toBe('Sanne')
    expect(nameFromIdentity({ name: '', givenName: 'Sanne', familyName: 'Bos' })).toBe(
      'Sanne Bos',
    )
  })

  test('then the nickname, then the username', () => {
    expect(nameFromIdentity({ nickname: 'san', preferredUsername: 'sanne1' })).toBe('san')
    expect(nameFromIdentity({ preferredUsername: 'sanne1' })).toBe('sanne1')
  })

  test('holds nothing when every claim is empty', () => {
    expect(nameFromIdentity({ name: '  ', givenName: '' })).toBeNull()
  })
})

describe('storedName', () => {
  test('repairs a stored fallback once the token has a name', () => {
    expect(storedName({ givenName: 'Sanne' }, FALLBACK_MEMBER_NAME)).toBe('Sanne')
  })

  test('keeps a stored name when the token has none', () => {
    expect(storedName({}, 'Sanne')).toBe('Sanne')
  })

  test('falls back to Member for a new account without any name', () => {
    expect(storedName({})).toBe(FALLBACK_MEMBER_NAME)
  })
})
