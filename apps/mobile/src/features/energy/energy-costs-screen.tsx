/**
 * Costs per month (APP-494, designs/energy sections 5 and 11.4): a month,
 * what it cost so far, each day, each month of the year next to the year
 * before, and what the total is made of.
 *
 * Before 2027 a contract with net metering can be shown with or without it:
 * without is what the same month costs once net metering ends on 1 January
 * 2027. From 2027 the choice is gone and every cost is without.
 *
 * A month without costs says why in words (no usage, no contract, prices not
 * in): never a made-up figure.
 */
import { amsterdamIsoDate } from '@gather/core/civil-date'
import {
  addEnergyMonths,
  energyCostDays,
  energyCostPeriod,
  energyMonthOf,
  forecastMonthCents,
  netMeteringPossibleIn,
} from '@gather/core/energy'
import {
  capitalise,
  compareYears,
  formatEnergyDate,
  formatEnergyEuro,
  formatEnergyNumber,
  highestCostDay,
  monthName,
} from '@gather/core/energy-present'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { EnergyDayBars } from './components/energy-day-bars'
import { EnergyChartLegend } from './components/energy-mirror-chart'
import { EnergyPeriodStepper } from './components/energy-period-stepper'
import { EnergyTotalCard } from './components/energy-total-card'
import { EnergyYearChart } from './components/energy-year-chart'
import { dayTicks } from './energy-chart-text'
import { contractSummary, costStatusSentence } from './energy-summary-text'
import { useEnergyYear } from './use-energy-year'

type Method = 'with' | 'without'

export function EnergyCostsScreen({ initialMonth }: { initialMonth?: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const router = useRouter()
  const words = t.energy
  const today = amsterdamIsoDate()
  const thisMonth = energyMonthOf(today)
  const [month, setMonth] = useState(
    initialMonth && initialMonth <= thisMonth ? initialMonth : thisMonth,
  )
  const [method, setMethod] = useState<Method>('with')
  const data = useQuery(api.energyUsage.month, {
    groupSlug: group.slug,
    month,
    today,
  })
  const before = useQuery(api.energyUsage.month, {
    groupSlug: group.slug,
    month: addEnergyMonths(month, -1),
    today,
  })
  const year = Number(month.slice(0, 4))
  const series = useEnergyYear(group.slug, year, today)

  const monthWord = formatEnergyDate(month, locale, 'month')
  const euro = (cents: number) => formatEnergyEuro(cents, locale)

  const body = () => {
    if (data === undefined) {
      return <LoadingSkeleton rows={4} label={t.actions.loading} />
    }
    if (data === null) {
      return (
        <Text style={[TYPE.body, { color: tokens.muted }]}>
          {words.refusals.notFound}
        </Text>
      )
    }
    const choice = data.netMeteringChoice
    const shown: Method = choice ? method : 'without'
    const after2026 = !netMeteringPossibleIn(month)
    const pick = (cost: typeof data.totals.cost, without: typeof data.totals.cost) =>
      shown === 'with' ? cost : without
    const totals = data.totals
    const fixedDays = energyCostDays(data.days)
    const cost = pick(totals.cost, totals.costWithoutNet)
    const status = totals.costStatus
    // The days the figure covers: fixed costs run per elapsed day, so to
    // today (or the month's end), not only to the last reading.
    const covered = energyCostPeriod(data.days)
    const caption = fmt(words.costs.range, {
      from: formatEnergyDate(
        covered?.from ?? totals.firstDay ?? `${month}-01`,
        locale,
        'dayMonth',
      ),
      to: formatEnergyDate(
        covered?.to ?? totals.lastDay ?? `${month}-01`,
        locale,
        'dayMonth',
      ),
    })

    const notes: string[] = []
    if (status !== 'ok' || !cost) {
      notes.push(
        costStatusSentence(status === 'ok' ? 'noPrices' : status, month, words, locale),
      )
    } else if (after2026) {
      notes.push(words.costs.noteFrom2027)
    } else if (shown === 'without' && choice) {
      const difference =
        (totals.costWithoutNet?.totalCents ?? 0) - (totals.cost?.totalCents ?? 0)
      notes.push(
        difference !== 0
          ? fmt(words.costs.noteWithout, {
              month: monthWord,
              difference: euro(Math.abs(difference)),
            })
          : fmt(words.costs.noteWithoutSame, { month: monthWord }),
      )
    } else {
      const earlier =
        before && before.totals.costStatus === 'ok'
          ? pick(before.totals.cost, before.totals.costWithoutNet)
          : null
      const previous = capitalise(
        formatEnergyDate(addEnergyMonths(month, -1), locale, 'month'),
      )
      const forecast =
        month === thisMonth
          ? forecastMonthCents(
              cost,
              totals.daysWithData - totals.costMissingDays,
              fixedDays,
              month,
            )
          : null
      if (earlier && forecast !== null) {
        notes.push(
          fmt(words.costs.noteWith, {
            previous,
            amount: euro(earlier.totalCents),
            month: monthWord,
            forecast: euro(forecast),
          }),
        )
      } else if (earlier) {
        notes.push(
          fmt(words.costs.notePrevious, { previous, amount: euro(earlier.totalCents) }),
        )
      } else if (forecast !== null) {
        notes.push(
          fmt(words.costs.noteForecast, { month: monthWord, forecast: euro(forecast) }),
        )
      }
    }
    if (status === 'ok' && totals.costMissingDays > 0) {
      notes.push(plural(locale, totals.costMissingDays, words.costs.missingDays))
    }
    if (totals.estimated) notes.push(words.costs.estimated)

    // Per day
    const bars = data.days.map((day) => {
      const dayCost =
        status === 'ok' ? pick(day.cost, day.costWithoutNet) : null
      return {
        key: day.day,
        value: dayCost ? dayCost.totalCents : null,
        future: day.day > today,
      }
    })
    const hasAnyBar = bars.some((bar) => bar.value !== null)
    const peak = highestCostDay(bars, (bar) => bar.value)
    const perDayLabel = !hasAnyBar
      ? fmt(words.costs.perDayEmpty, { month: monthWord })
      : peak
        ? fmt(words.costs.perDayLabel, {
            month: monthWord,
            day: formatEnergyDate(peak.item.key, locale, 'dayMonth'),
            amount: euro(peak.value),
          })
        : fmt(words.costs.perDayPlain, { month: monthWord })
    const perDayCaption = !hasAnyBar || peak ? perDayLabel : null

    // Per month, this year and the one before
    const yearCents = shown === 'with' ? series.cents : series.centsWithoutNet
    const compared = compareYears(
      yearCents.previous,
      yearCents.current,
      series.runningIndex,
    )
    const yearLine = compared
      ? fmt(words.usage.yearLine, {
          from: monthName(year, compared.fromIndex, locale),
          to: monthName(year, compared.toIndex, locale),
          current: euro(compared.current),
          last: euro(compared.previous),
        })
      : words.usage.yearNoCompare
    const yearLabel = compared
      ? fmt(words.usage.yearLabelEur, {
          year,
          previous: year - 1,
          from: monthName(year, compared.fromIndex, locale),
          to: monthName(year, compared.toIndex, locale),
          current: euro(compared.current),
          last: euro(compared.previous),
        })
      : `${fmt(words.costs.perMonth, { year, previous: year - 1 })}. ${words.usage.yearNoCompare}`

    const dayCount = (count: number) =>
      count === 1 ? words.costs.day : fmt(words.costs.days, { count })

    return (
      <>
        {choice ? (
          <Segmented<Method>
            options={[
              { value: 'with', label: words.costs.withNet },
              { value: 'without', label: words.costs.withoutNet },
            ]}
            value={method}
            onChange={setMethod}
          />
        ) : null}

        <EnergyTotalCard
          testID="energy-costs-total"
          caption={caption}
          value={status === 'ok' && cost ? euro(cost.totalCents) : null}
          notes={notes}
        />

        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <Text style={[TYPE.subhead, { color: tokens.muted }]}>
            {words.costs.perDay}
          </Text>
          <EnergyDayBars
            testID="energy-costs-days"
            bars={bars}
            height={80}
            label={perDayLabel}
            ticks={dayTicks(bars.length)}
          />
          {perDayCaption ? (
            <Text
              testID="energy-costs-days-caption"
              style={[TYPE.subhead, { color: tokens.ink }]}
            >
              {perDayCaption}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <View style={styles.head}>
            <Text style={[TYPE.subhead, styles.flex, { color: tokens.muted }]}>
              {fmt(words.costs.perMonth, { year, previous: year - 1 })}
            </Text>
            <Pressable
              testID="energy-costs-year-link"
              accessibilityRole="link"
              accessibilityLabel={words.costs.yearLink}
              hitSlop={12}
              onPress={() =>
                router.push(
                  moduleHref('/all/energy/usage', {
                    range: 'year',
                    unit: 'euro',
                    year: String(year),
                    month,
                  }),
                )
              }
              style={styles.link}
            >
              <Text style={[TYPE.footnote, { color: tokens.muted }]}>
                {words.costs.yearLink}
              </Text>
              <UI_ICONS.ChevronRight size={14} color={tokens.muted} strokeWidth={2.6} />
            </Pressable>
          </View>
          <EnergyYearChart
            testID="energy-costs-year"
            previous={yearCents.previous}
            current={yearCents.current}
            runningIndex={series.runningIndex}
            monthLabels={Array.from({ length: 12 }, (_, index) =>
              monthName(year, index, locale, 'monthShort').charAt(0).toLocaleUpperCase(locale),
            )}
            height={100}
            label={yearLabel}
          />
          <EnergyChartLegend
            items={[
              { label: String(year - 1), kind: 'fill', colour: tokens.muted },
              { label: String(year), kind: 'fill', colour: tokens.ink },
            ]}
          />
          <Text style={[TYPE.subhead, { color: tokens.ink }]}>{yearLine}</Text>
        </View>

        {cost ? (
          <InsetList testID="energy-costs-lines">
            {/* Unless the status is ok, only the fixed costs are known. */}
            {status === 'ok' ? (
              <CostLine key="import" label={words.costs.lineImport} cents={cost.importCents} />
            ) : null}
            {status === 'ok' && data.channels.gridExport ? (
              <CostLine
                key="export"
                label={words.costs.lineExport}
                sub={fmt(
                  shown === 'with'
                    ? words.costs.lineExportNetted
                    : words.costs.lineExportPriced,
                  { kwh: formatEnergyNumber(totals.exportKwh, locale) },
                )}
                cents={cost.exportCents}
              />
            ) : null}
            {status === 'ok' && data.channels.gas ? (
              <CostLine key="gas" label={words.costs.lineGas} cents={cost.gasCents} />
            ) : null}
            <CostLine
              key="fixed"
              label={words.costs.lineFixed}
              sub={dayCount(fixedDays)}
              cents={cost.fixedCents}
            />
            <CostLine
              key="credit"
              label={words.costs.lineCredit}
              sub={dayCount(fixedDays)}
              cents={cost.creditCents}
            />
          </InsetList>
        ) : null}

        <InsetList>
          <InsetRow
            testID="energy-costs-contract"
            title={words.contract.title}
            subtitle={
              data.contract
                ? contractSummary(data.contract, words, locale)
                : words.home.contractSubNone
            }
            chevron
            onPress={() => router.push(moduleHref('/all/energy/contract'))}
          />
        </InsetList>

        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.costs.vatNote}
        </Text>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: words.costs.title,
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
        <EnergyPeriodStepper
          testID="energy-costs-month"
          label={capitalise(formatEnergyDate(month, locale, 'monthYear'))}
          previousLabel={words.costs.previousMonth}
          nextLabel={words.costs.nextMonth}
          onPrevious={() => setMonth(addEnergyMonths(month, -1))}
          onNext={() => setMonth(addEnergyMonths(month, 1))}
          canGoNext={month < thisMonth}
        />
        {body()}
      </ScrollView>
    </>
  )
}

function CostLine({
  label,
  sub,
  cents,
}: {
  label: string
  sub?: string
  cents: number
}) {
  const tokens = useTokens()
  const { locale } = useI18n()
  const value = formatEnergyEuro(cents, locale)
  return (
    <InsetRow
      title={label}
      subtitle={sub}
      accessibilityLabel={[label, sub, value].filter(Boolean).join(', ')}
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
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flex: { flex: 1 },
  hint: { paddingHorizontal: 4 },
})
