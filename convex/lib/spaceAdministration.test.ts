import { describe, expect, test } from 'vitest'
import {
  assertAdminCanLeave,
  collectPaginatedMemberships,
  clerkRoleFor,
  membershipUserId,
  normalizeClerkMemberships,
  reconciliationSnapshot,
} from './spaceAdministration'

describe('space administration helpers', () => {
  const clerkMemberships = [
    { id: 'mem_admin', publicUserData: { userId: 'user_admin' }, role: 'org:admin' },
    { id: 'mem_member', publicUserData: { userId: 'user_member' }, role: 'org:member' },
  ]

  test('normalizes Clerk memberships into Gather roles', () => {
    expect(normalizeClerkMemberships(clerkMemberships)).toEqual([
      { id: 'mem_admin', userId: 'user_admin', role: 'admin' },
      { id: 'mem_member', userId: 'user_member', role: 'member' },
    ])
  })

  test('rejects demoting or removing the final admin', () => {
    expect(() =>
      assertAdminCanLeave([{ id: 'mem_admin', userId: 'user_admin', role: 'admin' }], 'mem_admin'),
    ).toThrow('A Space must have at least one admin')
  })

  test('maps Gather roles to Clerk roles', () => {
    expect(clerkRoleFor('admin')).toBe('org:admin')
    expect(clerkRoleFor('member')).toBe('org:member')
  })

  test('resolves a target membership user', () => {
    const memberships = normalizeClerkMemberships(clerkMemberships)
    expect(membershipUserId(memberships, 'mem_member')).toBe('user_member')
    expect(() => membershipUserId(memberships, 'mem_missing')).toThrow('Clerk membership not found')
  })


  test('collects every Clerk membership page', async () => {
    const calls: Array<{ limit: number; offset: number }> = []
    const memberships = await collectPaginatedMemberships(async (args) => {
      calls.push(args)
      if (args.offset === 0) {
        return {
          data: [
            { id: 'mem_1', publicUserData: { userId: 'user_1' }, role: 'org:admin' },
            { id: 'mem_2', publicUserData: { userId: 'user_2' }, role: 'org:member' },
          ],
        }
      }
      return {
        data: [
          { id: 'mem_3', publicUserData: { userId: 'user_3' }, role: 'org:admin' },
        ],
      }
    }, 2)

    expect(memberships.map((membership) => membership.id)).toEqual([
      'mem_1',
      'mem_2',
      'mem_3',
    ])
    expect(calls).toEqual([
      { limit: 2, offset: 0 },
      { limit: 2, offset: 2 },
    ])
  })
  test('creates a reconciliation snapshot from Clerk memberships', () => {
    expect(reconciliationSnapshot(clerkMemberships)).toEqual([
      { clerkMembershipId: 'mem_admin', clerkUserId: 'user_admin', role: 'admin' },
      { clerkMembershipId: 'mem_member', clerkUserId: 'user_member', role: 'member' },
    ])
  })
})
