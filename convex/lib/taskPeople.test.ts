import { describe, expect, test } from 'vitest'
import type { Id } from '../_generated/dataModel'
import { membersOfPeople, withAssignee } from './taskPeople'

const id = (name: string) => name as Id<'users'>
const member = (name: string, email: string) => ({ _id: id(name), email })
const person = (uid: string, email: string, self = false) => ({
  id: uid,
  name: `Person ${uid}`,
  email,
  self,
})
const match = (
  people: ReturnType<typeof person>[],
  members: ReturnType<typeof member>[],
  connectedBy = 'nobody',
) =>
  Object.fromEntries(
    membersOfPeople({ shared: true, people }, members, id(connectedBy)),
  )

describe('membersOfPeople', () => {
  test('matches by address, whatever its case', () => {
    expect(
      match([person('1', ' Ann@X.nl')], [member('ann', 'ann@x.nl')]),
    ).toEqual({ 1: 'ann' })
  })

  test('an empty address or one two Members share matches nobody', () => {
    expect(
      match(
        [person('1', ''), person('2', 'us@x.nl')],
        [member('a', ''), member('b', 'us@x.nl'), member('c', 'us@x.nl')],
      ),
    ).toEqual({})
  })

  test('the connected account is the Member who connected it', () => {
    const relay = [member('ann', 'relay@apple')]
    expect(match([person('1', 'ann@x.nl', true)], relay, 'ann')).toEqual({
      1: 'ann',
    })
    // Not someone else in the project, nor a Member who left the Group.
    expect(match([person('1', 'ann@x.nl')], relay, 'ann')).toEqual({})
    expect(match([person('1', 'ann@x.nl', true)], relay, 'gone')).toEqual({})
  })

  test('an address outweighs who connected it', () => {
    const members = [member('ann', 'ann@x.nl'), member('bob', 'bob@x.nl')]
    expect(
      match([person('1', 'bob@x.nl', true)], members, 'ann'),
    ).toEqual({ 1: 'bob' })
    expect(
      match(
        [person('1', 'other@x.nl', true), person('2', 'ann@x.nl')],
        members,
        'ann',
      ),
    ).toEqual({ 2: 'ann' })
  })
})

test('a task says its Member, else a name, and never the provider’s id', () => {
  const task = { externalId: 't', title: 't', done: false }
  const people = {
    source: {
      shared: true,
      people: [
        person('2', 'x@x.nl'),
        { ...person('4', 'y@x.nl'), name: 'y@x.nl' },
      ],
    },
    matched: new Map([['1', id('ann')]]),
  }
  const whose = (responsibleId?: string, known = true) =>
    withAssignee({ ...task, responsibleId }, known ? people : null)
  expect(whose()).toEqual(task)
  expect(whose('1')).toEqual({ ...task, assigneeId: 'ann' })
  expect(whose('2')).toEqual({ ...task, assigneeName: 'Person 2' })
  expect(whose('3')).toEqual({ ...task, assigneeName: '' })
  expect(whose('4')).toEqual({ ...task, assigneeName: '' })
  expect(whose('1', false)).toEqual({ ...task, assigneeName: '' })
})
