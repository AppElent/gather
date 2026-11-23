/**
 * Energy usage and costs (APP-494): meter readings spread over days, and what
 * a day costs under the Group's contract. Pure and dependency-free
 * (ADR-0016), so Convex computes with it and both clients check with it.
 *
 * Days are the Group's calendar days in the Netherlands (ADR-0040): a day runs
 * from Amsterdam midnight to the next. A manual reading says nothing about the
 * hours in between, so its difference is spread over the days between two
 * readings in proportion to the time each day covers, and every such day
 * counts as estimated.
 *
 * Money comes out in cents, rounded once per day and per line, so a month is
 * the sum of its days to the cent. Tariffs go in as euros excl. VAT, as on the
 * contract (`designs/energy/APP-491-data-model.md`).
 */
import { addDays, daysInMonth, isIsoDate, parseIsoDate } from './civilDate'
import { parseDecimal } from './decimal'
import { roundCents } from './finance/money'

const HOUR_MS = 3_600_000

/**
 * The first day net metering (salderen) no longer applies. Before it a
 * contract's switch decides; from it every cost is without, and the screens
 * drop the choice.
 */
export const ENERGY_NET_METERING_ENDS = '2027-01-01'

// -- Days and months ----------------------------------------------------------

/** The moment an Amsterdam calendar day starts, in epoch milliseconds. */
export function amsterdamDayStart(day: string): number {
  const parts = parseIsoDate(day)
  if (!parts) throw new Error(`Not a day: ${day}`)
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day)
  // Midnight in Amsterdam is 22:00 or 23:00 UTC the day before, never near
  // the 01:00 UTC switch, so the offset of that hour decides.
  const winterGuess = utcMidnight - HOUR_MS
  return isEuSummerTime(winterGuess)
    ? utcMidnight - 2 * HOUR_MS
    : winterGuess
}

/** The Amsterdam calendar day a moment falls on. */
export function amsterdamDayOf(at: number): string {
  const offset = isEuSummerTime(at) ? 2 : 1
  return new Date(at + offset * HOUR_MS).toISOString().slice(0, 10)
}

function isEuSummerTime(at: number): boolean {
  const year = new Date(at).getUTCFullYear()
  return at >= lastSundayAtOneUtc(year, 3) && at < lastSundayAtOneUtc(year, 10)
}

function lastSundayAtOneUtc(year: number, month: number): number {
  const last = daysInMonth(year, month)
  const weekday = new Date(Date.UTC(year, month - 1, last)).getUTCDay()
  return Date.UTC(year, month - 1, last - weekday, 1)
}

/** `YYYY-MM`: a calendar month. */
export function isEnergyMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function energyMonthOf(day: string): string {
  return day.slice(0, 7)
}

/** Every day of a month, in order. */
export function energyMonthDays(month: string): string[] {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const count = daysInMonth(year, monthNumber)
  return Array.from({ length: count }, (_, index) =>
    addDays(`${month}-01`, index),
  )
}

/** The month `amount` months from `month` (negative goes back). */
export function addEnergyMonths(month: string, amount: number): string {
  const index =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + amount
  const year = Math.floor(index / 12)
  const monthNumber = (index % 12) + 1
  return `${year}-${String(monthNumber).padStart(2, '0')}`
}

/** The twelve months of a year. */
export function energyYearMonths(year: number): string[] {
  return Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`,
  )
}

/** The hours of an Amsterdam day: 23, 24 or 25 of them. */
export function amsterdamDayHours(day: string): number[] {
  const start = amsterdamDayStart(day)
  const end = amsterdamDayStart(addDays(day, 1))
  const hours: number[] = []
  for (let at = start; at < end; at += HOUR_MS) hours.push(at)
  return hours
}

/**
 * Whether a month can still be shown with net metering: only before
 * {@link ENERGY_NET_METERING_ENDS}. From 2027 the choice disappears.
 */
export function netMeteringPossibleIn(month: string): boolean {
  return `${month}-01` < ENERGY_NET_METERING_ENDS
}

/** Whether a contract nets export against import on `day`. */
export function netMeteringOn(
  contract: { netMetering: boolean },
  day: string,
): boolean {
  return contract.netMetering && day < ENERGY_NET_METERING_ENDS
}

// -- Meter readings -------------------------------------------------------------

/**
 * A meter reading as somebody typed it. Both `24219,8` and `24219.8` read as
 * the decimal mark, and so does the last mark of `24.219,8` or `24,219.8`;
 * the others are thousands separators.
 */
export function parseMeterReading(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, '')
  if (!trimmed) return null
  const lastComma = trimmed.lastIndexOf(',')
  const lastDot = trimmed.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalMark = lastComma > lastDot ? ',' : '.'
    const thousands = decimalMark === ',' ? /\./g : /,/g
    return parseDecimal(trimmed.replace(thousands, ''))
  }
  return parseDecimal(trimmed)
}

export type EnergyReadingProblem =
  | 'notANumber'
  | 'negative'
  | 'lowerThanPrevious'
  | 'higherThanNext'

/**
 * Why a reading cannot be saved, or null. A meter counts up: a reading lower
 * than the one before it on the same channel is a new meter, which is a new
 * channel, not a correction. One higher than a later reading would make that
 * later stretch negative.
 */
export function checkEnergyReading(
  value: number | null,
  neighbours: { previous?: number; next?: number } = {},
): EnergyReadingProblem | null {
  if (value === null || !Number.isFinite(value)) return 'notANumber'
  if (value < 0) return 'negative'
  if (neighbours.previous !== undefined && value < neighbours.previous) {
    return 'lowerThanPrevious'
  }
  if (neighbours.next !== undefined && value > neighbours.next) {
    return 'higherThanNext'
  }
  return null
}

/**
 * When a reading typed for `day` was taken: now, when the day is today, and
 * otherwise noon that day. A day after today has no moment yet.
 */
export function energyReadingMoment(day: string, now: number): number | null {
  if (!isIsoDate(day)) return null
  const today = amsterdamDayOf(now)
  if (day > today) return null
  if (day === today) return now
  return amsterdamDayStart(day) + 12 * HOUR_MS
}

export interface EnergyReadingPoint {
  at: number
  value: number
}

/**
 * Spread cumulative readings over days. Each stretch between two readings is
 * divided in proportion to how much of it each day covers. A day no stretch
 * touches has no figure (`null`), never zero: before the first reading and
 * after the last one nothing is known.
 */
export function spreadReadingsOverDays(
  readings: readonly EnergyReadingPoint[],
  days: readonly string[],
): (number | null)[] {
  const sorted = [...readings].sort((a, b) => a.at - b.at)
  return days.map((day) => {
    const start = amsterdamDayStart(day)
    const end = amsterdamDayStart(addDays(day, 1))
    let amount: number | null = null
    for (let index = 1; index < sorted.length; index++) {
      const from = sorted[index - 1] as EnergyReadingPoint
      const to = sorted[index] as EnergyReadingPoint
      const overlap = Math.min(end, to.at) - Math.max(start, from.at)
      if (overlap <= 0 || to.at <= from.at) continue
      amount =
        (amount ?? 0) + ((to.value - from.value) * overlap) / (to.at - from.at)
    }
    return amount
  })
}

// -- Contracts and costs --------------------------------------------------------

export interface EnergyContractTerms {
  validFrom: string
  kind: 'dynamic' | 'fixed'
  supplierName?: string
  importMarkupEurPerKwh: number
  exportFeeEurPerKwh: number
  energyTaxEurPerKwh: number
  gasMarkupEurPerM3?: number
  gasTaxEurPerM3?: number
  fixedTariffs?: { t1: number; t2: number; export: number; gas: number }
  vatPercent: number
  monthlyFixedCents: number
  yearlyTaxCreditCents?: number
  netMetering: boolean
}

/** The contract that applies on `day`: the latest that started on or before it. */
export function energyContractOn<T extends { validFrom: string }>(
  contracts: readonly T[],
  day: string,
): T | undefined {
  let found: T | undefined
  for (const contract of contracts) {
    if (contract.validFrom > day) continue
    if (!found || contract.validFrom > found.validFrom) found = contract
  }
  return found
}

export type EnergyContractProblem = 'invalidDate' | 'invalidAmount' | 'needsTariffs'

/** Why a contract cannot be saved, or null. */
export function checkEnergyContract(
  terms: EnergyContractTerms,
): EnergyContractProblem | null {
  if (!isIsoDate(terms.validFrom)) return 'invalidDate'
  if (terms.kind === 'fixed' && !terms.fixedTariffs) return 'needsTariffs'
  const amounts = [
    terms.importMarkupEurPerKwh,
    terms.exportFeeEurPerKwh,
    terms.energyTaxEurPerKwh,
    terms.gasMarkupEurPerM3,
    terms.gasTaxEurPerM3,
    terms.monthlyFixedCents,
    terms.yearlyTaxCreditCents,
    ...(terms.fixedTariffs ? Object.values(terms.fixedTariffs) : []),
  ]
  if (amounts.some((value) => value !== undefined && !Number.isFinite(value))) {
    return 'invalidAmount'
  }
  const nonNegative = [
    terms.energyTaxEurPerKwh,
    terms.gasTaxEurPerM3,
    terms.monthlyFixedCents,
    terms.yearlyTaxCreditCents,
  ]
  if (nonNegative.some((value) => value !== undefined && value < 0)) {
    return 'invalidAmount'
  }
  if (
    !Number.isFinite(terms.vatPercent) ||
    terms.vatPercent < 0 ||
    terms.vatPercent > 100
  ) {
    return 'invalidAmount'
  }
  return null
}

/** Kilowatt-hours split by tariff; `single` is a meter without a split. */
export interface EnergyByTariff {
  t1: number
  t2: number
  single: number
}

export function totalByTariff(amounts: EnergyByTariff): number {
  return amounts.t1 + amounts.t2 + amounts.single
}

/** What one day used, and the prices it was used at. */
export interface EnergyDayUse {
  day: string
  importKwh: EnergyByTariff
  exportKwh: EnergyByTariff
  /** Null when the site measures no gas. */
  gasM3: number | null
  /**
   * Per hour, for a source with hourly data: kWh and that hour's market
   * price excl. tax (null when the price is not in yet).
   */
  hours?: readonly {
    importKwh: number
    exportKwh: number
    marketEurPerKwh: number | null
  }[]
  /** The day's average market price, for a day without hours. */
  marketEurPerKwh: number | null
  gasMarketEurPerM3: number | null
  /** Account prices that already include the markup, taxes and VAT. */
  allInPrices?: boolean
}

/** A day's or a month's costs in cents, VAT included. Credits are negative. */
export interface EnergyCost {
  importCents: number
  exportCents: number
  gasCents: number
  fixedCents: number
  creditCents: number
  totalCents: number
}

export const ZERO_ENERGY_COST: EnergyCost = {
  importCents: 0,
  exportCents: 0,
  gasCents: 0,
  fixedCents: 0,
  creditCents: 0,
  totalCents: 0,
}

export function addEnergyCosts(a: EnergyCost, b: EnergyCost): EnergyCost {
  return {
    importCents: a.importCents + b.importCents,
    exportCents: a.exportCents + b.exportCents,
    gasCents: a.gasCents + b.gasCents,
    fixedCents: a.fixedCents + b.fixedCents,
    creditCents: a.creditCents + b.creditCents,
    totalCents: a.totalCents + b.totalCents,
  }
}

/**
 * What a day costs under `contract`, or null when a price it needs is not in
 * yet (a dynamic contract before its prices arrive). Never a guess.
 *
 * - Import: a fixed contract's tariff (T1, T2; a meter without a split pays
 *   T2), or a dynamic contract's market price plus markup, plus energy tax,
 *   all plus VAT. Hourly data is priced hour by hour.
 * - Export with net metering: the kWh up to that day's import are netted at
 *   the import price, the rest earn the export price. Without: all of it
 *   earns the export price (a fixed tariff, or market price plus the
 *   contract's export fee), excl. VAT.
 * - Gas: tariff or market price plus markup, plus gas tax, plus VAT.
 * - Fixed costs per day are the month's share, the tax credit the year's,
 *   both plus VAT.
 */
export function energyDayCost(
  use: EnergyDayUse,
  contract: EnergyContractTerms,
  options: { netMetering: boolean },
): EnergyCost | null {
  const vat = 1 + contract.vatPercent / 100
  const importTotal = totalByTariff(use.importKwh)
  const exportTotal = totalByTariff(use.exportKwh)

  let importEur: number
  let exportEurPerKwh: number
  if (contract.kind === 'fixed') {
    const tariffs = contract.fixedTariffs
    if (!tariffs) return null
    const tax = contract.energyTaxEurPerKwh
    importEur =
      (use.importKwh.t1 * (tariffs.t1 + tax) +
        (use.importKwh.t2 + use.importKwh.single) * (tariffs.t2 + tax)) *
      vat
    exportEurPerKwh = tariffs.export
  } else {
    const allIn = (market: number) =>
      use.allInPrices
        ? market
        : (market + contract.importMarkupEurPerKwh + contract.energyTaxEurPerKwh) *
          vat
    const priced = use.hours ?? [
      {
        importKwh: importTotal,
        exportKwh: exportTotal,
        marketEurPerKwh: use.marketEurPerKwh,
      },
    ]
    importEur = 0
    let exportValue = 0
    for (const hour of priced) {
      if (hour.importKwh === 0 && hour.exportKwh === 0) continue
      if (hour.marketEurPerKwh === null) return null
      importEur += hour.importKwh * allIn(hour.marketEurPerKwh)
      exportValue +=
        hour.exportKwh * (hour.marketEurPerKwh + contract.exportFeeEurPerKwh)
    }
    exportEurPerKwh = exportTotal > 0 ? exportValue / exportTotal : 0
  }

  let exportEur: number
  if (options.netMetering && importTotal > 0) {
    const netted = Math.min(importTotal, exportTotal)
    const importPrice = importEur / importTotal
    exportEur = netted * importPrice + (exportTotal - netted) * exportEurPerKwh
  } else {
    exportEur = exportTotal * exportEurPerKwh
  }

  let gasEur = 0
  if (use.gasM3 !== null && use.gasM3 !== 0) {
    const gasTax = contract.gasTaxEurPerM3 ?? 0
    if (contract.kind === 'fixed') {
      gasEur = use.gasM3 * ((contract.fixedTariffs?.gas ?? 0) + gasTax) * vat
    } else {
      if (use.gasMarketEurPerM3 === null) return null
      gasEur = use.allInPrices
        ? use.gasM3 * use.gasMarketEurPerM3
        : use.gasM3 *
          (use.gasMarketEurPerM3 + (contract.gasMarkupEurPerM3 ?? 0) + gasTax) *
          vat
    }
  }

  const parts = parseIsoDate(use.day)
  if (!parts) return null
  const daysThisMonth = daysInMonth(parts.year, parts.month)
  const daysThisYear = parts.year % 4 === 0 && (parts.year % 100 !== 0 || parts.year % 400 === 0) ? 366 : 365
  const fixedCents = roundCents((contract.monthlyFixedCents / daysThisMonth) * vat)
  const creditCents = -roundCents(
    ((contract.yearlyTaxCreditCents ?? 0) / daysThisYear) * vat,
  )

  const importCents = roundCents(importEur * 100)
  const exportCents = -roundCents(exportEur * 100)
  const gasCents = roundCents(gasEur * 100)
  return {
    importCents,
    exportCents,
    gasCents,
    fixedCents,
    creditCents,
    totalCents: importCents + exportCents + gasCents + fixedCents + creditCents,
  }
}

/** A month's expected total from the days so far, or null with none. */
export function forecastMonthCents(
  totalCents: number,
  daysWithData: number,
  month: string,
): number | null {
  if (daysWithData <= 0) return null
  const days = energyMonthDays(month).length
  return Math.round((totalCents / daysWithData) * days)
}
