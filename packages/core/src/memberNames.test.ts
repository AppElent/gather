import { describe, expect, test } from 'vitest'

import { clerkUserName, firstName, memberFirstNames } from './memberNames'

describe('firstName', () => {
  test('is the first word of the display name', () => {
    expect(firstName('Sam Okonkwo')).toBe('Sam')
    expect(firstName('  Anne-Marie   de Vries ')).toBe('Anne-Marie')
  })

  test('falls back to the whole name when it is one word', () => {
    expect(firstName('Noor')).toBe('Noor')
    expect(firstName('')).toBe('')
  })
})

describe('memberFirstNames', () => {
  test('gives each Member their first name', () => {
    const names = memberFirstNames([
      { id: 'a', name: 'Sam Okonkwo' },
      { id: 'b', name: 'Sanne Jansen' },
    ])
    expect(names.get('a')).toBe('Sam')
    expect(names.get('b')).toBe('Sanne')
  })

  test('keeps full names when two Members share a first name', () => {
    const names = memberFirstNames([
      { id: 'a', name: 'Sam Okonkwo' },
      { id: 'b', name: 'sam de Boer' },
      { id: 'c', name: 'Noor' },
    ])
    expect(names.get('a')).toBe('Sam Okonkwo')
    expect(names.get('b')).toBe('sam de Boer')
    expect(names.get('c')).toBe('Noor')
  })

  test('treats accents as the same first name', () => {
    const names = memberFirstNames([
      { id: 'a', name: 'Zoë Bakker' },
      { id: 'b', name: 'Zoe Visser' },
    ])
    expect(names.get('a')).toBe('Zoë Bakker')
    expect(names.get('b')).toBe('Zoe Visser')
  })

  test('leaves a blank name blank', () => {
    expect(memberFirstNames([{ id: 'a', name: '  ' }]).get('a')).toBe('')
  })
})

describe('clerkUserName (APP-676)', () => {
  test('prefers the full name, then first and last, then the username', () => {
    expect(clerkUserName({ fullName: 'Eric Jansen', firstName: 'E' })).toBe('Eric Jansen')
    expect(clerkUserName({ firstName: 'Eric', lastName: null })).toBe('Eric')
    expect(clerkUserName({ username: 'eric' })).toBe('eric')
  })

  test('is undefined without a user or a name', () => {
    expect(clerkUserName(null)).toBeUndefined()
    expect(clerkUserName({ fullName: ' ', firstName: null })).toBeUndefined()
  })
})
