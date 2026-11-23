/**
 * Usage (APP-494, designs/energy section 11.2): a day, a month or a year of
 * what the home used, against what the roof made.
 *
 * Day is per hour from an hourly source, with the battery's state of charge
 * when the site measures it, then four facts. A site with only typed
 * readings has no hours: its day is the day's estimate, and the screen says
 * why there is no hour chart. Month is per day. Year sets each month next to
 * the same month a year before, in kWh or euro, and compares the completed
 * months both years have.
 *
 * Every chart is one VoiceOver element that states the answer, with the same
 * sentence under it for everyone.
 */
import { addDays, amsterdamIsoDate } from '@gather/core/civil-date'
import {
  addEnergyMonths,
  energyMonthDays,
  energyMonthOf,
} from '@gather/core/energy'
import {
  capitalise,
  compareYears,
  formatEnergyDate,
  formatEnergyEuro,
  formatEnergyNumber,
  monthName,
  signedDifference,
  yearComparisonNote,
} from '@gather/core/energy-present'
import type { FunctionReturnType } from 'convex/server'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { type EnergyFact, EnergyFactGrid } from './components/energy-fact-grid'
import {
  EnergyChartLegend,
  EnergyMirrorChart,
  energySolarColour,
} from './components/energy-mirror-chart'
import { EnergyPeriodStepper } from './components/energy-period-stepper'
import { EnergySocChart } from './components/energy-soc-chart'
import { EnergyTotalCard } from './components/energy-total-card'
import { EnergyYearChart } from './components/energy-year-chart'
import { daySlots, hourSlots } from './energy-chart-series'
import {
  dayChartSentence,
  dayTicks,
  HOUR_TICKS,
  hourChartSentence,
} from './energy-chart-text'
import { useEnergyYear } from './use-energy-year'

export type EnergyUsageRange = 'day' | 'month' | 'year'
export type EnergyUsageUnit = 'kwh' | 'euro'

type Period = NonNullable<FunctionReturnType<typeof api.energyUsage.month>>

export function EnergyUsageScreen({
  initialRange = 'day',
  initialUnit = 'kwh',
  initialYear,
}: {
  initialRange?: EnergyUsageRange
  initialUnit?: EnergyUsageUnit
  initialYear?: number
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const today = amsterdamIsoDate()
  const thisYear = Number(today.slice(0, 4))
  const [range, setRange] = useState<EnergyUsageRange>(initialRange)
  const [day, setDay] = useState(today)
  const [month, setMonth] = useState(energyMonthOf(today))
  const [year, setYear] = useState(
    initialYear && initialYear <= thisYear ? initialYear : thisYear,
  )

  const stepper =
    range === 'day'
      ? {
          label: capitalise(formatEnergyDate(day, locale, 'weekdayDayMonth')),
          previousLabel: words.usage.previousDay,
          nextLabel: words.usage.nextDay,
          onPrevious: () => setDay(addDays(day, -1)),
          onNext: () => setDay(addDays(day, 1)),
          canGoNext: day < today,
        }
      : range === 'month'
        ? {
            label: capitalise(formatEnergyDate(month, locale, 'monthYear')),
            previousLabel: words.usage.previousMonth,
            nextLabel: words.usage.nextMonth,
            onPrevious: () => setMonth(addEnergyMonths(month, -1)),
            onNext: () => setMonth(addEnergyMonths(month, 1)),
            canGoNext: month < energyMonthOf(today),
          }
        : {
            label: String(year),
            previousLabel: words.usage.previousYear,
            nextLabel: words.usage.nextYear,
            onPrevious: () => setYear(year - 1),
            onNext: () => setYear(year + 1),
            canGoNext: year < thisYear,
          }

  const costsMonth =
    range === 'day' ? energyMonthOf(day) : range === 'month' ? month : undefined

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: words.usage.title,
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Segmented<EnergyUsageRange>
          options={[
            { value: 'day', label: words.usage.day },
            { value: 'month', label: words.usage.month },
            { value: 'year', label: words.usage.year },
          ]}
          value={range}
          onChange={setRange}
        />
        <EnergyPeriodStepper testID="energy-usage-period" {...stepper} />
        {range === 'day' ? (
          <DayView day={day} today={today} />
        ) : range === 'month' ? (
          <MonthView month={month} today={today} />
        ) : (
          <YearView year={year} today={today} initialUnit={initialUnit} />
        )}
        <InsetList>
          <InsetRow
            testID="energy-usage-costs"
            title={words.usage.costsRow}
            subtitle={words.usage.costsRowSub}
            chevron
            onPress={() =>
              router.push(
                moduleHref(
                  '/all/energy/costs',
                  costsMonth ? { month: costsMonth } : undefined,
                ),
              )
            }
          />
        </InsetList>
      </ScrollView>
    </>
  )
}

/** The facts under a day or a month: those the site has channels for. */
function periodFacts(
  period: Pick<Period, 'totals' | 'channels'>,
  locale: string,
  words: ReturnType<typeof useI18n>['t']['energy'],
): EnergyFact[] {
  const totals = period.totals
  const kwh = (value: number) => formatEnergyNumber(value, locale, 1)
  const unit = words.units.kWh
  const facts: EnergyFact[] = [
    {
      key: 'grid',
      label: words.usage.factFromGrid,
      value: kwh(totals.importKwh),
      unit,
    },
  ]
  if (period.channels.solar) {
    facts.push({
      key: 'solar',
      label: words.usage.factFromSolar,
      value: kwh(Math.max(0, totals.consumptionKwh - totals.importKwh)),
      unit,
    })
  }
  if (period.channels.gridExport) {
    facts.push({
      key: 'exported',
      label: words.usage.factExported,
      value: kwh(totals.exportKwh),
      unit,
    })
  }
  // The total holds gas too once the site has a gas meter.
  const costLabel = period.channels.gas
    ? words.usage.factCostWithGas
    : words.usage.factCost
  facts.push(
    totals.cost && totals.costStatus === 'ok'
      ? {
          key: 'cost',
          label: costLabel,
          value: formatEnergyEuro(totals.cost.totalCents, locale),
        }
      : {
          key: 'cost',
          label: costLabel,
          value: words.usage.costNotAvailable,
        },
  )
  return facts
}

function DayView({ day, today }: { day: string; today: string }) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const period = useQuery(api.energyUsage.day, {
    groupSlug: group.slug,
    day,
    today,
  })
  if (period === undefined) {
    return <LoadingSkeleton rows={4} label={t.actions.loading} />
  }
  if (period === null) {
    return (
      <Text style={[TYPE.body, { color: tokens.muted }]}>
        {words.refusals.notFound}
      </Text>
    )
  }
  const totals = period.totals
  const date = formatEnergyDate(day, locale, 'dayMonth')
  const caption =
    day === today
      ? fmt(words.usage.todayCaption, { date })
      : fmt(words.usage.dayCaption, { date })
  const hasData = totals.daysWithData > 0
  const notes: string[] = []
  if (!hasData) notes.push(words.usage.chartEmpty)
  else if (period.channels.solar) {
    notes.push(
      fmt(words.usage.noteDaySolar, {
        kwh: formatEnergyNumber(
          Math.max(0, totals.consumptionKwh - totals.importKwh),
          locale,
          1,
        ),
      }),
    )
  }
  if (totals.estimated) notes.push(words.usage.estimatedNote)

  const withSolar = period.channels.solar
  const slots = period.hasHourly
    ? hourSlots(day, period.hours, Date.now(), withSolar)
    : []
  const sentence = period.hasHourly
    ? hourChartSentence(slots, day, words, locale)
    : ''
  const soc = period.hasHourly && period.channels.batterySoc
    ? slots.map(
        (slot) =>
          period.hours.find((hour) => hour.hourStart === slot.hourStart)
            ?.socPercent ?? null,
      )
    : null
  const socKnown = soc?.filter((value): value is number => value !== null) ?? []

  return (
    <>
      <EnergyTotalCard
        testID="energy-usage-total"
        caption={caption}
        value={hasData ? formatEnergyNumber(totals.consumptionKwh, locale, 1) : null}
        unit={words.usage.used}
        notes={notes}
      />
      {period.hasHourly ? (
        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <ChartHead title={words.usage.perHour} unit={words.units.kWh} />
          <EnergyMirrorChart
            testID="energy-usage-hours"
            slots={slots}
            upHeight={96}
            downHeight={72}
            label={sentence}
            ticks={HOUR_TICKS}
          />
          <MirrorLegend withSolar={withSolar} />
          <Text style={[TYPE.subhead, { color: tokens.ink }]}>{sentence}</Text>
        </View>
      ) : (
        <View
          testID="energy-usage-no-hours"
          style={[styles.card, { backgroundColor: tokens.surface }]}
        >
          <Text style={[TYPE.subhead, { color: tokens.ink }]}>
            {words.usage.noHours}
          </Text>
        </View>
      )}
      {soc && socKnown.length > 0 ? (
        <SocCard
          day={day}
          today={today}
          percents={soc}
          low={Math.min(...socKnown)}
          high={Math.max(...socKnown)}
          now={socKnown[socKnown.length - 1] ?? null}
        />
      ) : null}
      {hasData ? <EnergyFactGrid facts={periodFacts(period, locale, words)} /> : null}
    </>
  )
}

function SocCard({
  day,
  today,
  percents,
  low,
  high,
  now,
}: {
  day: string
  today: string
  percents: readonly (number | null)[]
  low: number
  high: number
  now: number | null
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.energy
  const label = fmt(words.usage.socLabel, {
    date: formatEnergyDate(day, locale, 'dayMonth'),
    low: Math.round(low),
    high: Math.round(high),
  })
  return (
    <View
      testID="energy-usage-soc"
      style={[styles.card, { backgroundColor: tokens.surface }]}
    >
      <View style={styles.head}>
        <Text style={[TYPE.subhead, styles.flex, { color: tokens.muted }]}>
          {words.usage.socTitle}
        </Text>
        {day === today && now !== null ? (
          <Text style={[TYPE.footnote, TABULAR, { color: tokens.muted }]}>
            {fmt(words.usage.socNow, { percent: Math.round(now) })}
          </Text>
        ) : null}
      </View>
      <EnergySocChart percents={percents} label={label} ticks={HOUR_TICKS} />
      <Text style={[TYPE.subhead, { color: tokens.ink }]}>{label}</Text>
    </View>
  )
}

function MonthView({ month, today }: { month: string; today: string }) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const period = useQuery(api.energyUsage.month, {
    groupSlug: group.slug,
    month,
    today,
  })
  const before = useQuery(api.energyUsage.month, {
    groupSlug: group.slug,
    month: addEnergyMonths(month, -1),
    today,
  })
  if (period === undefined) {
    return <LoadingSkeleton rows={4} label={t.actions.loading} />
  }
  if (period === null) {
    return (
      <Text style={[TYPE.body, { color: tokens.muted }]}>
        {words.refusals.notFound}
      </Text>
    )
  }
  const totals = period.totals
  const days = energyMonthDays(month)
  const last = month === energyMonthOf(today) ? today : days[days.length - 1]
  const caption = fmt(words.usage.monthCaption, {
    from: formatEnergyDate(`${month}-01`, locale, 'dayMonth'),
    to: formatEnergyDate(last ?? `${month}-01`, locale, 'dayMonth'),
  })
  const hasData = totals.daysWithData > 0
  const notes: string[] = []
  if (!hasData) notes.push(words.usage.chartEmpty)
  else {
    const average = formatEnergyNumber(
      totals.consumptionKwh / totals.daysWithData,
      locale,
      1,
    )
    const earlier =
      before && before.totals.daysWithData > 0 ? before.totals : null
    notes.push(
      earlier
        ? fmt(words.usage.noteMonthPrevious, {
            kwh: average,
            previous: capitalise(
              formatEnergyDate(addEnergyMonths(month, -1), locale, 'month'),
            ),
            previousKwh: formatEnergyNumber(
              earlier.consumptionKwh / earlier.daysWithData,
              locale,
              1,
            ),
          })
        : fmt(words.usage.noteMonthAverage, { kwh: average }),
    )
  }
  if (totals.estimated) notes.push(words.usage.estimatedNote)

  const withSolar = period.channels.solar
  const slots = daySlots(period.days, today, withSolar)
  const sentence = dayChartSentence(slots, month, words, locale)

  return (
    <>
      <EnergyTotalCard
        testID="energy-usage-total"
        caption={caption}
        value={hasData ? formatEnergyNumber(totals.consumptionKwh, locale, 1) : null}
        unit={words.usage.used}
        notes={notes}
      />
      <View style={[styles.card, { backgroundColor: tokens.surface }]}>
        <ChartHead
          title={fmt(words.usage.perDayIn, {
            month: formatEnergyDate(month, locale, 'month'),
          })}
          unit={words.units.kWh}
        />
        <EnergyMirrorChart
          testID="energy-usage-days"
          slots={slots}
          upHeight={96}
          downHeight={72}
          label={sentence}
          ticks={dayTicks(slots.length)}
        />
        <MirrorLegend withSolar={withSolar} />
        <Text style={[TYPE.subhead, { color: tokens.ink }]}>{sentence}</Text>
      </View>
      {hasData ? <EnergyFactGrid facts={periodFacts(period, locale, words)} /> : null}
    </>
  )
}

function YearView({
  year,
  today,
  initialUnit,
}: {
  year: number
  today: string
  initialUnit: EnergyUsageUnit
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const [unit, setUnit] = useState<EnergyUsageUnit>(initialUnit)
  const series = useEnergyYear(group.slug, year, today)
  const values = unit === 'kwh' ? series.kwh : series.cents
  const figure = (value: number) =>
    unit === 'kwh'
      ? formatEnergyNumber(value, locale, 0)
      : formatEnergyEuro(value, locale)
  const unitWord = unit === 'kwh' ? words.units.kWh : undefined

  const known = values.current
    .map((value, index) => ({ value, index }))
    .filter((each): each is { value: number; index: number } => each.value !== null)
  const lastIndex = known[known.length - 1]?.index ?? null
  const total = known.reduce((sum, each) => sum + each.value, 0)
  const compared = compareYears(values.previous, values.current, series.runningIndex)
  const name = (index: number) => monthName(year, index, locale)

  const caption =
    lastIndex !== null
      ? fmt(words.usage.yearCaption, {
          from: name(known[0]?.index ?? 0),
          to: name(lastIndex),
          year,
        })
      : String(year)
  const notes: string[] = []
  if (known.length === 0 && !series.loading) notes.push(words.usage.chartEmpty)
  const comparison = compared
    ? yearComparisonNote(compared.percent, year - 1, words)
    : null
  if (comparison) notes.push(comparison)

  const yearLine = compared
    ? fmt(words.usage.yearLine, {
        from: name(compared.fromIndex),
        to: name(compared.toIndex),
        current: unitWord ? `${figure(compared.current)} ${unitWord}` : figure(compared.current),
        last: unitWord ? `${figure(compared.previous)} ${unitWord}` : figure(compared.previous),
      })
    : words.usage.yearNoCompare
  const label = compared
    ? fmt(unit === 'kwh' ? words.usage.yearLabelKwh : words.usage.yearLabelEur, {
        year,
        previous: year - 1,
        from: name(compared.fromIndex),
        to: name(compared.toIndex),
        current: figure(compared.current),
        last: figure(compared.previous),
      })
    : `${fmt(words.usage.perMonth, { year, previous: year - 1 })}. ${words.usage.yearNoCompare}`

  return (
    <>
      <Segmented<EnergyUsageUnit>
        options={[
          { value: 'kwh', label: words.usage.kwh },
          { value: 'euro', label: words.usage.euro },
        ]}
        value={unit}
        onChange={setUnit}
      />
      <EnergyTotalCard
        testID="energy-usage-total"
        caption={caption}
        value={known.length > 0 ? figure(total) : null}
        unit={unit === 'kwh' ? words.usage.used : undefined}
        notes={notes}
      />
      <View style={[styles.card, { backgroundColor: tokens.surface }]}>
        <ChartHead
          title={fmt(words.usage.perMonth, { year, previous: year - 1 })}
          unit={unit === 'kwh' ? words.units.kWh : words.usage.euro}
        />
        <EnergyYearChart
          testID="energy-usage-year"
          previous={values.previous}
          current={values.current}
          runningIndex={series.runningIndex}
          monthLabels={Array.from({ length: 12 }, (_, index) =>
            monthName(year, index, locale, 'monthShort')
              .charAt(0)
              .toLocaleUpperCase(locale),
          )}
          height={130}
          label={label}
        />
        <EnergyChartLegend
          items={[
            { label: String(year - 1), kind: 'fill', colour: tokens.muted },
            { label: String(year), kind: 'fill', colour: tokens.ink },
            ...(series.runningIndex !== null
              ? [
                  {
                    label: words.usage.legendRunning,
                    kind: 'outline' as const,
                    colour: tokens.ink,
                  },
                ]
              : []),
          ]}
        />
        <Text style={[TYPE.subhead, { color: tokens.ink }]}>{yearLine}</Text>
      </View>
      {compared ? (
        <InsetList testID="energy-usage-year-rows">
          <ValueRow
            key="this"
            title={fmt(words.usage.rowThisYear, {
              from: name(compared.fromIndex),
              to: name(compared.toIndex),
              year,
            })}
            subtitle={
              unit === 'kwh'
                ? words.usage.rowThisYearSub
                : words.usage.rowThisYearSubEur
            }
            value={unitWord ? `${figure(compared.current)} ${unitWord}` : figure(compared.current)}
          />
          <ValueRow
            key="last"
            title={fmt(words.usage.rowThisYear, {
              from: name(compared.fromIndex),
              to: name(compared.toIndex),
              year: year - 1,
            })}
            subtitle={words.usage.rowLastYearSub}
            value={unitWord ? `${figure(compared.previous)} ${unitWord}` : figure(compared.previous)}
          />
          <ValueRow
            key="difference"
            title={words.usage.rowDifference}
            subtitle={comparison ?? undefined}
            value={signedDifference(compared.difference, (size) =>
              unitWord ? `${figure(size)} ${unitWord}` : figure(size),
            )}
          />
        </InsetList>
      ) : null}
    </>
  )
}

function ChartHead({ title, unit }: { title: string; unit: string }) {
  const tokens = useTokens('home')
  return (
    <View style={styles.head}>
      <Text
        accessibilityRole="header"
        style={[TYPE.bodyStrong, styles.flex, { color: tokens.ink }]}
      >
        {title}
      </Text>
      <Text style={[TYPE.footnote, { color: tokens.muted }]}>{unit}</Text>
    </View>
  )
}

function MirrorLegend({ withSolar }: { withSolar: boolean }) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.energy
  return (
    <EnergyChartLegend
      items={[
        { label: words.usage.legendUsed, kind: 'fill', colour: tokens.ink },
        ...(withSolar
          ? [
              {
                label: words.usage.legendSolar,
                kind: 'fill' as const,
                colour: energySolarColour(tokens),
              },
            ]
          : []),
        {
          label: words.usage.legendFuture,
          kind: 'dashed',
          colour: tokens.hairStrong,
        },
      ]}
    />
  )
}

function ValueRow({
  title,
  subtitle,
  value,
}: {
  title: string
  subtitle?: string
  value: string
}) {
  const tokens = useTokens()
  return (
    <InsetRow
      title={title}
      subtitle={subtitle}
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      trailing={
        <Text style={[TYPE.bodyStrong, TABULAR, { color: tokens.ink }]}>
          {value}
        </Text>
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: SPACE[4] },
  card: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[4],
    paddingTop: 14,
    paddingBottom: SPACE[3],
    gap: SPACE[2],
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  flex: { flex: 1 },
})
