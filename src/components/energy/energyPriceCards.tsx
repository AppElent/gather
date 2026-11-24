import type { EnergyPriceDay } from '@gather/core/energy-present'
import {
  type EnergyPriceChart,
  type EnergyPriceView,
  energyPriceChart,
  energyPriceFootnote,
  energyPriceNow,
} from '@gather/core/energy-present'
import { Link } from '@tanstack/react-router'
import { useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { ChartFigure, NUMERAL, WASH } from './energyShared'

/**
 * Electricity's price per hour (APP-493): the bars, and Home's two cards. The
 * words come from `@gather/core/energy-present`, so the phone says the same.
 */

export const PRICE_TICKS = ['00', '06', '12', '18', '24'] as const

/**
 * One bar per hour. The cheapest three are `ink`, past hours `surface-2`, the
 * rest `hair-strong`; an `ink` outline marks now, or tomorrow's most
 * expensive hour. `highlight` off (Home) leaves the cheapest uncoloured.
 */
export function PriceBars({
  bars,
  height,
  highlight,
}: {
  bars: EnergyPriceChart['bars']
  height: number
  highlight: boolean
}) {
  return (
    <div aria-hidden="true" className="grid">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {bars.map((bar) => {
          const cheapest = highlight && bar.cheapest
          return (
            <span
              key={bar.key}
              data-bar={
                bar.marked
                  ? 'marked'
                  : cheapest
                    ? 'cheapest'
                    : bar.past
                      ? 'past'
                      : 'rest'
              }
              className={`box-border min-w-0 flex-1 rounded-t-[3px] ${
                cheapest
                  ? 'bg-[var(--ink)]'
                  : bar.marked
                    ? ''
                    : bar.past
                      ? 'bg-[var(--surface-2)]'
                      : 'bg-[var(--hair-strong)]'
              } ${bar.marked ? 'border-2 border-[var(--ink)]' : ''}`}
              style={{ height: `${Math.max(4, Math.round(bar.height * height))}px` }}
            />
          )
        })}
      </div>
      <div className="h-px bg-[var(--hair)]" />
      <div className="mt-1 flex justify-between text-xs text-[var(--muted)] tabular-nums">
        {PRICE_TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  )
}

/** Home's Now card: the price of this hour, and when it is cheap next. */
export function PriceNowCard({
  view,
  now,
}: {
  view: EnergyPriceView
  now: number
}) {
  const { messages, locale } = useI18n()
  const shown = energyPriceNow(view, now, messages.energy, locale)
  if (!shown) return null
  const rest = shown.comparison.slice(shown.judgement.length)
  return (
    <section aria-label={shown.label} className={WASH}>
      <p className="m-0 text-sm text-[var(--muted)]">{shown.caption}</p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2">
        <span className={NUMERAL}>{shown.price}</span>
        <span className="text-[var(--muted)]">{shown.unit}</span>
      </p>
      <p className="m-0 text-sm">
        <strong>{shown.judgement}</strong>
        {rest}
      </p>
      {shown.next ? <p className="m-0 text-sm">{shown.next}</p> : null}
    </section>
  )
}

/** Home's chart of today's prices; the whole card opens Prices. */
export function PriceTodayCard({
  prices,
  now,
}: {
  prices: EnergyPriceDay
  now: number
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy
  const chart = energyPriceChart(prices, now, copy, locale)
  if (!chart) return null
  return (
    <Link
      {...linkTo('energyPrices')}
      className="block text-[var(--ink)] no-underline"
    >
      <ChartFigure
        title={copy.home.priceCard}
        aside={
          <span className="text-sm text-[var(--muted)]">
            {copy.home.openPrices} ›
          </span>
        }
        label={chart.sentence}
        sentence={chart.sentence}
      >
        <PriceBars bars={chart.bars} height={96} highlight={false} />
      </ChartFigure>
    </Link>
  )
}

export function PriceFootnote({ prices }: { prices: EnergyPriceDay }) {
  const { messages } = useI18n()
  return (
    <p className="m-0 px-1 text-sm text-[var(--muted)]">
      {energyPriceFootnote(prices, messages.energy)}
    </p>
  )
}
