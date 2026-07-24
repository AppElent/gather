import { describe, expect, test } from 'vitest'
import { isValidEventData } from './babyEvents'

describe('isValidEventData', () => {
  test('temperature requires a numeric celsius', () => {
    expect(isValidEventData('temperature', { celsius: 37.5 })).toBe(true)
    expect(isValidEventData('temperature', { celsius: 37.5, method: 'ear' })).toBe(
      true,
    )
    expect(isValidEventData('temperature', {})).toBe(false)
    expect(isValidEventData('temperature', { celsius: '37.5' })).toBe(false)
  })

  test('feeding requires a known method', () => {
    expect(isValidEventData('feeding', { method: 'breast' })).toBe(true)
    expect(isValidEventData('feeding', { method: 'bottle', amountMl: 120 })).toBe(
      true,
    )
    expect(isValidEventData('feeding', { method: 'formula' })).toBe(false)
    expect(isValidEventData('feeding', {})).toBe(false)
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
