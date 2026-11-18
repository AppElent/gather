import { describe, expect, test } from 'vitest'

import { leaveRule } from './leaveRule'

const admin = { role: 'admin' as const }
const member = { role: 'member' as const }

// The same cases `convex/groups.test.ts` holds `groups.leaveGroup` to.
describe('leaveRule', () => {
  test('a Member who is not an admin may always leave', () => {
    expect(leaveRule('member', undefined)).toBe('allowed')
    expect(leaveRule('member', [admin, member])).toBe('allowed')
  })

  test('the only admin may not leave while anyone else is still in it', () => {
    expect(leaveRule('admin', [admin, member])).toBe('only-admin')
    expect(leaveRule('admin', [admin, member, member])).toBe('only-admin')
  })

  test('the last admin may leave once nobody else is in it', () => {
    expect(leaveRule('admin', [admin])).toBe('allowed')
  })

  test('an admin may leave once somebody else is one too', () => {
    expect(leaveRule('admin', [admin, admin, member])).toBe('allowed')
  })

  test('nothing is decided before the role and Members have loaded', () => {
    expect(leaveRule(undefined, [admin, member])).toBe('unknown')
    expect(leaveRule('admin', undefined)).toBe('unknown')
  })
})
