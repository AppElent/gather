import { describe, expect, test } from 'vitest'
import {
  compareYears,
  energyHomeHasProblem,
  energyHomeSources,
  signedDifference,
} from './energyPresent'

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

describe('energyHomeSources', () => {
  const ha = (over: object = {}) => ({
    kind: 'homeAssistant',
    status: 'ok' as const,
    ...over,
  })
  const manual = { kind: 'manual', status: 'ok' as const }
  const gone = ha({ status: 'needsReconnect', lastError: 'disconnected' })

  test('typed meters are named beside Home Assistant only while there are some', () => {
    expect(energyHomeSources([ha(), manual], 0)).toEqual([ha()])
    expect(energyHomeSources([ha(), manual], 2)).toEqual([ha(), manual])
    expect(energyHomeSources([manual], 0)).toEqual([manual])
  })

  test('a disconnected source gives way to typed meters', () => {
    expect(energyHomeSources([gone, manual], 2)).toEqual([manual])
    expect(energyHomeSources([gone], 0)).toEqual([gone])
  })

  test('a refused token is a problem, a first sync is not', () => {
    expect(energyHomeHasProblem([ha({ status: 'needsReconnect' })])).toBe(true)
    expect(energyHomeHasProblem([ha({ status: 'syncing' })])).toBe(false)
  })
})
