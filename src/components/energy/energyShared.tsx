import { amsterdamIsoDate } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  energyMonthOf,
  energyYearMonths,
} from '@gather/core/energy'
import {
  capitalise,
  formatEnergyDate,
  type mirrorHeights,
  type yearPairHeights,
} from '@gather/core/energy-present'
import { readEnergyRefusal } from '@gather/core/refusals'
import { Link } from '@tanstack/react-router'
import { useQueries } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, type Messages, useI18n } from '../../lib/i18n'
import { type AppLink, linkTo } from '../../lib/links'
import type { Crumb } from '../app/Breadcrumbs'

/**
 * What the Energy pages share (APP-494): the day it is in Amsterdam, the
 * trail back to Energy, the segmented control, the period stepper, nav rows
 * and the two chart shapes of the design's chart grammar
 * (`designs/energy/README.md` section 11).
 *
 * Colours are the web palette's own tokens: ink is `--app-fg`, last year is
 * `--app-muted`, the baseline is `--app-border`, and solar takes
 * `--app-accent`, because the web has no Home group colour of its own.
 */

/**
 * A day or a month. Read off `day`, whose `hours` are typed; a month's are
 * always empty, which its handler's type narrows to `never[]`.
 */
export type EnergyPeriod = NonNullable<
  FunctionReturnType<typeof api.energyUsage.day>
>
export type EnergyCostTotals = NonNullable<EnergyPeriod['totals']['cost']>
export type EnergyContractSummary = NonNullable<EnergyPeriod['contract']>

export const PRIMARY =
  'inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] bg-[var(--app-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60'
export const SECONDARY =
  'inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-fg)] disabled:opacity-60'
/** 16px on phones so iOS does not zoom in on focus, as the kitchen fields. */
export const FIELD =
  'min-h-11 w-full min-w-0 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px] text-[var(--app-fg)] outline-none focus:border-[var(--app-accent)] sm:text-sm'
/** The wash card that carries a page's total. */
export const WASH =
  'grid gap-1.5 rounded-[calc(var(--app-radius)*2)] bg-[var(--app-surface-muted)] p-4'
export const NUMERAL =
  'text-4xl font-extrabold leading-tight tabular-nums sm:text-5xl'

/** Today in Amsterdam, which is the Group's calendar day (ADR-0040). */
export function useEnergyToday() {
  return useMemo(() => {
    const today = amsterdamIsoDate()
    return { today, month: energyMonthOf(today), now: Date.now() }
  }, [])
}

/** The trail from Energy to a page below it. */
export function energyTrail(messages: Messages, label: string): Crumb[] {
  return [
    { label: messages.modules.byId.energy.label, link: linkTo('energy') },
    { label },
  ]
}

/** A server refusal in words: keyed Energy codes first, then the shared reader. */
export function useEnergyRefusal() {
  const { messages } = useI18n()
  const errorText = useErrorMessage()
  return (caught: unknown) => {
    const code = readEnergyRefusal(caught)
    return code
      ? messages.energy.refusals[code]
      : errorText(caught, messages.common.errors.didNotWork)
  }
}

/** "Zonneplan, dynamic · since 1 January 2026". */
export function contractSummary(
  contract: { kind: 'dynamic' | 'fixed'; supplierName?: string; validFrom: string },
  messages: Messages,
  locale: string,
): string {
  const words = messages.energy.contract
  const kind = words[contract.kind]
  const date = formatEnergyDate(contract.validFrom, locale, 'dayMonthYear')
  return contract.supplierName
    ? fmt(words.summary, {
        supplier: contract.supplierName,
        kind: kind.toLocaleLowerCase(locale),
        date,
      })
    : fmt(words.summaryNoSupplier, { kind, date })
}

/** The Amsterdam day of a reading's moment, in words. */
export function readingDate(at: number, locale: string): string {
  return formatEnergyDate(amsterdamDayOf(at), locale, 'dayMonthYear')
}

/** Month name with a capital, for captions and titles: "November". */
export function monthTitle(month: string, locale: string, withYear = false) {
  return capitalise(
    formatEnergyDate(month, locale, withYear ? 'monthYear' : 'month'),
  )
}

// -- Controls -------------------------------------------------------------------

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid min-h-10 gap-0.5 rounded-full bg-[var(--app-surface-muted)] p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-9 rounded-full px-2 text-sm ${
              selected
                ? 'bg-[var(--app-surface)] font-semibold text-[var(--app-fg)] shadow-sm'
                : 'text-[var(--app-muted)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Previous / next around a period pill; next stops at the running period. */
export function PeriodStepper({
  label,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  canNext,
}: {
  label: string
  previousLabel: string
  nextLabel: string
  onPrevious: () => void
  onNext: () => void
  canNext: boolean
}) {
  const button =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--app-fg)] disabled:opacity-40'
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label={previousLabel}
        className={button}
        onClick={onPrevious}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-muted)]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
      <span
        aria-live="polite"
        className="inline-flex min-h-9 min-w-0 items-center rounded-full bg-[var(--app-surface-muted)] px-4 text-sm font-semibold"
      >
        {label}
      </span>
      <button
        type="button"
        aria-label={nextLabel}
        className={button}
        onClick={onNext}
        disabled={!canNext}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-muted)]">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
    </div>
  )
}

/** One row of a list of links: a label, a live subtitle and a chevron. */
export function NavRow({
  link,
  label,
  sub,
}: {
  link: AppLink
  label: string
  sub?: string
}) {
  return (
    <Link
      {...link}
      className="flex min-h-14 items-center gap-3 px-4 py-2 text-[var(--app-fg)] no-underline hover:bg-[var(--app-surface-muted)]"
    >
      <span className="grid min-w-0 flex-1">
        <span className="text-base">{label}</span>
        {sub ? (
          <span className="text-sm text-[var(--app-muted)]">{sub}</span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--app-muted)]"
        aria-hidden="true"
      />
    </Link>
  )
}

/** A card of rows separated by hairlines. */
export function RowList({
  children,
  label,
  as = 'div',
}: {
  children: ReactNode
  label?: string
  as?: 'div' | 'nav'
}) {
  const Tag = as
  return (
    <Tag
      aria-label={label}
      className="shell-card grid divide-y divide-[var(--app-border)] overflow-hidden p-0"
    >
      {children}
    </Tag>
  )
}

/** A figure in a list: label and sub on the left, the value on the right. */
export function ValueRow({
  label,
  sub,
  value,
}: {
  label: string
  sub?: string
  value: string
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
      <span className="grid min-w-0">
        <span className="text-base">{label}</span>
        {sub ? (
          <span className="text-sm text-[var(--app-muted)]">{sub}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums">
        {value}
      </span>
    </div>
  )
}

/** 2×2 facts; a fact the site cannot measure is left out, never zero. */
export function Facts({
  facts,
}: {
  facts: readonly { label: string; value: string }[]
}) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-3">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="shell-card grid min-w-0 gap-1 [overflow-wrap:anywhere]"
        >
          <dt className="text-sm text-[var(--app-muted)]">{fact.label}</dt>
          <dd className="m-0 text-xl font-bold tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// -- Charts ---------------------------------------------------------------------

const FUTURE_BAR =
  'border border-dashed border-[var(--app-muted)] opacity-50'

function Legend({
  items,
}: {
  items: readonly { label: string; swatch: 'ink' | 'solar' | 'muted' | 'future' | 'outline' }[]
}) {
  const swatch = {
    ink: 'bg-[var(--app-fg)]',
    solar: 'bg-[var(--app-accent)]',
    muted: 'bg-[var(--app-muted)]',
    future: FUTURE_BAR,
    outline: 'border-2 border-[var(--app-fg)]',
  }
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-[var(--app-muted)]">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block h-2.5 w-2.5 rounded-[3px] ${swatch[item.swatch]}`}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** A chart card: a figure whose label and visible sentence say the answer. */
export function ChartFigure({
  title,
  aside,
  label,
  sentence,
  children,
  legend,
}: {
  title: string
  aside?: ReactNode
  label: string
  sentence: string
  children: ReactNode
  legend?: Parameters<typeof Legend>[0]['items']
}) {
  return (
    <figure aria-label={label} className="shell-card m-0 grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-base font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
      {legend ? <Legend items={legend} /> : null}
      <figcaption className="text-sm">{sentence}</figcaption>
    </figure>
  )
}

/**
 * Usage above a baseline in ink, solar below it, one shared scale. A slot
 * still to come is a dashed outline; a past slot without a figure stays empty.
 */
export function MirrorBars({
  slots,
  upHeight,
  downHeight,
  ticks,
  showDown,
}: {
  slots: ReturnType<typeof mirrorHeights>
  upHeight: number
  downHeight: number
  ticks: readonly string[]
  showDown: boolean
}) {
  const gap = slots.length > 25 ? 'gap-[2px]' : 'gap-[3px]'
  return (
    <div aria-hidden="true" className="grid">
      <div className={`flex items-end ${gap}`} style={{ height: upHeight }}>
        {slots.map((slot) => (
          <span
            key={slot.key}
            data-bar={slot.future ? 'future' : slot.empty ? 'empty' : 'up'}
            className={`min-w-0 flex-1 rounded-t-[3px] ${
              slot.future ? FUTURE_BAR : slot.empty ? '' : 'bg-[var(--app-fg)]'
            }`}
            style={{
              height: slot.future
                ? '100%'
                : `${Math.round(slot.up * upHeight)}px`,
            }}
          />
        ))}
      </div>
      <div className="h-px bg-[var(--app-border)]" />
      {showDown ? (
        <div
          className={`flex items-start ${gap}`}
          style={{ height: downHeight }}
        >
          {slots.map((slot) => (
            <span
              key={slot.key}
              className="min-w-0 flex-1 rounded-b-[3px] bg-[var(--app-accent)]"
              style={{
                height: slot.future
                  ? 0
                  : `${Math.round(slot.down * downHeight)}px`,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="mt-1 flex justify-between text-xs text-[var(--app-muted)] tabular-nums">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  )
}

export function mirrorLegend(messages: Messages, showSolar: boolean) {
  const words = messages.energy.usage
  return [
    { label: words.legendUsed, swatch: 'ink' as const },
    ...(showSolar ? [{ label: words.legendSolar, swatch: 'solar' as const }] : []),
    { label: words.legendFuture, swatch: 'future' as const },
  ]
}

/** Twelve month pairs: last year muted, this year ink, the running month outlined. */
export function YearPairBars({
  pairs,
  labels,
  height,
}: {
  pairs: ReturnType<typeof yearPairHeights>
  labels: readonly string[]
  height: number
}) {
  return (
    <div aria-hidden="true" className="grid gap-1">
      <div className="flex items-end gap-1" style={{ height }}>
        {pairs.map((pair, index) => (
          <span
            // Twelve fixed months: the position is the month.
            // biome-ignore lint/suspicious/noArrayIndexKey: months are positions
            key={index}
            className="flex h-full min-w-0 flex-1 items-end gap-px"
          >
            <span
              className="min-w-0 flex-1 rounded-t-[2px] bg-[var(--app-muted)]"
              style={{ height: `${Math.round(pair.previous * height)}px` }}
            />
            <span
              data-bar={pair.running ? 'running' : 'current'}
              className={`box-border min-w-0 flex-1 rounded-t-[2px] ${
                pair.running
                  ? 'border-2 border-[var(--app-fg)]'
                  : 'bg-[var(--app-fg)]'
              }`}
              style={{
                height: pair.hasCurrent
                  ? `${Math.max(pair.running ? 4 : 0, Math.round(pair.current * height))}px`
                  : 0,
              }}
            />
          </span>
        ))}
      </div>
      <div className="flex gap-1 text-[11px] text-[var(--app-muted)] sm:text-xs">
        {labels.map((label, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: months are positions
          <span key={index} className="min-w-0 flex-1 truncate text-center">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function yearLegend(
  messages: Messages,
  year: number,
  running: boolean,
) {
  return [
    { label: String(year - 1), swatch: 'muted' as const },
    { label: String(year), swatch: 'ink' as const },
    ...(running
      ? [{ label: messages.energy.usage.legendRunning, swatch: 'outline' as const }]
      : []),
  ]
}

// -- A year of months -------------------------------------------------------------

/**
 * Two years of months, this year and the one before, one query per month:
 * the server never reads a year of hours in one go (`convex/energyUsage.ts`).
 * The object is stable per year, so the subscriptions are too.
 */
export function useEnergyYears(
  groupSlug: string,
  year: number,
  today: string,
): {
  current: (EnergyPeriod | null | undefined)[]
  previous: (EnergyPeriod | null | undefined)[]
} {
  const queries = useMemo(() => {
    const entries: Record<
      string,
      { query: typeof api.energyUsage.month; args: Record<string, string> }
    > = {}
    for (const month of [
      ...energyYearMonths(year - 1),
      ...energyYearMonths(year),
    ]) {
      entries[month] = {
        query: api.energyUsage.month,
        args: { groupSlug, month, today },
      }
    }
    return entries
  }, [groupSlug, year, today])
  const results = useQueries(queries)
  const read = (month: string): EnergyPeriod | null | undefined => {
    const value = results[month]
    return value instanceof Error ? null : value
  }
  return {
    current: energyYearMonths(year).map(read),
    previous: energyYearMonths(year - 1).map(read),
  }
}

/** A month's figure for the year chart; null when it has none. */
export function monthFigure(
  period: EnergyPeriod | null | undefined,
  unit: 'kwh' | 'euro',
  withoutNet = false,
): number | null {
  if (!period || period.totals.daysWithData === 0) return null
  if (unit === 'kwh') return period.totals.consumptionKwh
  const cost = withoutNet ? period.totals.costWithoutNet : period.totals.cost
  return cost ? cost.totalCents : null
}

