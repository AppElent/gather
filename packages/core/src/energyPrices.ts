/**
 * Energy prices (APP-493): what a provider's answer says, and what its prices
 * mean under the Group's contract. Pure and dependency-free (ADR-0016): the
 * network is in `convex/energyPriceFetch.ts`, and nothing here reads a clock.
 *
 * A market price is in euros excl. VAT and taxes, per quarter of an hour for
 * electricity and per gas day for gas. An account price (Tibber) is what the
 * Member pays, everything included.
 */
import { addDays } from './civilDate'
import {
  amsterdamDayHours,
  amsterdamDayOf,
  amsterdamDayStart,
  type EnergyContractTerms,
} from './energyUsage'

const HOUR_MS = 3_600_000
const QUARTER_MS = 900_000
const GAS_DAY_STARTS_AT_HOUR = 6

// -- Providers --------------------------------------------------------------------

export const ENERGY_PRICE_PROVIDERS = ['energyzero', 'entsoe', 'tibber'] as const
export type EnergyPriceProvider = (typeof ENERGY_PRICE_PROVIDERS)[number]

/** The source of a site that never chose one, and of gas for every site. */
export const DEFAULT_ENERGY_PRICE_PROVIDER = 'energyzero' satisfies EnergyPriceProvider

/** Brands, so the same in every language. */
export const ENERGY_PRICE_PROVIDER_NAMES: Record<EnergyPriceProvider, string> = {
  energyzero: 'EnergyZero',
  entsoe: 'ENTSO-E',
  tibber: 'Tibber',
}

export function readEnergyPriceProvider(value: string): EnergyPriceProvider | null {
  return ENERGY_PRICE_PROVIDERS.find((each) => each === value) ?? null
}

export function energyPriceNeedsKey(provider: EnergyPriceProvider): boolean {
  return provider !== 'energyzero'
}

/**
 * `market` prices are the same for every Group and stored once. `account`
 * prices are one Member's own and stored per feed.
 */
export function energyPriceScope(
  provider: EnergyPriceProvider,
): 'market' | 'account' {
  return provider === 'tibber' ? 'account' : 'market'
}

export const ENERGY_PRICE_KEY_LIMIT = 500

/** A key as it is stored, or null when it cannot be one. */
export function checkEnergyPriceKey(key: string): string | null {
  const trimmed = key.trim()
  // Printable ASCII only: it goes into a header or a web address.
  return /^[\x21-\x7e]+$/.test(trimmed) && trimmed.length <= ENERGY_PRICE_KEY_LIMIT
    ? trimmed
    : null
}

/** Why a feed has no new prices. Stored as a code; clients put it in words. */
export const ENERGY_PRICE_PROBLEMS = [
  /** The provider does not answer, or not in time. */
  'unreachable',
  /** It answers something that is not a full day of prices. */
  'badAnswer',
  /** It refuses the key. */
  'keyRejected',
  /** The key works, but there is no contract behind it. */
  'noSubscription',
  /** Prices that should be out by now are not. */
  'late',
] as const
export type EnergyPriceProblem = (typeof ENERGY_PRICE_PROBLEMS)[number]

/** Reads a stored `lastError`; an unknown value reads as `unreachable`. */
export function readEnergyPriceProblem(
  stored: string | undefined,
): EnergyPriceProblem | null {
  if (!stored) return null
  return ENERGY_PRICE_PROBLEMS.find((each) => each === stored) ?? 'unreachable'
}

/** Tomorrow's prices are expected from here on, in Amsterdam time. */
export const ENERGY_PRICES_EXPECTED = { hour: 13, minute: 30 } as const
/** From this Amsterdam hour on, tomorrow's missing prices are a problem. */
const ENERGY_PRICES_LATE_HOUR = 15

/** Whether tomorrow's prices should be in at `now`. */
export function energyTomorrowDue(now: number): boolean {
  const next = amsterdamDayStart(addDays(amsterdamDayOf(now), 1))
  return now >= next - (24 - ENERGY_PRICES_LATE_HOUR) * HOUR_MS
}

// -- Whole days -------------------------------------------------------------------

export interface EnergyPriceSlot {
  start: number
  minutes: number
  eurPerUnit: number
}

/** A price nobody has ever paid: the answer is in another unit, or wrong. */
const MAX_EUR_PER_UNIT = 100

const plausible = (value: number) =>
  Number.isFinite(value) && Math.abs(value) <= MAX_EUR_PER_UNIT

/** How many quarters an Amsterdam day has: 96, or 92 or 100 on a DST day. */
export function energyDayQuarters(day: string): number {
  return amsterdamDayHours(day).length * 4
}

/**
 * The day's quarter-hour prices in order, or null unless every quarter is
 * there exactly once. Half a day is never stored.
 */
export function completeElectricityDay(
  day: string,
  slots: readonly EnergyPriceSlot[],
): EnergyPriceSlot[] | null {
  const start = amsterdamDayStart(day)
  const end = amsterdamDayStart(addDays(day, 1))
  const own = slots
    .filter((slot) => slot.start >= start && slot.start < end)
    .sort((a, b) => a.start - b.start)
  if (own.length !== energyDayQuarters(day)) return null
  const whole = own.every(
    (slot, index) =>
      slot.start === start + index * QUARTER_MS &&
      slot.minutes === 15 &&
      plausible(slot.eurPerUnit),
  )
  return whole ? own : null
}

/** When the gas day that starts on `day` starts: 06:00 in Amsterdam. */
export function gasDayStart(day: string): number {
  const next = amsterdamDayStart(addDays(day, 1))
  return next - (24 - GAS_DAY_STARTS_AT_HOUR) * HOUR_MS
}

/** The day's one gas price, or null when it is not there. */
export function completeGasDay(
  day: string,
  slots: readonly EnergyPriceSlot[],
): EnergyPriceSlot[] | null {
  const start = gasDayStart(day)
  const minutes = (gasDayStart(addDays(day, 1)) - start) / 60_000
  const own = slots.filter((slot) => amsterdamDayOf(slot.start) === day)
  const [price] = own
  if (own.length !== 1 || !price) return null
  return price.start === start &&
    price.minutes === minutes &&
    plausible(price.eurPerUnit)
    ? [price]
    : null
}

// -- What a provider answers ------------------------------------------------------

/** An answer that is not what the provider documents. */
export class EnergyPriceAnswerError extends Error {
  constructor(readonly problem: EnergyPriceProblem) {
    super(problem)
  }
}

const badAnswer = () => new EnergyPriceAnswerError('badAnswer')

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const decimalOf = (value: unknown): number => {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN
  if (!plausible(amount)) throw badAnswer()
  return amount
}

/** A moment with its zone; one without would be read in the server's own. */
const momentOf = (value: unknown): number => {
  const at =
    typeof value === 'string' && /(Z|[+-]\d{2}:?\d{2})$/.test(value)
      ? Date.parse(value)
      : Number.NaN
  if (!Number.isFinite(at)) throw badAnswer()
  return at
}

/**
 * EnergyZero's public prices: `base` is the market price excl. VAT. One
 * answer holds the days around the one asked for too.
 */
export function readEnergyZeroPrices(answer: unknown): EnergyPriceSlot[] {
  const rows = record(answer)?.base
  if (!Array.isArray(rows)) throw badAnswer()
  return rows.map((row) => {
    const start = momentOf(record(row)?.start)
    const end = momentOf(record(row)?.end)
    return {
      start,
      minutes: (end - start) / 60_000,
      eurPerUnit: decimalOf(record(record(row)?.price)?.value),
    }
  })
}

const tag = (xml: string, name: string): string | null => {
  const found = new RegExp(
    `<(?:\\w+:)?${name}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${name}>`,
  ).exec(xml)
  return found?.[1]?.trim() ?? null
}

function blocks(xml: string, name: string): string[] {
  // Split, not a lazy match across the document: linear whatever it holds.
  return xml
    .split(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>`))
    .slice(1)
    .map((part) => part.split(new RegExp(`</(?:\\w+:)?${name}>`))[0] ?? '')
}

/**
 * ENTSO-E's A44 document: euros per MWh per quarter. A curve of type A03
 * leaves out a quarter that repeats the one before it. Null while the day is
 * not published.
 */
export function readEntsoePrices(xml: string): EnergyPriceSlot[] | null {
  if (/<(?:\w+:)?Acknowledgement_MarketDocument[\s>]/.test(xml)) {
    if (/no matching data/i.test(xml)) return null
    throw badAnswer()
  }
  if (!/<(?:\w+:)?Publication_MarketDocument[\s>]/.test(xml)) throw badAnswer()
  // The same quarter can be in two series (two auctions); the first auction
  // is the day-ahead price everyone is billed at.
  const found = new Map<number, { sequence: number; eurPerUnit: number }>()
  for (const series of blocks(xml, 'TimeSeries')) {
    const currency = tag(series, 'currency_Unit.name')
    const unit = tag(series, 'price_Measure_Unit.name')
    if (currency !== 'EUR' || unit !== 'MWH') throw badAnswer()
    const sequence = Number(
      tag(series, 'classificationSequence_AttributeInstanceComponent.position') ??
        '1',
    )
    const repeats = tag(series, 'curveType') === 'A03'
    for (const period of blocks(series, 'Period')) {
      if (tag(period, 'resolution') !== 'PT15M') continue
      const start = momentOf(tag(period, 'start'))
      const end = momentOf(tag(period, 'end'))
      const count = (end - start) / QUARTER_MS
      // A year of quarters at most: the count sizes a loop.
      if (!Number.isInteger(count) || count < 1 || count > 40_000) throw badAnswer()
      const points = new Map<number, number>()
      for (const point of blocks(period, 'Point')) {
        const position = Number(tag(point, 'position'))
        if (!Number.isInteger(position) || position < 1 || position > count) {
          throw badAnswer()
        }
        const amount = Number(tag(point, 'price.amount') ?? 'x')
        if (!plausible(amount / 1000)) throw badAnswer()
        points.set(position, amount / 1000)
      }
      let last: number | undefined
      for (let position = 1; position <= count; position += 1) {
        const own = points.get(position)
        const price = own ?? (repeats ? last : undefined)
        last = price
        if (price === undefined) continue
        const at = start + (position - 1) * QUARTER_MS
        const known = found.get(at)
        if (!known || sequence < known.sequence) {
          found.set(at, { sequence, eurPerUnit: price })
        }
      }
    }
  }
  return [...found.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, { eurPerUnit }]) => ({ start, minutes: 15, eurPerUnit }))
}

/** What Gather asks Tibber: the prices of the key's own contract, no more. */
export const TIBBER_PRICE_QUERY =
  '{ viewer { homes { currentSubscription { priceInfo(resolution: QUARTER_HOURLY) { today { total startsAt currency } tomorrow { total startsAt currency } } } } } }'

/**
 * Tibber's answer: the all-in price of the first home with a running
 * contract. `tomorrow` is empty until it is published.
 */
export function readTibberPrices(answer: unknown): EnergyPriceSlot[] {
  const errors = record(answer)?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const refused = errors.some((each) => {
      const code = record(record(each)?.extensions)?.code
      return code === 'UNAUTHENTICATED' || code === 'FORBIDDEN'
    })
    throw refused ? new EnergyPriceAnswerError('keyRejected') : badAnswer()
  }
  const viewer = record(record(record(answer)?.data)?.viewer)
  if (!Array.isArray(viewer?.homes)) throw badAnswer()
  const subscription = viewer.homes
    .map((home) => record(record(home)?.currentSubscription))
    .find((each) => record(each?.priceInfo))
  if (!subscription) throw new EnergyPriceAnswerError('noSubscription')
  const info = record(subscription.priceInfo)
  const slots = [info?.today, info?.tomorrow].flatMap((day) =>
    Array.isArray(day) ? day : [],
  )
  return slots.map((slot) => {
    const row = record(slot)
    if (row?.currency !== 'EUR') throw badAnswer()
    return {
      start: momentOf(row.startsAt),
      minutes: 15,
      eurPerUnit: decimalOf(row.total),
    }
  })
}

// -- What a price means under a contract --------------------------------------------

type PriceTerms = Pick<
  EnergyContractTerms,
  | 'importMarkupEurPerKwh'
  | 'exportFeeEurPerKwh'
  | 'energyTaxEurPerKwh'
  | 'vatPercent'
>

/** The all-in price of a kWh from the grid: markup and energy tax, plus VAT. */
export function energyImportPrice(
  marketEurPerKwh: number,
  terms: Pick<
    PriceTerms,
    'importMarkupEurPerKwh' | 'energyTaxEurPerKwh' | 'vatPercent'
  >,
): number {
  return (
    (marketEurPerKwh + terms.importMarkupEurPerKwh + terms.energyTaxEurPerKwh) *
    (1 + terms.vatPercent / 100)
  )
}

/** What a kWh sent back earns; negative is what it costs. */
export function energyExportPrice(
  marketEurPerKwh: number,
  terms: Pick<PriceTerms, 'exportFeeEurPerKwh'>,
): number {
  return marketEurPerKwh + terms.exportFeeEurPerKwh
}

/** The four parts of an all-in price, which add up to it. */
export function energyPriceParts(
  marketEurPerKwh: number,
  terms: Pick<
    PriceTerms,
    'importMarkupEurPerKwh' | 'energyTaxEurPerKwh' | 'vatPercent'
  >,
): { market: number; markup: number; tax: number; vat: number; total: number } {
  const total = energyImportPrice(marketEurPerKwh, terms)
  return {
    market: marketEurPerKwh,
    markup: terms.importMarkupEurPerKwh,
    tax: terms.energyTaxEurPerKwh,
    vat:
      total -
      marketEurPerKwh -
      terms.importMarkupEurPerKwh -
      terms.energyTaxEurPerKwh,
    total,
  }
}

export interface EnergyPriceHour {
  start: number
  /** What the hour costs per kWh, in the view's basis. */
  price: number
  /** The market price, when it is known apart from `price`. */
  market: number | null
}

/**
 * The day's hours, each the average of its four quarters, or null unless all
 * of them are in.
 */
export function energyPriceHours(
  day: string,
  slots: readonly EnergyPriceSlot[],
): { start: number; eurPerUnit: number }[] | null {
  const whole = completeElectricityDay(day, slots)
  if (!whole) return null
  return amsterdamDayHours(day).map((start, index) => ({
    start,
    eurPerUnit: mean(
      whole.slice(index * 4, index * 4 + 4).map((slot) => slot.eurPerUnit),
    ),
  }))
}

const mean = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length

export function averageEnergyPrice(
  hours: readonly Pick<EnergyPriceHour, 'price'>[],
): number | null {
  return hours.length ? mean(hours.map((hour) => hour.price)) : null
}

export const CHEAPEST_BLOCK_HOURS = 3

export interface EnergyPriceBlock {
  start: number
  end: number
  average: number
}

/** The cheapest three hours in a row; the first one on a tie. */
export function cheapestEnergyBlock(
  hours: readonly EnergyPriceHour[],
): EnergyPriceBlock | null {
  let best: EnergyPriceBlock | null = null
  for (let at = 0; at + CHEAPEST_BLOCK_HOURS <= hours.length; at += 1) {
    const block = hours.slice(at, at + CHEAPEST_BLOCK_HOURS)
    const first = block[0] as EnergyPriceHour
    const last = block[CHEAPEST_BLOCK_HOURS - 1] as EnergyPriceHour
    if (last.start - first.start !== (CHEAPEST_BLOCK_HOURS - 1) * HOUR_MS) continue
    const average = mean(block.map((hour) => hour.price))
    // Equal prices add up to slightly different sums; that is still a tie.
    if (!best || average < best.average - 1e-9) {
      best = { start: first.start, end: last.start + HOUR_MS, average }
    }
  }
  return best
}

export function mostExpensiveEnergyHour<T extends Pick<EnergyPriceHour, 'price'>>(
  hours: readonly T[],
): T | null {
  let best: T | null = null
  for (const hour of hours) if (!best || hour.price > best.price) best = hour
  return best
}

/** The hour `now` is in, or null when the hours do not hold it. */
export function energyHourAt<T extends { start: number }>(
  hours: readonly T[],
  now: number,
): T | null {
  return (
    hours.find((hour) => hour.start <= now && now < hour.start + HOUR_MS) ?? null
  )
}

/**
 * The cheapest block still to start: in the rest of today, or tomorrow once
 * it is known. A block is within one day, as on Prices.
 */
export function nextCheapestEnergyBlock(
  today: readonly EnergyPriceHour[],
  tomorrow: readonly EnergyPriceHour[] | null,
  now: number,
): (EnergyPriceBlock & { on: 'today' | 'tomorrow' }) | null {
  const rest = cheapestEnergyBlock(today.filter((hour) => hour.start > now))
  const next = tomorrow ? cheapestEnergyBlock(tomorrow) : null
  if (rest && (!next || rest.average <= next.average)) {
    return { ...rest, on: 'today' }
  }
  return next ? { ...next, on: 'tomorrow' } : null
}

export type EnergyPriceJudgement = 'expensive' | 'average' | 'cheap'

/** Within this share of the day's average a price is simply average. */
const AVERAGE_BAND = 0.1

/**
 * A price against the day's average. The percentage is null when the average
 * is not above zero: a share of nothing says nothing.
 */
export function judgeEnergyPrice(
  price: number,
  average: number,
): { judgement: EnergyPriceJudgement; percent: number | null } {
  if (average <= 0) {
    const difference = price - average
    return {
      judgement:
        difference > 0.01 ? 'expensive' : difference < -0.01 ? 'cheap' : 'average',
      percent: null,
    }
  }
  const share = (price - average) / average
  return {
    judgement:
      share >= AVERAGE_BAND
        ? 'expensive'
        : share <= -AVERAGE_BAND
          ? 'cheap'
          : 'average',
    percent: Math.round(share * 100),
  }
}

/**
 * The stretches in which the market price is negative. `eurPerKwh` is what
 * sending back a kWh costs on average, or null when it is not known or not a
 * cost (the contract's fee makes up for it).
 */
export function negativeEnergyWindows(
  hours: readonly EnergyPriceHour[],
  exportFeeEurPerKwh: number | null,
): { start: number; end: number; eurPerKwh: number | null }[] {
  const windows: { start: number; end: number; prices: number[] }[] = []
  for (const hour of hours) {
    if (hour.market === null || hour.market >= 0) continue
    const last = windows[windows.length - 1]
    if (last && last.end === hour.start) {
      last.end = hour.start + HOUR_MS
      last.prices.push(hour.market)
    } else {
      windows.push({
        start: hour.start,
        end: hour.start + HOUR_MS,
        prices: [hour.market],
      })
    }
  }
  return windows.map(({ start, end, prices }) => {
    const earns =
      exportFeeEurPerKwh === null ? null : mean(prices) + exportFeeEurPerKwh
    return {
      start,
      end,
      eurPerKwh: earns !== null && earns < 0 ? -earns : null,
    }
  })
}

/** Bar heights from 0 to 1. The lowest price still has a bar to see. */
export function energyPriceHeights(
  hours: readonly Pick<EnergyPriceHour, 'price'>[],
): number[] {
  const max = Math.max(0, ...hours.map((hour) => hour.price))
  return hours.map((hour) =>
    max > 0 ? Math.max(0.03, Math.max(0, hour.price) / max) : 0.03,
  )
}
