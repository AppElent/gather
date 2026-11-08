import { describe, expect, test } from 'vitest'
import {
  isValidEventData,
  missingRequiredField,
  shortDuration,
  summarizeBabyEvent,
} from '../babyEvents'
import type { BabyEventType } from '../domain'
import { en, nl } from '../messages'

const START = new Date('2026-07-25T09:00:00').getTime()
const MINUTE = 60_000

function summary(
  type: BabyEventType,
  data: Record<string, unknown>,
  endTimestamp?: number,
) {
  return summarizeBabyEvent(
    { type, data, timestamp: START, endTimestamp },
    en.baby.log,
  )
}

describe('summarizeBabyEvent — feeding', () => {
  test('shows both sides with their minutes', () => {
    expect(
      summary('feeding', {
        method: 'breast',
        side: 'both',
        leftMin: 10,
        rightMin: 8,
      }),
    ).toBe('Breastfeeding · Left 10m · Right 8m')
  })

  test('shows only the side that was fed', () => {
    expect(
      summary('feeding', { method: 'breast', side: 'right', rightMin: 7 }),
    ).toBe('Breastfeeding · Right 7m')
  })

  test('falls back to the plain side for entries without minutes', () => {
    expect(summary('feeding', { method: 'breast', side: 'left' })).toBe(
      'Breastfeeding · Left',
    )
  })

  test('bottle feeds still show the amount', () => {
    expect(summary('feeding', { method: 'bottle', amountMl: 120 })).toBe(
      'Bottle · 120 ml',
    )
  })

  test('solid food shows its grams', () => {
    expect(summary('feeding', { method: 'solid', amountG: 50 })).toBe(
      'Solid food · 50 g',
    )
  })
})

describe('summarizeBabyEvent — memory', () => {
  test('the summary is what happened, not the word "memory"', () => {
    expect(summary('memory', { what: ' First laugh ' })).toBe('First laugh')
  })

  test('an entry with nothing to say falls back to the type', () => {
    expect(summary('memory', { what: '   ' })).toBe('Memory')
  })
})

describe('summarizeBabyEvent — the rest', () => {
  test('a temperature reads to one decimal, with its method when known', () => {
    expect(summary('temperature', { celsius: 37 })).toBe('37.0°C')
    expect(summary('temperature', { celsius: 37.25, method: 'ear' })).toBe(
      '37.3°C (Ear)',
    )
  })

  test('a sleep with a real end reads its short duration in the language', () => {
    const end = START + 70 * MINUTE
    expect(summary('sleep', {}, end)).toBe('Sleep · 1h 10m')
    expect(
      summarizeBabyEvent(
        { type: 'sleep', data: {}, timestamp: START, endTimestamp: end },
        nl.baby.log,
      ),
    ).toContain('1 u 10 min')
  })

  test('a sleep without a later end says only that it was one', () => {
    expect(summary('sleep', {})).toBe('Sleep')
    expect(summary('sleep', {}, START)).toBe('Sleep')
  })

  test('a kind this build does not know reads as the word for the type', () => {
    expect(summary('diaper', { kind: 'wet' })).toBe('Wet diaper')
    expect(summary('diaper', { kind: 'explosive' })).toBe('Diaper')
  })

  test('a note says whether it is a milestone', () => {
    expect(summary('note', {})).toBe('Note')
    expect(summary('note', { milestone: true })).toBe('Milestone')
  })

  test('growth joins what was measured, and medication its dose', () => {
    expect(summary('growth', { weightKg: 4.2, heightCm: 55 })).toBe(
      '4.2 kg · 55 cm',
    )
    expect(summary('growth', {})).toBe('Growth measurement')
    expect(
      summary('medication', {
        name: 'Paracetamol',
        doseAmount: 2.5,
        doseUnit: 'ml',
      }),
    ).toBe('Paracetamol · 2.5 ml')
    expect(summary('medication', { name: 'Paracetamol', doseAmount: 1 })).toBe(
      'Paracetamol · 1',
    )
    expect(summary('vaccination', { name: 'MMR' })).toBe('MMR')
  })
})

describe('missingRequiredField', () => {
  test('names the one box each type cannot save without', () => {
    expect(missingRequiredField('medication', { name: ' ' })).toBe(
      'enterMedicationName',
    )
    expect(missingRequiredField('vaccination', {})).toBe('enterVaccineName')
    expect(missingRequiredField('memory', { what: '' })).toBe('enterMemoryWhat')
  })

  test('is satisfied by text, and does not apply to other types', () => {
    expect(missingRequiredField('memory', { what: 'First laugh' })).toBeNull()
    expect(missingRequiredField('note', {})).toBeNull()
  })
})

describe('shortDuration', () => {
  const UNITS = en.baby.log.status.duration

  test('reads minutes, hours and whole hours', () => {
    expect(shortDuration(32 * MINUTE, UNITS)).toBe('32m')
    expect(shortDuration(180 * MINUTE, UNITS)).toBe('3h')
    expect(shortDuration(190 * MINUTE, UNITS)).toBe('3h 10m')
  })

  test('a clock that moved backwards is not a negative duration', () => {
    expect(shortDuration(-5000, UNITS)).toBe('0m')
  })
})

describe('summarizeBabyEvent — a stored row that fails its own shape', () => {
  test.each([
    ['temperature', {}, 'Temperature'],
    ['feeding', { method: 'formula' }, 'Feeding'],
    ['diaper', {}, 'Diaper'],
    ['growth', {}, 'Growth measurement'],
    ['medication', { name: '  ' }, 'Medication'],
    ['vaccination', {}, 'Vaccination'],
    ['memory', {}, 'Memory'],
  ] as const)('%s falls back to its word rather than throwing', (type, data, word) => {
    expect(summary(type, data)).toBe(word)
  })

  test('the fallback is in the language of the reader', () => {
    expect(
      summarizeBabyEvent(
        { type: 'temperature', data: {}, timestamp: START },
        nl.baby.log,
      ),
    ).toBe('Temperatuur')
  })
})

describe('isValidEventData', () => {
  test('temperature requires a numeric celsius', () => {
    expect(isValidEventData('temperature', { celsius: 37.5 })).toBe(true)
    expect(
      isValidEventData('temperature', { celsius: 37.5, method: 'ear' }),
    ).toBe(true)
    expect(isValidEventData('temperature', {})).toBe(false)
    expect(isValidEventData('temperature', { celsius: '37.5' })).toBe(false)
  })

  test('feeding requires a known method', () => {
    expect(isValidEventData('feeding', { method: 'breast' })).toBe(true)
    expect(
      isValidEventData('feeding', { method: 'bottle', amountMl: 120 }),
    ).toBe(true)
    expect(isValidEventData('feeding', { method: 'formula' })).toBe(false)
    expect(isValidEventData('feeding', {})).toBe(false)
  })

  test('feeding accepts per-side minutes but rejects impossible ones', () => {
    expect(
      isValidEventData('feeding', {
        method: 'breast',
        leftMin: 10,
        rightMin: 8,
      }),
    ).toBe(true)
    expect(isValidEventData('feeding', { method: 'breast', leftMin: 0 })).toBe(
      true,
    )
    expect(isValidEventData('feeding', { method: 'breast', leftMin: -1 })).toBe(
      false,
    )
    expect(
      isValidEventData('feeding', { method: 'breast', rightMin: Number.NaN }),
    ).toBe(false)
  })

  test('diaper requires a known kind', () => {
    expect(isValidEventData('diaper', { kind: 'wet' })).toBe(true)
    expect(isValidEventData('diaper', { kind: 'both' })).toBe(true)
    expect(isValidEventData('diaper', { kind: 'soiled' })).toBe(false)
  })

  test('sleep accepts any payload (duration comes from timestamps)', () => {
    expect(isValidEventData('sleep', {})).toBe(true)
  })

  test('growth requires at least one measurement', () => {
    expect(isValidEventData('growth', { weightKg: 4.2 })).toBe(true)
    expect(isValidEventData('growth', { heightCm: 55 })).toBe(true)
    expect(isValidEventData('growth', { headCircumferenceCm: 38 })).toBe(true)
    expect(isValidEventData('growth', {})).toBe(false)
  })

  test('medication and vaccination require a non-empty name', () => {
    expect(isValidEventData('medication', { name: 'Paracetamol' })).toBe(true)
    expect(isValidEventData('medication', { name: '  ' })).toBe(false)
    expect(isValidEventData('medication', {})).toBe(false)
    expect(isValidEventData('vaccination', { name: 'MMR' })).toBe(true)
    expect(isValidEventData('vaccination', {})).toBe(false)
  })

  test('note accepts any payload', () => {
    expect(isValidEventData('note', {})).toBe(true)
    expect(isValidEventData('note', { milestone: true })).toBe(true)
  })

  // Regression guard: this is the check that stops a client from sending
  // type: 'temperature' with a diaper-shaped `data` payload, which the
  // schema's plain v.union alone would accept (it matches *some* member).
  test('rejects data shaped for a different event type', () => {
    expect(isValidEventData('temperature', { kind: 'wet' })).toBe(false)
    expect(isValidEventData('diaper', { celsius: 37.5 })).toBe(false)
  })
})
