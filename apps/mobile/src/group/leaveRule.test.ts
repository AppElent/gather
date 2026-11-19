import { describe, expect, test } from 'vitest'

import { groupExits, type LeaveStatus } from './leaveRule'

const allowed: LeaveStatus = { leave: 'allowed', canDelete: false }
const onlyAdmin: LeaveStatus = { leave: 'only-admin', canDelete: false }
const lastMember: LeaveStatus = { leave: 'last-member', canDelete: true }

// The phone follows `groups.leaveStatus`, the rule `convex/groups.test.ts`
// holds `groups.leaveGroup` and `groups.deleteGroup` to.
describe('groupExits', () => {
  test('a Member who is not an admin may leave, and is not offered Delete', () => {
    expect(groupExits('member', allowed)).toEqual({
      leave: 'offer',
      delete: 'hidden',
    })
  })

  test('the only admin may not leave while anyone else is still in it', () => {
    expect(groupExits('admin', onlyAdmin)).toEqual({
      leave: 'only-admin',
      delete: 'others-first',
    })
  })

  test('an admin may leave once somebody else is one too, but not delete', () => {
    expect(groupExits('admin', allowed)).toEqual({
      leave: 'offer',
      delete: 'others-first',
    })
  })

  test('the last Member is offered Delete instead of Leave', () => {
    expect(groupExits('admin', lastMember)).toEqual({
      leave: 'hidden',
      delete: 'offer',
    })
  })

  test('the last Member is offered Delete even when they are not an admin', () => {
    expect(groupExits('member', lastMember)).toEqual({
      leave: 'hidden',
      delete: 'offer',
    })
  })

  test('nothing is pressable before the server has answered', () => {
    expect(groupExits('admin', undefined)).toEqual({
      leave: 'wait',
      delete: 'wait',
    })
    expect(groupExits('member', undefined)).toEqual({
      leave: 'wait',
      delete: 'hidden',
    })
    expect(groupExits(undefined, undefined)).toEqual({
      leave: 'wait',
      delete: 'hidden',
    })
  })
})
