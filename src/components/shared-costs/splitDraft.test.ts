import { describe, expect, test } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  amountText,
  duplicateOf,
  EMPTY_DRAFT,
  outcomeOf,
  type Person,
  peopleOf,
  type SavedSplit,
  type SplitDraft,
  savePayload,
} from './splitDraft'

const member = (id: string, name: string): Person => ({
  id,
  name,
  userId: id as Id<'users'>,
})
const NORA = member('n', 'Nora')
const SAM = member('s', 'Sam')
const MEMBERS = [NORA, SAM]

const draft = (more: Partial<SplitDraft> = {}): SplitDraft => ({
  ...EMPTY_DRAFT,
  payments: [{ key: 1, personId: 's', amountCents: 1001 }],
  names: { s: 'Sam' },
  ...more,
})

describe('outcomeOf', () => {
  test('null participants are everybody, to the cent', () => {
    const { participantIds, result, balances } = outcomeOf(draft(), MEMBERS)
    expect(participantIds).toEqual(['n', 's'])
    expect([...result.owedCents.values()]).toEqual([501, 500])
    expect(balances).toBe(true)
  })

  test.each([
    ['5,01', '5', true],
    ['5', '5', false],
    ['x', '10,01', false],
    ['-1', '11,01', false],
    ['', '10.01', true],
  ])('custom %s and %s: usable is %s', (n, s, usable) => {
    const custom = draft({ mode: 'custom', customAmounts: { n, s } })
    expect(outcomeOf(custom, MEMBERS).balances).toBe(usable)
  })
})

test('a payer who leaves mid-calculation keeps their name and their payment', () => {
  const left = draft()
  const people = peopleOf([NORA], left)
  const payload = savePayload('g', 'Trip', left, outcomeOf(left, people), people)
  expect(payload.payments[0].party).toEqual({ userId: undefined, name: 'Sam' })
  expect(payload.totalCents).toBe(1001)
})

test('a participant who leaves mid-calculation keeps their part', () => {
  const chosen = draft({
    participantIds: ['n', 's'],
    names: { n: 'Nora', s: 'Sam' },
  })
  const { result } = outcomeOf(chosen, peopleOf([SAM], chosen))
  expect([...result.owedCents.values()]).toEqual([501, 500])
})

describe('duplicateOf', () => {
  const party = (person: Person) => ({
    userId: person.userId,
    name: person.name,
  })
  const robin = { name: 'Robin' }
  const saved = {
    name: 'Birthday',
    payments: [{ party: robin, amountCents: 9050, label: 'Cake' }],
    participants: [robin, party(SAM)],
    mode: 'custom',
    owed: [
      { party: robin, amountCents: 3000 },
      { party: party(SAM), amountCents: 6050 },
    ],
    transfers: [{ from: party(SAM), to: robin, amountCents: 6050 }],
    totalCents: 9050,
  } as SavedSplit

  test('saving it again gives the same figures, somebody who left included', () => {
    const copy = duplicateOf(saved, MEMBERS, 'nl')
    expect(copy.customAmounts.s).toBe('60,50')
    const people = peopleOf(MEMBERS, copy)
    const outcome = outcomeOf(copy, people)
    expect(outcome.balances).toBe(true)
    expect(savePayload('g', saved.name, copy, outcome, people)).toEqual({
      groupSlug: 'g',
      ...saved,
    })
  })

  test.each(['equal', 'custom'] as const)(
    'two who left under one name stay two people (%s)',
    (mode) => {
      const gone = { name: 'Member' }
      const twice = {
        ...saved,
        mode,
        payments: [{ party: party(SAM), amountCents: 9000 }],
        participants: [gone, gone, party(SAM)],
        owed: [gone, gone, party(SAM)].map((each) => ({
          party: each,
          amountCents: 3000,
        })),
        transfers: [1, 2].map(() => ({
          from: gone,
          to: party(SAM),
          amountCents: 3000,
        })),
        totalCents: 9000,
      } as SavedSplit
      const copy = duplicateOf(twice, MEMBERS, 'en')
      const people = peopleOf(MEMBERS, copy)
      const payload = savePayload('g', twice.name, copy, outcomeOf(copy, people), people)
      expect(payload).toMatchObject({
        owed: twice.owed,
        transfers: twice.transfers,
        totalCents: 9000,
      })
    },
  )
})

test('an amount is typed back in the reader’s decimal mark, without grouping', () => {
  expect(amountText(123456, 'nl')).toBe('1234,56')
  expect(amountText(123456, 'en')).toBe('1234.56')
  expect(amountText(42000, 'en')).toBe('420')
})
