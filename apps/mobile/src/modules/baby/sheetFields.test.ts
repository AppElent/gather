import { describe, expect, test } from 'vitest'

import {
  buildSheetData,
  endTimestampFor,
  fieldsFor,
  initialPicks,
  lastOfType,
  missingRequired,
  type PreviousEvent,
  parseNumber,
  SHEET_SPECS,
  sheetHandles,
  stepValue,
} from './sheetFields'

describe('which types the quick sheet can finish', () => {
  test('the four one-tap ones, plus note', () => {
    expect(sheetHandles('feeding')).toBe(true)
    expect(sheetHandles('diaper')).toBe(true)
    expect(sheetHandles('sleep')).toBe(true)
    expect(sheetHandles('note')).toBe(true)
  })

  test('the free-text ones too — there is no second screen to fall through to', () => {
    expect(sheetHandles('growth')).toBe(true)
    expect(sheetHandles('medication')).toBe(true)
    expect(sheetHandles('vaccination')).toBe(true)
  })
})

describe('a unit belongs to a method, not to a type', () => {
  const keys = (method: string) =>
    fieldsFor('feeding', { method }).map((field) => field.key)

  test('a breastfeed is minutes per side and nothing else', () => {
    expect(keys('breast')).toEqual(['method', 'leftMin', 'rightMin'])
  })

  test('a bottle is millilitres', () => {
    expect(keys('bottle')).toEqual(['method', 'amountMl'])
  })

  test('solid food is grams', () => {
    expect(keys('solid')).toEqual(['method', 'amountG'])
  })

  test('a type with no conditional rows is unaffected', () => {
    expect(fieldsFor('diaper', { kind: 'wet' }).map((f) => f.key)).toEqual([
      'kind',
    ])
  })
})

describe('what starts selected', () => {
  test('the fallback when nothing of this type was ever logged', () => {
    expect(initialPicks('feeding', undefined)).toEqual({
      method: 'bottle',
      leftMin: '0',
      rightMin: '0',
      amountMl: '120',
      amountG: '50',
    })
  })

  test('last time’s choice, which is the point of the sheet', () => {
    const previous: PreviousEvent = {
      type: 'feeding',
      timestamp: 1,
      data: { method: 'breast', leftMin: 12 },
    }
    const picks = initialPicks('feeding', previous)
    expect(picks.method).toBe('breast')
    expect(picks.leftMin).toBe('12')
  })

  test('a number the presets do not offer is kept, not snapped to one', () => {
    const previous: PreviousEvent = {
      type: 'temperature',
      timestamp: 1,
      data: { celsius: 37.3, method: 'ear' },
    }
    expect(initialPicks('temperature', previous)).toEqual({
      celsius: '37.3',
      method: 'ear',
    })
  })

  test('a chip the row does not offer still falls back — there is nowhere else for it to go', () => {
    const previous: PreviousEvent = {
      type: 'diaper',
      timestamp: 1,
      data: { kind: 'explosive' },
    }
    expect(initialPicks('diaper', previous).kind).toBe('wet')
  })

  test('a sleep starts on the length of the last one, read off its end and not its payload', () => {
    const previous: PreviousEvent = {
      type: 'sleep',
      timestamp: 0,
      endTimestamp: 95 * 60_000,
      data: {},
    }
    expect(initialPicks('sleep', previous)).toEqual({
      durationH: '1',
      durationM: '35',
    })
  })
})

describe('a measurement field', () => {
  test('starts empty rather than repeating last time — a stale weight is a wrong measurement', () => {
    const previous = {
      type: 'growth' as const,
      timestamp: 1,
      data: { weightKg: 6.8 },
    }
    expect(initialPicks('growth', previous).weightKg).toBe('')
  })
})

describe('the stepper', () => {
  const celsius = SHEET_SPECS.temperature[0]

  test('moves by the field’s step without floating-point drift', () => {
    expect(stepValue(celsius, '37.0', 1)).toBe('37.1')
    expect(stepValue(celsius, '37.1', 1)).toBe('37.2')
    expect(stepValue(celsius, '37.0', -1)).toBe('36.9')
  })

  test('a typed value off the ladder snaps onto it rather than carrying the offset along', () => {
    expect(stepValue(celsius, '37.34', 1)).toBe('37.4')
  })

  test('stops at the field’s bounds', () => {
    expect(stepValue(celsius, '42.0', 1)).toBe('42')
    expect(stepValue(celsius, '34.0', -1)).toBe('34')
  })

  test('an empty box steps from the fallback, not from zero', () => {
    expect(stepValue(celsius, '', 1)).toBe('37.1')
  })
})

describe('reading a number out of a box somebody is still typing', () => {
  test('a comma is a decimal point — some keyboards only offer one of them', () => {
    expect(parseNumber('6,8')).toBe(6.8)
  })

  test('empty and nonsense are null, never zero', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('  ')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber(undefined)).toBeNull()
  })
})

describe('the payload', () => {
  test('numbers are numbers, not the box text', () => {
    expect(
      buildSheetData('temperature', { celsius: '37.2', method: 'ear' }),
    ).toEqual({ celsius: 37.2, method: 'ear' })
  })

  test('a breastfeed carries minutes and a side derived from them', () => {
    expect(
      buildSheetData('feeding', {
        method: 'breast',
        leftMin: '10',
        rightMin: '8',
        amountMl: '120',
      }),
    ).toEqual({ method: 'breast', side: 'both', leftMin: 10, rightMin: 8 })
  })

  test('one side only says so, and carries no millilitre figure nobody measured', () => {
    expect(
      buildSheetData('feeding', {
        method: 'breast',
        leftMin: '0',
        rightMin: '14',
      }),
    ).toEqual({ method: 'breast', side: 'right', rightMin: 14 })
  })

  test('a bottle carries millilitres', () => {
    expect(
      buildSheetData('feeding', { method: 'bottle', amountMl: '120' }),
    ).toEqual({ method: 'bottle', amountMl: 120 })
  })

  test('solid food carries grams, never millilitres', () => {
    expect(
      buildSheetData('feeding', {
        method: 'solid',
        amountG: '75',
        amountMl: '120',
      }),
    ).toEqual({ method: 'solid', amountG: 75 })
  })

  test('sleep carries an empty payload, matching the schema', () => {
    expect(buildSheetData('sleep', { durationH: '1', durationM: '0' })).toEqual(
      {},
    )
  })

  test('an unmeasured field is absent, never a zero', () => {
    expect(
      buildSheetData('growth', {
        weightKg: '6.8',
        heightCm: '',
        headCircumferenceCm: '  ',
      }),
    ).toEqual({ weightKg: 6.8 })
  })

  test('a medication with no dose is just its name', () => {
    expect(
      buildSheetData('medication', {
        name: ' Paracetamol ',
        doseAmount: '',
        doseUnit: '',
      }),
    ).toEqual({ name: 'Paracetamol' })
  })
})

describe('when a sleep ended', () => {
  test('the duration is added to the start, because that is where the schema keeps it', () => {
    expect(
      endTimestampFor('sleep', { durationH: '1', durationM: '30' }, 0),
    ).toBe(90 * 60_000)
  })

  test('no duration is unknown rather than zero-length — the tile must not add it up', () => {
    expect(
      endTimestampFor('sleep', { durationH: '0', durationM: '0' }, 1000),
    ).toBeUndefined()
  })

  test('nothing else has an end', () => {
    expect(endTimestampFor('feeding', {}, 1000)).toBeUndefined()
  })
})

describe('finding the last event of a type', () => {
  const events: PreviousEvent[] = [
    { type: 'feeding', timestamp: 10, data: { method: 'bottle' } },
    { type: 'feeding', timestamp: 30, data: { method: 'breast' } },
    { type: 'diaper', timestamp: 40, data: { kind: 'wet' } },
  ]

  test('the most recent one, not the last in the array', () => {
    expect(lastOfType(events, 'feeding')?.timestamp).toBe(30)
  })

  test('nothing logged is undefined, which the picks read as the fallback', () => {
    expect(lastOfType(events, 'growth')).toBeUndefined()
  })
})

describe('the box a type cannot save without', () => {
  test('a memory needs to say what happened', () => {
    expect(missingRequired('memory', {})).toBe('enterMemoryWhat')
    expect(missingRequired('memory', { what: '   ' })).toBe('enterMemoryWhat')
    expect(missingRequired('memory', { what: 'First laugh' })).toBeNull()
  })

  test('so do the two entries that are a name', () => {
    expect(missingRequired('medication', {})).toBe('enterMedicationName')
    expect(missingRequired('vaccination', {})).toBe('enterVaccineName')
  })

  test('every other type can be saved as it opens', () => {
    expect(missingRequired('diaper', { kind: 'wet' })).toBeNull()
    expect(missingRequired('sleep', {})).toBeNull()
    expect(missingRequired('note', {})).toBeNull()
  })
})

describe('a memory', () => {
  test('asks one question, and never inherits the last answer', () => {
    expect(SHEET_SPECS.memory.map((field) => field.key)).toEqual(['what'])
    expect(SHEET_SPECS.memory[0]?.blankStart).toBe(true)
    expect(
      initialPicks('memory', {
        type: 'memory',
        timestamp: 1,
        data: { what: 'First steps' },
      }),
    ).toEqual({ what: '' })
  })

  test('the payload is the trimmed sentence', () => {
    expect(buildSheetData('memory', { what: '  First laugh  ' })).toEqual({
      what: 'First laugh',
    })
  })
})
