import { describe, expect, test } from 'vitest'
import {
  checkEnergyAsset,
  type EnergyPaybackAsset,
  type EnergyPaybackDay,
  type EnergySolarHour,
  energyAssetFromText,
  energyBatteryModes,
  energyHourImportPrice,
  energyModeRuns,
  energyMonthToday,
  energyPayback,
  energyPaybackMonths,
  energySolarDay,
  energySolarTotals,
} from './energySolar'
import { energyBatteryStrip } from './energySolarPresent'
import type { EnergyContractTerms } from './energyUsage'
import { en } from './messages/en'
import { nl } from './messages/nl'

const hour = (changes: Partial<EnergySolarHour> = {}): EnergySolarHour => ({
  importKwh: 0,
  exportKwh: 0,
  solarKwh: 0,
  chargeKwh: null,
  dischargeKwh: null,
  importPrice: 0.3,
  ...changes,
})

describe('a day', () => {
  test('self-use is what was generated and not sent back in that hour', () => {
    const day = energySolarDay('2026-11-20', [
      hour({ solarKwh: 3, exportKwh: 1 }), // used 2
      hour({ importKwh: 4 }), // evening
    ])
    expect(day).toMatchObject({
      producedKwh: 3,
      selfUsedKwh: 2,
      returnedKwh: 1,
      consumptionKwh: 6,
      ownKwh: 2,
    })
    expect(day.selfUsedEur).toBeCloseTo(0.6)
    const totals = energySolarTotals([day])
    expect(totals.selfUsedPercent).toBeCloseTo(66.67, 1)
    expect(totals.selfSufficiency).toBeCloseTo(33.33, 1)
  })

  test('power a battery sends back is not the roof’s', () => {
    const day = energySolarDay('2026-11-20', [
      hour({ solarKwh: 1, exportKwh: 3, dischargeKwh: 2 }),
    ])
    expect(day).toMatchObject({ selfUsedKwh: 0, returnedKwh: 1 })
  })

  test('what charged the battery counts as self-used, and as use when it comes out', () => {
    const day = energySolarDay('2026-11-20', [
      hour({ solarKwh: 3, chargeKwh: 3, dischargeKwh: 0 }),
      hour({ chargeKwh: 0, dischargeKwh: 2 }),
    ])
    expect(day).toMatchObject({ selfUsedKwh: 3, consumptionKwh: 2, ownKwh: 2 })
  })

  test('without a grid meter in the hours, only what was generated is known', () => {
    const day = energySolarDay('2026-11-20', [
      hour({ solarKwh: 3, exportKwh: null }),
    ])
    expect(day).toMatchObject({
      producedKwh: 3,
      selfUsedKwh: null,
      ownKwh: null,
    })
    expect(energySolarTotals([day])).toMatchObject({
      producedKwh: 3,
      selfUsedKwh: null,
      selfSufficiency: null,
    })
  })

  test('a battery is worth what it discharged minus what it charged, hour by hour', () => {
    const day = energySolarDay('2026-11-20', [
      hour({ chargeKwh: 4, dischargeKwh: 0, importPrice: 0.2 }),
      hour({ chargeKwh: 0, dischargeKwh: 3, importPrice: 0.4 }),
      hour({ chargeKwh: 0, dischargeKwh: 0, importPrice: null }), // idle
    ])
    const { battery } = energySolarTotals([day])
    expect(battery?.chargePrice).toBeCloseTo(0.2)
    expect(battery?.dischargePrice).toBeCloseTo(0.4)
    expect(battery?.valueEur).toBeCloseTo(0.4)
  })

  test('a day with an hour without a price has no value and is named', () => {
    const known = energySolarDay('2026-11-20', [
      hour({ chargeKwh: 1, dischargeKwh: 2 }),
    ])
    const unknown = energySolarDay('2026-11-21', [
      hour({ chargeKwh: 1, dischargeKwh: 0, importPrice: null }),
    ])
    expect(unknown.battery?.chargeEur).toBeNull()
    expect(energySolarTotals([known, unknown]).battery).toMatchObject({
      chargeKwh: 2,
      valueEur: 0.3,
      unpricedDays: 1,
    })
    expect(energySolarTotals([unknown]).battery?.valueEur).toBeNull()
  })
})

describe('the price of an hour', () => {
  const fixed: EnergyContractTerms = {
    kind: 'fixed',
    validFrom: '2026-01-01',
    importMarkupEurPerKwh: 0,
    exportFeeEurPerKwh: 0,
    energyTaxEurPerKwh: 0.1,
    fixedTariffs: { t1: 0.2, t2: 0.3, export: 0, gas: 0 },
    vatPercent: 20,
    monthlyFixedCents: 0,
    netMetering: false,
  }
  test('fixed, per tariff, with tax and VAT', () => {
    const price = { marketEurPerKwh: 9 }
    expect(energyHourImportPrice(fixed, price, 't1')).toBeCloseTo(0.36)
    expect(energyHourImportPrice(fixed, price, 't2')).toBeCloseTo(0.48)
  })
  test('dynamic, from the market or the account, or not known', () => {
    const dynamic: EnergyContractTerms = { ...fixed, kind: 'dynamic' }
    expect(
      energyHourImportPrice(dynamic, { marketEurPerKwh: 0.1 }, 't2'),
    ).toBeCloseTo(0.24)
    expect(
      energyHourImportPrice(
        dynamic,
        { marketEurPerKwh: 0.1, allInEurPerKwh: 0.5 },
        't2',
      ),
    ).toBe(0.5)
    expect(
      energyHourImportPrice(dynamic, { marketEurPerKwh: null }, 't2'),
    ).toBeNull()
    expect(
      energyHourImportPrice(undefined, { marketEurPerKwh: 0.1 }, 't2'),
    ).toBeNull()
  })
})

describe('payback', () => {
  const day = (
    date: string,
    changes: Partial<EnergyPaybackDay> = {},
  ): EnergyPaybackDay => ({
    day: date,
    solarEur: 2,
    batteryEur: 1,
    solarMeasured: true,
    batteryMeasured: true,
    ...changes,
  })
  const roof: EnergyPaybackAsset = {
    kind: 'solar',
    peakWatt: 3000,
    installedOn: '2026-01-01',
    purchaseCents: 100_000,
  }

  test('adds up its own kind from the day it was installed', () => {
    expect(
      energyPayback({ ...roof, installedOn: '2026-01-02' }, [roof], [
        day('2026-01-01'),
        day('2026-01-02'),
        day('2026-01-03', { solarEur: null }),
        day('2026-01-04', { solarMeasured: false, solarEur: null }),
      ]),
    ).toEqual({
      earnedCents: 200,
      purchaseCents: 100_000,
      since: '2026-01-02',
      missingDays: 1,
    })
  })

  test('two of a kind share by size, from when the second is there', () => {
    const second = { ...roof, peakWatt: 1000, installedOn: '2026-01-02' }
    const days = [day('2026-01-01'), day('2026-01-02')]
    const all = [roof, second]
    expect(energyPayback(roof, all, days)?.earnedCents).toBe(350)
    expect(energyPayback(second, all, days)?.earnedCents).toBe(50)
    const unsized = [roof, { ...second, peakWatt: undefined }]
    expect(energyPayback(roof, unsized, days)?.earnedCents).toBe(300)
  })

  test('without a price or a day there is nothing to say', () => {
    expect(
      energyPayback({ ...roof, purchaseCents: undefined }, [roof], [
        day('2026-01-01'),
      ]),
    ).toBeNull()
    expect(energyPayback(roof, [roof], [])).toBeNull()
  })

  test('asks only for months that can count', () => {
    expect(energyPaybackMonths([roof], '2026-09-15', '2026-11-20')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ])
    expect(
      energyPaybackMonths(
        [{ ...roof, installedOn: '2026-11-02' }],
        '2026-01-15',
        '2026-11-20',
      ),
    ).toEqual(['2026-11'])
    expect(
      energyPaybackMonths(
        [{ ...roof, purchaseCents: undefined }],
        '2026-01-15',
        '2026-11-20',
      ),
    ).toEqual([])
    expect(energyMonthToday('2026-10', '2026-11-20')).toBe('2026-10-31')
    expect(energyMonthToday('2026-11', '2026-11-20')).toBe('2026-11-20')
  })
})

test('the strip: charging, discharging, idle, unknown and still to come', () => {
  const at = (
    hourStart: number,
    batteryChargeKwh: number | null,
    batteryDischargeKwh: number | null,
  ) => ({ hourStart, batteryChargeKwh, batteryDischargeKwh })
  const modes = energyBatteryModes(
    [at(0, 1, 0), at(1, 0, 1), at(2, 0.01, 0.02), at(3, null, null), at(9, 1, 0)],
    5,
  )
  expect(modes).toEqual([
    'charging',
    'discharging',
    'idle',
    'unknown',
    'future',
  ])
  expect(
    energyModeRuns(['idle', 'charging', 'charging', 'idle', 'charging'], 'charging'),
  ).toEqual([
    { from: 1, to: 3 },
    { from: 4, to: 5 },
  ])
})

describe('an asset', () => {
  const asset = { kind: 'solar', name: ' Dak ', peakWatt: 4200 } as const
  test('is trimmed, and keeps only its own kind’s size', () => {
    expect(
      checkEnergyAsset({ ...asset, capacityKwh: 10 }, '2026-11-20'),
    ).toEqual({
      asset: {
        kind: 'solar',
        name: 'Dak',
        peakWatt: 4200,
        capacityKwh: undefined,
        installedOn: undefined,
        purchaseCents: undefined,
      },
    })
  })
  test.each([
    [{ name: ' ' }, 'assetNeedsName'],
    [{ name: 'x'.repeat(41) }, 'tooLong'],
    [{ peakWatt: 0 }, 'assetInvalid'],
    [{ peakWatt: Number.NaN }, 'assetInvalid'],
    [{ purchaseCents: -1 }, 'assetInvalid'],
    [{ purchaseCents: 0.2 }, 'assetInvalid'],
    [{ installedOn: 'soon' }, 'assetInvalid'],
    [{ installedOn: '2026-11-21' }, 'assetInFuture'],
  ])('refuses %o', (changes, problem) => {
    expect(checkEnergyAsset({ ...asset, ...changes }, '2026-11-20')).toEqual({
      problem,
    })
  })
})

describe('an asset as typed', () => {
  const blank = {
    kind: 'solar' as const,
    name: 'Dak',
    peakWatt: '',
    capacityKwh: '',
    installedOn: null,
    purchaseEur: '',
  }
  test('three digits after the mark are a thousand in watts and euros', () => {
    expect(
      energyAssetFromText({ ...blank, peakWatt: '4.200', purchaseEur: '5,200' }),
    ).toMatchObject({ peakWatt: 4200, purchaseCents: 520_000 })
    expect(
      energyAssetFromText({ ...blank, purchaseEur: '5.200,50' }).purchaseCents,
    ).toBeCloseTo(520_050)
  })
  test('a capacity keeps its fraction', () => {
    expect(
      energyAssetFromText({ ...blank, kind: 'battery', capacityKwh: '5,120' }),
    ).toMatchObject({ capacityKwh: 5.12, peakWatt: undefined })
  })
  test('blank is left out, and words are refused', () => {
    expect(energyAssetFromText(blank)).toMatchObject({
      peakWatt: undefined,
      purchaseCents: undefined,
      installedOn: undefined,
    })
    expect(
      checkEnergyAsset(
        energyAssetFromText({ ...blank, peakWatt: 'veel' }),
        '2026-11-20',
      ),
    ).toEqual({ problem: 'assetInvalid' })
  })
})

test('the strip says two stretches without Intl.ListFormat, which Hermes lacks', () => {
  const listFormat = Object.getOwnPropertyDescriptor(Intl, 'ListFormat')
  Object.defineProperty(Intl, 'ListFormat', { value: undefined, configurable: true })
  try {
    const start = Date.UTC(2026, 10, 24, 23)
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hourStart: start + hour * 3_600_000,
      solarKwh: 0,
      batteryChargeKwh: [2, 3, 9, 10].includes(hour) ? 1 : 0,
      batteryDischargeKwh: hour === 18 ? 1 : 0,
      socPercent: 50,
    }))
    const sentence = (words: typeof en.energy, locale: string) =>
      energyBatteryStrip(hours, start + 24 * 3_600_000, words, locale)?.sentence
    expect(sentence(nl.energy, 'nl-NL')).toContain('02:00–04:00 en 09:00–11:00')
    expect(sentence(en.energy, 'en-GB')).toContain(' and ')
  } finally {
    if (listFormat) Object.defineProperty(Intl, 'ListFormat', listFormat)
  }
})
