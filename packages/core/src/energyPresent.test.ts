import { describe, expect, test } from 'vitest'
import { compareYears, signedDifference } from './energyPresent'

const kwh = (size: number) => `${size.toFixed(0)} kWh`

describe('signedDifference', () => {
  test('says more or less with a sign', () => {
    expect(signedDifference(12.4, kwh)).toBe('+12 kWh')
    expect(signedDifference(-3, kwh)).toBe('−3 kWh')
  })

  test('a difference that rounds to nothing has no sign', () => {
    // Twelve months summed in two orders differ by float noise.
    const months = [0.1, 0.2, 0.3, 310.7, 280.2, 199.9]
    const compared = compareYears(
      [...months, ...months],
      [...months].reverse().concat([...months].reverse()),
      null,
    )
    expect(signedDifference(compared?.difference ?? 1, kwh)).toBe('0 kWh')
    expect(signedDifference(-0.2, kwh)).toBe('0 kWh')
  })
})
