import {
  addEnergyMonths,
  forecastMonthCents,
  netMeteringPossibleIn,
} from '@gather/core/energy'
import {
  compareYears,
  formatEnergyDate,
  formatEnergyEuro,
  formatEnergyNumber,
  monthName,
  peakOf,
  yearPairHeights,
} from '@gather/core/energy-present'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, type Messages, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { dayTicks } from './energySeries'
import {
  ChartFigure,
  contractSummary,
  type EnergyCostTotals,
  type EnergyPeriod,
  energyTrail,
  monthFigure,
  monthTitle,
  NavRow,
  NUMERAL,
  PeriodStepper,
  RowList,
  Segmented,
  useEnergyToday,
  useEnergyYears,
  ValueRow,
  WASH,
  YearPairBars,
  yearLegend,
} from './energyShared'

type Method = 'with' | 'without'

/**
 * Costs per month (APP-494, design sections 5 and 11.4).
 *
 * Before 2027 a contract with net metering can show the month with or
 * without it; from 2027 the choice is gone and every cost is without. A month
 * whose costs cannot be worked out says why in words, never with a number
 * that is not one.
 */
export function EnergyCostsPage() {
  const group = useRequiredCurrentGroup()
  const { messages, locale } = useI18n()
  const copy = messages.energy.costs
  const { today, month: thisMonth } = useEnergyToday()
  const [month, setMonth] = useState(thisMonth)
  const [picked, setPicked] = useState<Method>('with')
  const period = useQuery(api.energyUsage.month, {
    groupSlug: group.slug,
    month,
    today,
  })
  const previous = useQuery(api.energyUsage.month, {
    groupSlug: group.slug,
    month: addEnergyMonths(month, -1),
    today,
  })

  const method: Method = period?.netMeteringChoice ? picked : 'with'

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={energyTrail(messages, copy.title)} className="mb-0" />
      <h1 className="m-0 font-rounded text-2xl font-bold">{copy.title}</h1>
      <PeriodStepper
        label={monthTitle(month, locale, true)}
        previousLabel={copy.previousMonth}
        nextLabel={copy.nextMonth}
        onPrevious={() => setMonth(addEnergyMonths(month, -1))}
        onNext={() => setMonth(addEnergyMonths(month, 1))}
        canNext={month < thisMonth}
      />
      {period?.netMeteringChoice ? (
        <Segmented
          label={copy.methodLabel}
          value={method}
          onChange={setPicked}
          options={[
            { value: 'with', label: copy.withNet },
            { value: 'without', label: copy.withoutNet },
          ]}
        />
      ) : null}

      {period === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
      ) : period === null ? (
        <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
      ) : (
        <MonthCosts
          period={period}
          previous={previous ?? null}
          month={month}
          thisMonth={thisMonth}
          today={today}
          method={method}
          groupSlug={group.slug}
        />
      )}
    </div>
  )
}

function costOf(period: EnergyPeriod | null, method: Method) {
  if (!period) return null
  return method === 'without' ? period.totals.costWithoutNet : period.totals.cost
}

function nowNote(
  period: EnergyPeriod,
  previous: EnergyPeriod | null,
  month: string,
  thisMonth: string,
  method: Method,
  messages: Messages,
  locale: string,
): string {
  const copy = messages.energy.costs
  const monthWord = formatEnergyDate(month, locale, 'month')
  const cost = period.totals.cost
  const without = period.totals.costWithoutNet
  if (method === 'without' && cost && without) {
    const difference = without.totalCents - cost.totalCents
    return difference > 0
      ? fmt(copy.noteWithout, {
          month: monthWord,
          difference: formatEnergyEuro(difference, locale),
        })
      : fmt(copy.noteWithoutSame, { month: monthWord })
  }
  const total = costOf(period, method)
  const before = costOf(previous, method)
  const previousWord = monthTitle(addEnergyMonths(month, -1), locale)
  const forecast =
    month === thisMonth && total
      ? forecastMonthCents(total.totalCents, period.totals.daysWithData, month)
      : null
  const notes: string[] = []
  if (before && forecast !== null) {
    notes.push(
      fmt(copy.noteWith, {
        previous: previousWord,
        amount: formatEnergyEuro(before.totalCents, locale),
        month: monthWord,
        forecast: formatEnergyEuro(forecast, locale),
      }),
    )
  } else if (before) {
    notes.push(
      fmt(copy.notePrevious, {
        previous: previousWord,
        amount: formatEnergyEuro(before.totalCents, locale),
      }),
    )
  } else if (forecast !== null) {
    notes.push(
      fmt(copy.noteForecast, {
        month: monthWord,
        forecast: formatEnergyEuro(forecast, locale),
      }),
    )
  }
  if (!netMeteringPossibleIn(month)) notes.push(copy.noteFrom2027)
  return notes.join(' ')
}

function MonthCosts({
  period,
  previous,
  month,
  thisMonth,
  today,
  method,
  groupSlug,
}: {
  period: EnergyPeriod
  previous: EnergyPeriod | null
  month: string
  thisMonth: string
  today: string
  method: Method
  groupSlug: string
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.costs
  const totals = period.totals
  const monthWord = formatEnergyDate(month, locale, 'month')
  const cost = costOf(period, method)
  const status = totals.costStatus

  const missing =
    status === 'noData'
      ? fmt(copy.noData, { month: monthWord })
      : status === 'noContract'
        ? copy.noContract
        : status === 'noPrices'
          ? fmt(copy.noPrices, { month: monthWord })
          : null

  return (
    <>
      <section aria-label={copy.totalLabel} className={WASH}>
        {missing || !cost ? (
          <p className="m-0 text-base">{missing ?? copy.noContract}</p>
        ) : (
          <>
            {totals.firstDay && totals.lastDay ? (
              <span className="text-sm text-[var(--muted)]">
                {fmt(copy.range, {
                  from: formatEnergyDate(totals.firstDay, locale, 'dayMonth'),
                  to: formatEnergyDate(totals.lastDay, locale, 'dayMonth'),
                })}
              </span>
            ) : null}
            <span className={NUMERAL}>
              {formatEnergyEuro(cost.totalCents, locale)}
            </span>
            <p className="m-0 text-sm">
              {nowNote(
                period,
                previous,
                month,
                thisMonth,
                method,
                messages,
                locale,
              )}
            </p>
          </>
        )}
        {status === 'ok' && totals.costMissingDays > 0 ? (
          <p className="m-0 text-sm text-[var(--muted)]">
            {plural(locale, totals.costMissingDays, copy.missingDays)}
          </p>
        ) : null}
        {totals.estimated ? (
          <p className="m-0 text-sm text-[var(--muted)]">{copy.estimated}</p>
        ) : null}
      </section>

      <PerDayChart period={period} today={today} method={method} />
      <PerMonthChart
        groupSlug={groupSlug}
        month={month}
        thisMonth={thisMonth}
        today={today}
        method={method}
      />

      {cost ? (
        <Breakdown period={period} cost={cost} method={method} />
      ) : null}

      <RowList>
        <NavRow
          link={linkTo('energyContract')}
          label={messages.energy.contract.title}
          sub={
            period.contract
              ? contractSummary(period.contract, messages, locale)
              : copy.contractNone
          }
        />
      </RowList>
      <p className="m-0 text-sm text-[var(--muted)]">{copy.vatNote}</p>
    </>
  )
}

/** Costs per day: a bar per day, days still to come dashed, never a zero bar. */
function PerDayChart({
  period,
  today,
  method,
}: {
  period: EnergyPeriod
  today: string
  method: Method
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.costs
  const month = period.days[0]?.day.slice(0, 7) ?? today.slice(0, 7)
  const monthWord = formatEnergyDate(month, locale, 'month')
  const dayCost = (day: EnergyPeriod['days'][number]) => {
    const cost = method === 'without' ? day.costWithoutNet : day.cost
    return cost ? cost.totalCents : null
  }
  const peak = peakOf(period.days, dayCost)
  const max = peak?.value ?? 0
  const label = peak
    ? fmt(copy.perDayLabel, {
        month: monthWord,
        day: formatEnergyDate(peak.item.day, locale, 'dayMonth'),
        amount: formatEnergyEuro(peak.value, locale),
      })
    : fmt(copy.perDayEmpty, { month: monthWord })
  const height = 80
  return (
    <ChartFigure title={copy.perDay} label={label} sentence={label}>
      <div aria-hidden="true" className="grid">
        <div className="flex items-end gap-[2px]" style={{ height }}>
          {period.days.map((day) => {
            const future = day.day > today
            const value = dayCost(day)
            const bar = !future && value !== null && value > 0 && max > 0
            return (
              <span
                key={day.day}
                data-bar={future ? 'future' : bar ? 'cost' : 'empty'}
                className={`min-w-0 flex-1 rounded-t-[2px] ${
                  future
                    ? 'border border-dashed border-[var(--muted)] opacity-50'
                    : bar
                      ? 'bg-[var(--ink)]'
                      : ''
                }`}
                style={{
                  height: future
                    ? '4px' // designs/energy §11: a 4 pt dashed stub, never a bar
                    : bar
                      ? `${Math.max(2, Math.round(((value as number) / max) * height))}px`
                      : 0,
                }}
              />
            )
          })}
        </div>
        <div className="h-px bg-[var(--hair)]" />
        <div className="mt-1 flex justify-between text-xs text-[var(--muted)] tabular-nums">
          {dayTicks(period.days.length).map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
    </ChartFigure>
  )
}

/** This year's months next to last year's, in euro, linking to Usage › Year. */
function PerMonthChart({
  groupSlug,
  month,
  thisMonth,
  today,
  method,
}: {
  groupSlug: string
  month: string
  thisMonth: string
  today: string
  method: Method
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.costs
  const year = Number(month.slice(0, 4))
  const years = useEnergyYears(groupSlug, year, today)
  const withoutNet = method === 'without'
  const current = years.current.map((each) => monthFigure(each, 'euro', withoutNet))
  const previous = years.previous.map((each) =>
    monthFigure(each, 'euro', withoutNet),
  )
  const runningIndex =
    Number(thisMonth.slice(0, 4)) === year
      ? Number(thisMonth.slice(5, 7)) - 1
      : null
  const pairs = yearPairHeights(previous, current, runningIndex)
  const compared = compareYears(previous, current, runningIndex)
  const sentence = compared
    ? fmt(messages.energy.usage.yearLine, {
        from: monthName(year, compared.fromIndex, locale),
        to: monthName(year, compared.toIndex, locale),
        current: formatEnergyEuro(compared.current, locale),
        last: formatEnergyEuro(compared.previous, locale),
      })
    : messages.energy.usage.yearNoCompare
  const label = compared
    ? fmt(messages.energy.usage.yearLabelEur, {
        year,
        previous: year - 1,
        from: monthName(year, compared.fromIndex, locale),
        to: monthName(year, compared.toIndex, locale),
        current: formatEnergyEuro(compared.current, locale),
        last: formatEnergyEuro(compared.previous, locale),
      })
    : sentence
  return (
    <ChartFigure
      title={fmt(copy.perMonth, { year, previous: year - 1 })}
      aside={
        <Link
          {...linkTo('energyUsage')}
          search={{ range: 'year' }}
          className="text-sm text-[var(--accent-text)] no-underline hover:underline"
        >
          {copy.yearLink} ›
        </Link>
      }
      label={label}
      sentence={sentence}
      legend={yearLegend(messages, year, runningIndex !== null)}
    >
      <YearPairBars
        pairs={pairs}
        height={100}
        labels={Array.from({ length: 12 }, (_, index) =>
          monthName(year, index, locale, 'monthShort'),
        )}
      />
    </ChartFigure>
  )
}

function Breakdown({
  period,
  cost,
  method,
}: {
  period: EnergyPeriod
  cost: EnergyCostTotals
  method: Method
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.costs
  const totals = period.totals
  const euro = (cents: number) => formatEnergyEuro(cents, locale)
  const kwh = (value: number) => formatEnergyNumber(value, locale)
  const days =
    totals.daysWithData === 1
      ? copy.day
      : fmt(copy.days, { count: totals.daysWithData })
  const netted =
    method === 'with' &&
    period.netMeteringChoice &&
    netMeteringPossibleIn(period.days[0]?.day.slice(0, 7) ?? '')
  return (
    <RowList>
      <ValueRow
        label={copy.lineImport}
        sub={`${kwh(totals.importKwh)} ${messages.energy.units.kWh}`}
        value={euro(cost.importCents)}
      />
      {period.channels.gridExport ? (
        <ValueRow
          label={copy.lineExport}
          sub={fmt(netted ? copy.lineExportNetted : copy.lineExportPriced, {
            kwh: kwh(totals.exportKwh),
          })}
          value={euro(cost.exportCents)}
        />
      ) : null}
      {period.channels.gas ? (
        <ValueRow
          label={copy.lineGas}
          sub={
            totals.gasM3 === null
              ? undefined
              : `${formatEnergyNumber(totals.gasM3, locale)} ${messages.energy.units.m3}`
          }
          value={euro(cost.gasCents)}
        />
      ) : null}
      <ValueRow label={copy.lineFixed} sub={days} value={euro(cost.fixedCents)} />
      <ValueRow
        label={copy.lineCredit}
        sub={days}
        value={euro(cost.creditCents)}
      />
    </RowList>
  )
}
