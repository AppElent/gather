import { addDays } from '@gather/core/civil-date'
import { addEnergyMonths } from '@gather/core/energy'
import {
  capitalise,
  compareYears,
  formatEnergyDate,
  formatEnergyEuro,
  formatEnergyNumber,
  monthName,
  signedDifference,
  yearComparisonNote,
  yearPairHeights,
} from '@gather/core/energy-present'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, type Messages, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { daySeries, dayTicks, HOUR_TICKS, hourSeries } from './energySeries'
import {
  ChartFigure,
  type EnergyPeriod,
  energyTrail,
  Facts,
  MirrorBars,
  mirrorLegend,
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

export type EnergyUsageRange = 'day' | 'month' | 'year'

/**
 * Usage: a day per hour, a month per day, a year per month next to the year
 * before (APP-494, design section 11.2).
 *
 * A site with only typed readings has days and months, never hours: its day
 * shows the day's estimate and says why there is no hour chart.
 */
export function EnergyUsagePage({
  initialRange = 'day',
}: {
  initialRange?: EnergyUsageRange
}) {
  const group = useRequiredCurrentGroup()
  const { messages, locale } = useI18n()
  const copy = messages.energy.usage
  const { today, month: thisMonth, now } = useEnergyToday()
  const thisYear = Number(today.slice(0, 4))
  const [range, setRange] = useState<EnergyUsageRange>(initialRange)
  const [day, setDay] = useState(today)
  const [month, setMonth] = useState(thisMonth)
  const [year, setYear] = useState(thisYear)

  const stepper =
    range === 'day' ? (
      <PeriodStepper
        label={capitalise(formatEnergyDate(day, locale, 'weekdayDayMonth'))}
        previousLabel={copy.previousDay}
        nextLabel={copy.nextDay}
        onPrevious={() => setDay(addDays(day, -1))}
        onNext={() => setDay(addDays(day, 1))}
        canNext={day < today}
      />
    ) : range === 'month' ? (
      <PeriodStepper
        label={monthTitle(month, locale, true)}
        previousLabel={copy.previousMonth}
        nextLabel={copy.nextMonth}
        onPrevious={() => setMonth(addEnergyMonths(month, -1))}
        onNext={() => setMonth(addEnergyMonths(month, 1))}
        canNext={month < thisMonth}
      />
    ) : (
      <PeriodStepper
        label={String(year)}
        previousLabel={copy.previousYear}
        nextLabel={copy.nextYear}
        onPrevious={() => setYear(year - 1)}
        onNext={() => setYear(year + 1)}
        canNext={year < thisYear}
      />
    )

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Breadcrumbs trail={energyTrail(messages, copy.title)} className="mb-0" />
      <h2 className="m-0 text-2xl font-semibold">{copy.title}</h2>
      <Segmented
        label={copy.rangeLabel}
        value={range}
        onChange={setRange}
        options={[
          { value: 'day', label: copy.day },
          { value: 'month', label: copy.month },
          { value: 'year', label: copy.year },
        ]}
      />
      {stepper}
      {range === 'day' ? (
        <DayView groupSlug={group.slug} day={day} today={today} now={now} />
      ) : range === 'month' ? (
        <MonthView groupSlug={group.slug} month={month} today={today} />
      ) : (
        <YearView
          groupSlug={group.slug}
          year={year}
          thisMonth={thisMonth}
          today={today}
        />
      )}
      <RowList>
        <NavRow
          link={linkTo('energyCosts')}
          label={copy.costsRow}
          sub={copy.costsRowSub}
        />
      </RowList>
    </div>
  )
}

function Loading() {
  return (
    <div className="h-40 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]" />
  )
}

function TotalCard({
  caption,
  total,
  unit,
  note,
}: {
  caption: string
  total: string
  unit?: string
  note?: string | null
}) {
  return (
    <section aria-label={caption} className={WASH}>
      <span className="text-sm text-[var(--muted)]">{caption}</span>
      <span className="flex flex-wrap items-baseline gap-2">
        <span className={NUMERAL}>{total}</span>
        {unit ? (
          <span className="text-base text-[var(--muted)]">{unit}</span>
        ) : null}
      </span>
      {note ? <p className="m-0 text-sm">{note}</p> : null}
    </section>
  )
}

/** What came from solar and battery: what was used beyond the grid's share. */
function fromSolarKwh(period: EnergyPeriod): number {
  return Math.max(0, period.totals.consumptionKwh - period.totals.importKwh)
}

/** The facts a period has; a fact needing a channel the site lacks is left out. */
function factsOf(period: EnergyPeriod, messages: Messages, locale: string) {
  const copy = messages.energy.usage
  const kwh = (value: number) =>
    `${formatEnergyNumber(value, locale)} ${messages.energy.units.kWh}`
  const cost = period.totals.cost
  return [
    { label: copy.factFromGrid, value: kwh(period.totals.importKwh) },
    ...(period.channels.solar
      ? [{ label: copy.factFromSolar, value: kwh(fromSolarKwh(period)) }]
      : []),
    ...(period.channels.gridExport
      ? [{ label: copy.factExported, value: kwh(period.totals.exportKwh) }]
      : []),
    {
      // The total holds gas too once the site has a gas meter.
      label: period.channels.gas ? copy.factCostWithGas : copy.factCost,
      value: cost
        ? formatEnergyEuro(cost.totalCents, locale)
        : copy.costNotAvailable,
    },
    ...(period.channels.gas && period.totals.gasM3 !== null
      ? [
          {
            label: copy.factGas,
            value: `${formatEnergyNumber(period.totals.gasM3, locale)} ${messages.energy.units.m3}`,
          },
        ]
      : []),
  ]
}

function DayView({
  groupSlug,
  day,
  today,
  now,
}: {
  groupSlug: string
  day: string
  today: string
  now: number
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.usage
  const period = useQuery(api.energyUsage.day, { groupSlug, day, today })
  if (period === undefined) return <Loading />
  if (period === null) {
    return <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
  }
  const date = capitalise(formatEnergyDate(day, locale, 'weekdayDayMonth'))
  const showSolar = period.channels.solar
  const hourly = period.hasHourly
  // A day no reading reaches yet has no figure: a dash, never 0.0 kWh.
  const hasData = period.totals.daysWithData > 0
  return (
    <>
      <TotalCard
        caption={fmt(day === today ? copy.todayCaption : copy.dayCaption, {
          date,
        })}
        total={
          hasData ? formatEnergyNumber(period.totals.consumptionKwh, locale) : '—'
        }
        unit={hasData ? copy.used : undefined}
        note={
          !hasData
            ? copy.chartEmpty
            : showSolar
              ? fmt(copy.noteDaySolar, {
                  kwh: formatEnergyNumber(fromSolarKwh(period), locale),
                })
              : null
        }
      />
      {hourly ? (
        <HourChart period={period} now={now} />
      ) : (
        <p className="m-0 text-sm text-[var(--muted)]">{copy.noHours}</p>
      )}
      {hourly && period.channels.batterySoc ? (
        <ChargeChart period={period} isToday={day === today} />
      ) : null}
      {hasData ? <Facts facts={factsOf(period, messages, locale)} /> : null}
      {period.totals.estimated ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {copy.estimatedNote}
        </p>
      ) : null}
    </>
  )
}

function HourChart({ period, now }: { period: EnergyPeriod; now: number }) {
  const { messages, locale } = useI18n()
  const { slots, label } = hourSeries(period, now, messages, locale)
  const showSolar = period.channels.solar
  return (
    <ChartFigure
      title={messages.energy.usage.perHour}
      aside={
        <span className="text-xs text-[var(--muted)]">
          {messages.energy.units.kWh}
        </span>
      }
      label={label}
      sentence={label}
      legend={mirrorLegend(messages, showSolar)}
    >
      <MirrorBars
        slots={slots}
        upHeight={96}
        downHeight={72}
        showDown={showSolar}
        ticks={HOUR_TICKS}
      />
    </ChartFigure>
  )
}

/** The battery's state of charge through the day: a line over a light area. */
function ChargeChart({
  period,
  isToday,
}: {
  period: EnergyPeriod
  isToday: boolean
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.usage
  const count = Math.max(1, period.hours.length - 1)
  const points = period.hours
    .map((hour, index) =>
      hour.socPercent === null
        ? null
        : {
            x: (index / count) * 240,
            y: 100 - Math.min(100, Math.max(0, hour.socPercent)),
            percent: hour.socPercent,
          },
    )
    .filter((point) => point !== null)
  if (points.length === 0) return null
  const values = points.map((point) => point.percent)
  const low = Math.round(Math.min(...values))
  const high = Math.round(Math.max(...values))
  const last = points[points.length - 1] as (typeof points)[number]
  const first = points[0] as (typeof points)[number]
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${first.x},100 ${line} ${last.x},100`
  const date = formatEnergyDate(period.days[0]?.day ?? '', locale, 'dayMonth')
  const label = fmt(copy.socLabel, { date, low, high })
  return (
    <ChartFigure
      title={copy.socTitle}
      aside={
        isToday ? (
          <span className="text-xs text-[var(--muted)] tabular-nums">
            {fmt(copy.socNow, { percent: Math.round(last.percent) })}
          </span>
        ) : null
      }
      label={label}
      sentence={label}
    >
      <div aria-hidden="true" className="flex gap-2">
        <div className="flex h-[100px] w-7 shrink-0 flex-col justify-between text-right text-xs leading-none text-[var(--muted)] tabular-nums">
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          <svg
            viewBox="0 0 240 100"
            preserveAspectRatio="none"
            className="block h-[100px] w-full"
          >
            <line x1="0" y1="1" x2="240" y2="1" stroke="var(--hair)" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="50" x2="240" y2="50" stroke="var(--hair)" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="99" x2="240" y2="99" stroke="var(--muted)" vectorEffect="non-scaling-stroke" />
            <polygon points={area} fill="var(--home-fill)" fillOpacity="0.18" />
            <polyline
              points={line}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="flex justify-between text-xs text-[var(--muted)] tabular-nums">
            {HOUR_TICKS.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </div>
      </div>
    </ChartFigure>
  )
}

function MonthView({
  groupSlug,
  month,
  today,
}: {
  groupSlug: string
  month: string
  today: string
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.usage
  const period = useQuery(api.energyUsage.month, { groupSlug, month, today })
  const previous = useQuery(api.energyUsage.month, {
    groupSlug,
    month: addEnergyMonths(month, -1),
    today,
  })
  if (period === undefined) return <Loading />
  if (period === null) {
    return <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
  }
  const totals = period.totals
  const average =
    totals.daysWithData > 0 ? totals.consumptionKwh / totals.daysWithData : null
  const previousAverage =
    previous && previous.totals.daysWithData > 0
      ? previous.totals.consumptionKwh / previous.totals.daysWithData
      : null
  const note =
    average === null
      ? null
      : previousAverage === null
        ? fmt(copy.noteMonthAverage, { kwh: formatEnergyNumber(average, locale) })
        : fmt(copy.noteMonthPrevious, {
            kwh: formatEnergyNumber(average, locale),
            previous: monthTitle(addEnergyMonths(month, -1), locale),
            previousKwh: formatEnergyNumber(previousAverage, locale),
          })
  const { slots, label } = daySeries(period, today, messages, locale)
  const showSolar = period.channels.solar
  return (
    <>
      <TotalCard
        caption={
          totals.firstDay && totals.lastDay
            ? fmt(copy.monthCaption, {
                from: formatEnergyDate(totals.firstDay, locale, 'dayMonth'),
                to: formatEnergyDate(totals.lastDay, locale, 'dayMonth'),
              })
            : monthTitle(month, locale, true)
        }
        total={formatEnergyNumber(totals.consumptionKwh, locale)}
        unit={copy.used}
        note={note}
      />
      <ChartFigure
        title={fmt(copy.perDayIn, {
          month: formatEnergyDate(month, locale, 'month'),
        })}
        aside={
          <span className="text-xs text-[var(--muted)]">
            {messages.energy.units.kWh}
          </span>
        }
        label={label}
        sentence={label}
        legend={mirrorLegend(messages, showSolar)}
      >
        <MirrorBars
          slots={slots}
          upHeight={96}
          downHeight={72}
          showDown={showSolar}
          ticks={dayTicks(period.days.length)}
        />
      </ChartFigure>
      <Facts facts={factsOf(period, messages, locale)} />
      {totals.estimated ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {copy.estimatedNote}
        </p>
      ) : null}
    </>
  )
}

function YearView({
  groupSlug,
  year,
  thisMonth,
  today,
}: {
  groupSlug: string
  year: number
  thisMonth: string
  today: string
}) {
  const { messages, locale } = useI18n()
  const copy = messages.energy.usage
  const [unit, setUnit] = useState<'kwh' | 'euro'>('kwh')
  const years = useEnergyYears(groupSlug, year, today)
  if (years.current.every((each) => each === undefined)) return <Loading />
  if (years.current.every((each) => each === null)) {
    return <p className="m-0 text-sm">{messages.energy.empty.summary}</p>
  }
  const current = years.current.map((each) => monthFigure(each, unit))
  const previous = years.previous.map((each) => monthFigure(each, unit))
  const runningIndex =
    Number(thisMonth.slice(0, 4)) === year
      ? Number(thisMonth.slice(5, 7)) - 1
      : null
  const pairs = yearPairHeights(previous, current, runningIndex)
  const compared = compareYears(previous, current, runningIndex)
  const show = (value: number) =>
    unit === 'kwh'
      ? `${formatEnergyNumber(value, locale, 0)} ${messages.energy.units.kWh}`
      : formatEnergyEuro(value, locale)
  const withData = current
    .map((value, index) => (value === null ? null : index))
    .filter((index) => index !== null)
  const firstIndex = withData[0]
  const lastIndex = withData[withData.length - 1]
  const total = current.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const estimated = years.current.some((each) => each?.totals.estimated)
  const name = (index: number) => monthName(year, index, locale)

  const sentence = compared
    ? fmt(copy.yearLine, {
        from: name(compared.fromIndex),
        to: name(compared.toIndex),
        current: show(compared.current),
        last: show(compared.previous),
      })
    : copy.yearNoCompare
  const label = compared
    ? fmt(unit === 'kwh' ? copy.yearLabelKwh : copy.yearLabelEur, {
        year,
        previous: year - 1,
        from: name(compared.fromIndex),
        to: name(compared.toIndex),
        current:
          unit === 'kwh'
            ? formatEnergyNumber(compared.current, locale, 0)
            : formatEnergyEuro(compared.current, locale),
        last:
          unit === 'kwh'
            ? formatEnergyNumber(compared.previous, locale, 0)
            : formatEnergyEuro(compared.previous, locale),
      })
    : sentence

  return (
    <>
      <TotalCard
        caption={
          firstIndex !== undefined && lastIndex !== undefined
            ? fmt(copy.yearCaption, {
                from: capitalise(name(firstIndex)),
                to: name(lastIndex),
                year,
              })
            : String(year)
        }
        total={
          unit === 'kwh'
            ? formatEnergyNumber(total, locale, 0)
            : formatEnergyEuro(total, locale)
        }
        unit={unit === 'kwh' ? copy.used : undefined}
        note={
          compared
            ? yearComparisonNote(compared.percent, year - 1, messages.energy)
            : null
        }
      />
      <Segmented
        label={copy.unitLabel}
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'kwh', label: copy.kwh },
          { value: 'euro', label: copy.euro },
        ]}
      />
      <ChartFigure
        title={fmt(copy.perMonth, { year, previous: year - 1 })}
        aside={
          <span className="text-xs text-[var(--muted)]">
            {unit === 'kwh' ? messages.energy.units.kWh : '€'}
          </span>
        }
        label={label}
        sentence={sentence}
        legend={yearLegend(messages, year, runningIndex !== null)}
      >
        <YearPairBars
          pairs={pairs}
          height={130}
          labels={Array.from({ length: 12 }, (_, index) =>
            monthName(year, index, locale, 'monthShort'),
          )}
        />
      </ChartFigure>
      {compared ? (
        <RowList>
          <ValueRow
            label={fmt(copy.rowThisYear, {
              from: name(compared.fromIndex),
              to: name(compared.toIndex),
              year,
            })}
            sub={unit === 'kwh' ? copy.rowThisYearSub : copy.rowThisYearSubEur}
            value={show(compared.current)}
          />
          <ValueRow
            label={fmt(copy.rowThisYear, {
              from: name(compared.fromIndex),
              to: name(compared.toIndex),
              year: year - 1,
            })}
            sub={copy.rowLastYearSub}
            value={show(compared.previous)}
          />
          <ValueRow
            label={copy.rowDifference}
            sub={
              yearComparisonNote(compared.percent, year - 1, messages.energy) ??
              undefined
            }
            value={signedDifference(compared.difference, show)}
          />
        </RowList>
      ) : null}
      {estimated ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {copy.estimatedNote}
        </p>
      ) : null}
    </>
  )
}
