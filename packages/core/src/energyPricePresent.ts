/**
 * How Energy prices read (APP-493): amounts, the chart's bars, the sentence
 * that says what a chart shows, and the price source's state. Shared by the
 * web and the phone so both say the same thing (ADR-0017); each draws the
 * bars itself.
 */

import { capitalise, formatEnergyDate, formatEnergyHour, formatEnergyMoment } from './energyPresent'
import {
  averageEnergyPrice,
  cheapestEnergyBlock,
  ENERGY_PRICE_PROVIDER_NAMES,
  ENERGY_PRICES_EXPECTED,
  type EnergyPriceBlock,
  type EnergyPriceHour,
  type EnergyPriceProblem,
  type EnergyPriceProvider,
  energyHourAt,
  energyPriceHeights,
  energyPriceNeedsKey,
  energyPriceParts,
  energyTomorrowDue,
  judgeEnergyPrice,
  mostExpensiveEnergyHour,
  negativeEnergyWindows,
  nextCheapestEnergyBlock,
  readEnergyPriceProblem,
} from './energyPrices'
import { amsterdamDayStart } from './energyUsage'
import { fmt } from './i18n'
import type { Messages } from './messages/en'

type EnergyWords = Messages['energy']

const HOUR_MS = 3_600_000

/** A day of prices, as `energyPrices.view` returns it. */
export interface EnergyPriceDay {
  day: string
  provider: EnergyPriceProvider
  basis: 'allIn' | 'market'
  terms: {
    supplierName: string | null
    importMarkupEurPerKwh: number
    energyTaxEurPerKwh: number
    vatPercent: number
  } | null
  exportFeeEurPerKwh: number | null
  hours: EnergyPriceHour[]
}

/** Prices of today and tomorrow, as `energyPrices.view` returns them. */
export interface EnergyPriceView {
  siteName: string
  canManage: boolean
  provider: EnergyPriceProvider
  hasKey: boolean
  status: 'ok' | 'error' | 'needsKey'
  lastError: string | null
  lastFetchedAt: number | null
  contract: { kind: 'dynamic' | 'fixed'; supplierName: string | null } | null
  today: EnergyPriceDay | null
  tomorrow: EnergyPriceDay | null
}

/** "€ 0,37". Three decimals for the parts of a price. */
export function formatEnergyPrice(
  eur: number,
  locale: string,
  decimals = 2,
): string {
  // A price that rounds to nothing has no sign: never "€ -0,00".
  const rounded = Number(eur.toFixed(decimals)) || 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded)
}

const cents = (eur: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.round(eur * 100) || 0,
  )

/** An hour on a day's axis. The end of a day is 24:00, not 00:00. */
function hourLabel(at: number, day: string, locale: string): string {
  const label = formatEnergyHour(at, locale)
  if (label !== '00:00' && label !== '24:00') return label
  return at > amsterdamDayStart(day) ? '24:00' : '00:00'
}

const windowOf = (
  block: { start: number; end: number },
  day: string,
  locale: string,
) => ({
  from: hourLabel(block.start, day, locale),
  to: hourLabel(block.end, day, locale),
})

export interface EnergyPriceBar {
  key: string
  height: number
  /** In the cheapest three hours. */
  cheapest: boolean
  past: boolean
  /** The hour an outline points at: now, or tomorrow's most expensive. */
  marked: boolean
}

export interface EnergyPriceChart {
  bars: EnergyPriceBar[]
  average: number
  cheapest: EnergyPriceBlock
  expensive: EnergyPriceHour
  /** The hour it is, on today's chart. */
  current: EnergyPriceHour | null
  /** The figure's label and the sentence under it. */
  sentence: string
  facts: { label: string; value: string }[]
  legend: { label: string; swatch: 'ink' | 'outline' }[]
}

/** One day's chart. `now` is null for tomorrow. */
export function energyPriceChart(
  prices: EnergyPriceDay,
  now: number | null,
  words: EnergyWords,
  locale: string,
): EnergyPriceChart | null {
  const { hours, day } = prices
  const average = averageEnergyPrice(hours)
  const cheapest = cheapestEnergyBlock(hours)
  const expensive = mostExpensiveEnergyHour(hours)
  if (average === null || !cheapest || !expensive) return null
  const copy = words.prices
  const current = now === null ? null : energyHourAt(hours, now)
  const heights = energyPriceHeights(hours)
  const marked = now === null ? expensive : current
  const said = {
    ...windowOf(cheapest, day, locale),
    average: cents(cheapest.average, locale),
    hour: hourLabel(expensive.start, day, locale),
    max: cents(expensive.price, locale),
  }
  return {
    bars: hours.map((hour, index) => ({
      key: String(hour.start),
      height: heights[index] ?? 0,
      cheapest: hour.start >= cheapest.start && hour.start < cheapest.end,
      past: now !== null && hour.start + HOUR_MS <= now,
      marked: hour === marked,
    })),
    average,
    cheapest,
    expensive,
    current,
    sentence:
      now === null
        ? fmt(copy.sentenceTomorrow, said)
        : current
          ? fmt(copy.sentenceToday, { ...said, now: cents(current.price, locale) })
          : fmt(copy.sentenceTodayNoNow, said),
    facts: [
      { label: copy.factAverage, value: formatEnergyPrice(average, locale) },
      {
        label: copy.factCheapest,
        value: fmt(copy.factBlock, {
          ...windowOf(cheapest, day, locale),
          price: formatEnergyPrice(cheapest.average, locale),
        }),
      },
      {
        label: copy.factExpensive,
        value: fmt(copy.factHour, {
          hour: hourLabel(expensive.start, day, locale),
          price: formatEnergyPrice(expensive.price, locale),
        }),
      },
    ],
    legend: [
      { label: copy.legendCheapest, swatch: 'ink' },
      ...(now === null
        ? [{ label: copy.legendExpensive, swatch: 'outline' as const }]
        : current
          ? [
              {
                label: fmt(copy.legendNow, {
                  hour: hourLabel(current.start, day, locale),
                }),
                swatch: 'outline' as const,
              },
            ]
          : []),
    ],
  }
}

/** "Friday 20 November, all-in per kWh". */
export function energyPriceCaption(
  prices: EnergyPriceDay,
  words: EnergyWords,
  locale: string,
): string {
  return fmt(
    prices.basis === 'allIn'
      ? words.prices.captionAllIn
      : words.prices.captionMarket,
    {
      date: capitalise(
        formatEnergyDate(prices.day, locale, 'weekdayDayMonth'),
      ),
    },
  )
}

export interface EnergyPriceNow {
  caption: string
  price: string
  unit: string
  /** Bold on screen; the sentence after it starts with the same word. */
  judgement: string
  comparison: string
  next: string | null
  /** The card in one sentence. */
  label: string
}

/** Home's Now card, or null without a price for this hour. */
export function energyPriceNow(
  view: Pick<EnergyPriceView, 'today' | 'tomorrow'>,
  now: number,
  words: EnergyWords,
  locale: string,
): EnergyPriceNow | null {
  const { today, tomorrow } = view
  if (!today) return null
  const hour = energyHourAt(today.hours, now)
  const average = averageEnergyPrice(today.hours)
  if (!hour || average === null) return null
  const copy = words.home
  const { judgement, percent } = judgeEnergyPrice(hour.price, average)
  const judged = {
    judgement: copy[judgement],
    percent: String(Math.abs(percent ?? 0)),
  }
  const comparison = fmt(
    percent === null
      ? copy.plain
      : percent === 0
        ? copy.same
        : percent > 0
          ? copy.above
          : copy.below,
    judged,
  )
  const block = nextCheapestEnergyBlock(
    today.hours,
    tomorrow?.hours ?? null,
    now,
  )
  const next = block
    ? fmt(block.on === 'today' ? copy.nextToday : copy.nextTomorrow, {
        ...windowOf(
          block,
          block.on === 'today' ? today.day : (tomorrow?.day ?? today.day),
          locale,
        ),
        price: formatEnergyPrice(block.average, locale),
      })
    : null
  const price = formatEnergyPrice(hour.price, locale)
  const unit = today.basis === 'allIn' ? copy.perKwh : copy.nowMarket
  return {
    caption: fmt(
      copy.now,
      windowOf({ start: hour.start, end: hour.start + HOUR_MS }, today.day, locale),
    ),
    price,
    unit,
    judgement: judged.judgement,
    comparison,
    next,
    label: [`${copy.nowLabel}: ${price} ${unit}`, comparison, next]
      .filter(Boolean)
      .join('. '),
  }
}

/** The negative-price cards of a day. */
export function energyNegativeCards(
  prices: EnergyPriceDay,
  words: EnergyWords,
  locale: string,
): { key: string; title: string; body: string }[] {
  const copy = words.prices
  return negativeEnergyWindows(prices.hours, prices.exportFeeEurPerKwh).map(
    (window) => {
      const range = windowOf(window, prices.day, locale)
      return window.eurPerKwh === null
        ? {
            key: String(window.start),
            title: fmt(copy.negative, range),
            body: copy.negativeBody,
          }
        : {
            key: String(window.start),
            title: fmt(copy.negativeCost, range),
            body: fmt(copy.negativeCostBody, {
              price: formatEnergyPrice(window.eurPerKwh, locale),
            }),
          }
    },
  )
}

export interface EnergyPriceBuildUp {
  title: string
  label: string
  /** Shares of the bar, 0 to 1. A negative part has no width. */
  parts: {
    key: 'market' | 'markup' | 'tax' | 'vat'
    label: string
    value: string
    share: number
  }[]
}

/** "What makes up € 0.37" for one hour, or null without a contract's terms. */
export function energyPriceBuildUp(
  prices: EnergyPriceDay,
  hour: EnergyPriceHour,
  words: EnergyWords,
  locale: string,
): EnergyPriceBuildUp | null {
  if (!prices.terms || hour.market === null) return null
  const copy = words.prices
  const { terms } = prices
  const amounts = energyPriceParts(hour.market, terms)
  const positive = (['market', 'markup', 'tax', 'vat'] as const).reduce(
    (total, key) => total + Math.max(0, amounts[key]),
    0,
  )
  const part = (key: 'market' | 'markup' | 'tax' | 'vat', label: string) => ({
    key,
    label,
    value: formatEnergyPrice(amounts[key], locale, 3),
    share: positive > 0 ? Math.max(0, amounts[key]) / positive : 0,
  })
  const parts = [
    part(
      'market',
      fmt(copy.partMarket, {
        provider: ENERGY_PRICE_PROVIDER_NAMES[prices.provider],
      }),
    ),
    part(
      'markup',
      terms.supplierName
        ? fmt(copy.partMarkupSupplier, { supplier: terms.supplierName })
        : copy.partMarkup,
    ),
    part('tax', copy.partTax),
    part(
      'vat',
      fmt(copy.partVat, {
        percent: new Intl.NumberFormat(locale).format(terms.vatPercent),
      }),
    ),
  ]
  const value = (key: string) =>
    parts.find((each) => each.key === key)?.value ?? ''
  return {
    title: fmt(copy.buildUp, { price: formatEnergyPrice(amounts.total, locale) }),
    label: fmt(copy.buildUpLabel, {
      market: value('market'),
      markup: value('markup'),
      tax: value('tax'),
      vat: value('vat'),
    }),
    parts,
  }
}

/** "EnergyZero + Zonneplan", or the provider alone. */
export function energyPriceSourceName(
  view: Pick<EnergyPriceView, 'provider' | 'today' | 'tomorrow'>,
  words: EnergyWords,
): string {
  const provider = ENERGY_PRICE_PROVIDER_NAMES[view.provider]
  const supplier = (view.today ?? view.tomorrow)?.terms?.supplierName
  return supplier
    ? fmt(words.prices.sourceWithSupplier, { provider, supplier })
    : provider
}

/** Home's line under the cards: whose prices, and what is in them. */
export function energyPriceFootnote(
  prices: EnergyPriceDay,
  words: EnergyWords,
): string {
  const copy = words.home
  const provider = ENERGY_PRICE_PROVIDER_NAMES[prices.provider]
  if (prices.basis === 'market') return fmt(copy.footnoteMarket, { provider })
  if (!prices.terms) return fmt(copy.footnoteAccount, { provider })
  return prices.terms.supplierName
    ? fmt(copy.footnoteAllIn, { provider, supplier: prices.terms.supplierName })
    : fmt(copy.footnoteAllInNoSupplier, { provider })
}

/** Why a day shows market prices instead of what the Group pays. */
export function energyPriceBasisNote(
  view: Pick<EnergyPriceView, 'contract'>,
  prices: EnergyPriceDay,
  words: EnergyWords,
): string | null {
  if (prices.basis === 'allIn') return null
  return view.contract?.kind === 'fixed'
    ? words.prices.noteFixed
    : words.prices.noteNoContract
}

/** What is wrong with the prices, whatever the stored status says of it. */
export function energyPriceProblem(
  view: EnergyPriceView,
  now: number,
): EnergyPriceProblem | null {
  if (view.status !== 'ok') {
    return (
      readEnergyPriceProblem(view.lastError ?? undefined) ??
      (view.status === 'needsKey' ? 'keyRejected' : 'unreachable')
    )
  }
  // A key just saved: the first answer is on its way.
  if (energyPriceNeedsKey(view.provider) && view.lastFetchedAt === null) {
    return null
  }
  return !view.today || (!view.tomorrow && energyTomorrowDue(now))
    ? 'late'
    : null
}

/** The price source's state in one line, and whether it needs attention. */
export function energyPriceStateLine(
  view: EnergyPriceView,
  now: number,
  words: EnergyWords,
  locale: string,
): { text: string; problem: boolean } {
  const copy = words.prices
  const provider = ENERGY_PRICE_PROVIDER_NAMES[view.provider]
  const problem = energyPriceProblem(view, now)
  const when =
    view.lastFetchedAt === null
      ? null
      : formatEnergyMoment(view.lastFetchedAt, now, locale)
  if (problem) {
    const said = fmt(copy.problems[problem], { provider })
    return {
      text: when
        ? fmt(copy.stateProblem, { problem: said, when })
        : fmt(copy.stateProblemNever, { problem: said }),
      problem: true,
    }
  }
  return {
    text:
      when === null
        ? fmt(copy.stateFetching, { provider })
        : fmt(view.tomorrow ? copy.stateTomorrow : copy.stateFetched, {
            provider,
            when,
          }),
    problem: false,
  }
}

/** Tomorrow's tab before its prices are in. */
export function energyTomorrowLine(now: number, words: EnergyWords): string {
  if (energyTomorrowDue(now)) return words.prices.tomorrowLate
  const { hour, minute } = ENERGY_PRICES_EXPECTED
  return fmt(words.prices.tomorrowExpected, {
    time: `${hour}:${String(minute).padStart(2, '0')}`,
  })
}
