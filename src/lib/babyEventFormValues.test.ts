import { beforeEach, describe, expect, test } from 'vitest'
import type { Doc } from '../../convex/_generated/dataModel'
import type { BabyEventType } from '../../convex/lib/babyEvents'
import { isValidEventData } from '../../convex/lib/babyEvents'
import { buildEventInput, initialEventValues } from './babyEventFormValues'

const START = new Date('2026-07-25T09:00:00').getTime()

/** A babyEvents doc with just the fields these helpers read. */
function eventDoc(
  type: BabyEventType,
  data: Record<string, unknown>,
  endTimestamp?: number,
): Doc<'babyEvents'> {
  return {
    _id: 'event1' as Doc<'babyEvents'>['_id'],
    _creationTime: START,
    babyId: 'baby1' as Doc<'babyEvents'>['babyId'],
    type,
    timestamp: START,
    endTimestamp,
    loggedBy: 'user1' as Doc<'babyEvents'>['loggedBy'],
    data,
  } as Doc<'babyEvents'>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('initialEventValues', () => {
  test('seeds each type from an existing event', () => {
    const values = initialEventValues(
      'feeding',
      eventDoc('feeding', {
        method: 'breast',
        side: 'left',
        leftMin: 12,
      }),
    )
    expect(values).toMatchObject({
      method: 'breast',
      side: 'left',
      leftMin: '12',
      rightMin: '',
    })
  })

  test('falls back to defaults for a new entry', () => {
    expect(initialEventValues('feeding').method).toBe('bottle')
    expect(initialEventValues('diaper').kind).toBe('wet')
    expect(initialEventValues('temperature').celsius).toBe('37.5')
    expect(initialEventValues('note').milestone).toBe(false)
  })

  test('round-trips a growth entry back into the same data', () => {
    const values = initialEventValues(
      'growth',
      eventDoc('growth', { weightKg: 4.2, headCircumferenceCm: 38 }),
    )
    expect(buildEventInput('growth', values, START).data).toEqual({
      weightKg: 4.2,
      heightCm: undefined,
      headCircumferenceCm: 38,
    })
  })
})

describe('buildEventInput — breast feeds', () => {
  test('derives the side from whichever sides have minutes', () => {
    const build = (leftMin: string, rightMin: string) =>
      buildEventInput('feeding', { method: 'breast', leftMin, rightMin }, START)

    expect(build('10', '8').data).toMatchObject({ side: 'both' })
    expect(build('10', '').data).toMatchObject({ side: 'left' })
    expect(build('', '8').data).toMatchObject({ side: 'right' })
    expect(build('', '').data).toMatchObject({ side: undefined })
  })

  test('keeps the stored side when no minutes are entered', () => {
    const values = initialEventValues(
      'feeding',
      eventDoc('feeding', { method: 'breast', side: 'both' }),
    )
    expect(buildEventInput('feeding', values, START).data).toMatchObject({
      side: 'both',
    })
  })

  test('derives endTimestamp from the total minutes', () => {
    const built = buildEventInput(
      'feeding',
      { method: 'breast', leftMin: '10', rightMin: '8' },
      START,
    )
    expect(built.endTimestamp).toBe(START + 18 * 60000)
  })

  test('preserves an existing end time when there are no minutes', () => {
    const values = initialEventValues(
      'feeding',
      eventDoc('feeding', { method: 'breast' }, START + 15 * 60000),
    )
    expect(buildEventInput('feeding', values, START).endTimestamp).toBe(
      START + 15 * 60000,
    )
  })

  test('clearing the minutes clears the duration they produced', () => {
    const values = initialEventValues(
      'feeding',
      eventDoc(
        'feeding',
        { method: 'breast', side: 'both', leftMin: 10, rightMin: 8 },
        START + 18 * 60000,
      ),
    )
    const built = buildEventInput(
      'feeding',
      { ...values, leftMin: '', rightMin: '' },
      START,
    )
    expect(built.endTimestamp).toBeUndefined()
    expect(built.data.leftMin).toBeUndefined()
    expect(built.data.rightMin).toBeUndefined()
  })

  test('rejects negative minutes', () => {
    expect(
      buildEventInput('feeding', { method: 'breast', leftMin: '-5' }, START)
        .error,
    ).toBe('negativeMinutes')
  })

  test('produces data the server validator accepts', () => {
    const built = buildEventInput(
      'feeding',
      { method: 'breast', leftMin: '10', rightMin: '8' },
      START,
    )
    expect(isValidEventData('feeding', built.data)).toBe(true)
  })
})

describe('buildEventInput — other types', () => {
  test('bottle feeds keep the amount and their own end time', () => {
    const built = buildEventInput(
      'feeding',
      {
        method: 'bottle',
        amountMl: '120',
        endTimestamp: String(START + 60000),
      },
      START,
    )
    expect(built.data).toMatchObject({ method: 'bottle', amountMl: 120 })
    expect(built.data.side).toBeUndefined()
    expect(built.endTimestamp).toBe(START + 60000)
  })

  test('sleep carries only its end time', () => {
    const built = buildEventInput(
      'sleep',
      { endTimestamp: String(START + 3600000) },
      START,
    )
    expect(built.data).toEqual({})
    expect(built.endTimestamp).toBe(START + 3600000)
  })

  // Keys rather than sentences: the words live in the message tree and the
  // component that shows the complaint resolves them (ADR-0011).
  test('reports the incomplete-entry errors', () => {
    expect(buildEventInput('growth', {}, START).error).toBe('enterMeasurement')
    expect(buildEventInput('medication', { name: '  ' }, START).error).toBe(
      'enterMedicationName',
    )
    expect(buildEventInput('vaccination', { name: '' }, START).error).toBe(
      'enterVaccineName',
    )
    expect(buildEventInput('memory', { what: '  ' }, START).error).toBe(
      'enterMemoryWhat',
    )
  })

  test('a memory is the trimmed sentence and nothing else', () => {
    const built = buildEventInput('memory', { what: '  First laugh ' }, START)
    expect(built.error).toBeUndefined()
    expect(built.data).toEqual({ what: 'First laugh' })
  })

  test('a note is only a milestone when ticked', () => {
    expect(buildEventInput('note', { milestone: true }, START).data).toEqual({
      milestone: true,
    })
    expect(buildEventInput('note', { milestone: false }, START).data).toEqual({
      milestone: undefined,
    })
  })
})
