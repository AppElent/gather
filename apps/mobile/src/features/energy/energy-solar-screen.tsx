/**
 * Solar and battery (APP-496, designs/energy sections 7 and 11.3): what the
 * roof made and the home used of it, what the battery earned, and what each
 * asset has paid back.
 *
 * Only a source with hours can tell. A site with typed readings says why
 * instead of showing zeros, and can still keep its panels and battery here.
 */
import { amsterdamIsoDate } from '@gather/core/civil-date'
import {
  type EnergySolarTotals,
  energyMonthOf,
  energyPayback,
  energySolarTotals,
} from '@gather/core/energy'
import {
  capitalise,
  type EnergySolarChartHour,
  energyAssetSpec,
  energyAssetsLine,
  energyAssetTotal,
  energyBatteryCard,
  energyPaybackText,
  energySelfSufficiencyChart,
  energySocNow,
  energySolarCard,
  energySolarHourChart,
  energyStoredLine,
  formatEnergyDate,
} from '@gather/core/energy-present'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import {
  NUMERAL_XL_MAX_SCALE,
  RADIUS,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../../theme/tokens'
import { Button } from '../../ui/button'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { SectionLabel } from '../../ui/section-label'
import { isAccessibilityTextSize } from '../../ui/text-scale'
import { EnergyChargeCard } from './components/energy-charge-card'
import { EnergyDayBars } from './components/energy-day-bars'
import { energySolarColour } from './components/energy-mirror-chart'
import { EnergyShareBar } from './components/energy-share-bar'
import { dayTicks, HOUR_TICKS } from './energy-chart-text'
import { useEnergyMinute } from './use-energy-minute'
import { type EnergySolarMonth, useEnergyPaybackDays } from './use-energy-payback'

type Range = 'today' | 'month'

export function EnergySolarScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const router = useRouter()
  const words = t.energy
  const now = useEnergyMinute()
  const today = amsterdamIsoDate(new Date(now))
  const month = energyMonthOf(today)
  const [range, setRange] = useState<Range>('today')
  const data = useQuery(api.energySolar.month, {
    groupSlug: group.slug,
    month,
    today,
  })
  const line = data
    ? energyAssetsLine(
        data.assets.map((each) => each.asset),
        words,
        locale,
      )
    : null

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: words.solar.title,
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
        {data === undefined ? (
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        ) : data === null ? (
          <Text style={[TYPE.body, { color: tokens.muted }]}>
            {words.refusals.notFound}
          </Text>
        ) : (
          <>
            <View>
              <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
                {data.siteName}
              </Text>
              {line ? (
                <Text style={[TYPE.subhead, { color: tokens.muted }]}>{line}</Text>
              ) : null}
            </View>
            {data.status === 'ok' ? (
              <>
                <Segmented<Range>
                  options={[
                    { value: 'today', label: words.solar.today },
                    {
                      value: 'month',
                      label: capitalise(formatEnergyDate(month, locale, 'month')),
                    },
                  ]}
                  value={range}
                  onChange={setRange}
                />
                <Figures
                  groupSlug={group.slug}
                  data={data}
                  range={range}
                  month={month}
                  today={today}
                  now={now}
                />
              </>
            ) : (
              <View
                testID="energy-solar-why"
                style={[styles.card, { backgroundColor: tokens.surface }]}
              >
                <Text
                  accessibilityRole="header"
                  style={[TYPE.title3, { color: tokens.ink }]}
                >
                  {data.status === 'noHourly'
                    ? words.solar.noHourlyTitle
                    : words.solar.noAssetsTitle}
                </Text>
                <Text style={[TYPE.body, { color: tokens.ink }]}>
                  {data.status === 'noHourly'
                    ? words.solar.noHourlyBody
                    : words.solar.noAssetsBody}
                </Text>
                <Button
                  testID="energy-solar-fix"
                  variant="secondary"
                  label={
                    data.status === 'noHourly'
                      ? words.site.nextConnect
                      : words.solar.openSources
                  }
                  onPress={() =>
                    router.push(
                      moduleHref(
                        data.status === 'noHourly'
                          ? '/all/energy/connect'
                          : '/all/energy/sources',
                      ),
                    )
                  }
                />
              </View>
            )}
            {data.assets.length > 0 ? (
              <Assets groupSlug={group.slug} data={data} today={today} />
            ) : null}
            <Button
              testID="energy-asset-add"
              variant="secondary"
              label={words.solar.add}
              onPress={() => router.push(moduleHref('/all/energy/asset'))}
            />
          </>
        )}
      </ScrollView>
    </>
  )
}

function Figures({
  groupSlug,
  data,
  range,
  month,
  today,
  now,
}: {
  groupSlug: string
  data: EnergySolarMonth
  range: Range
  month: string
  today: string
  now: number
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.energy
  const period = useQuery(api.energyUsage.day, { groupSlug, day: today, today })
  const totals = energySolarTotals(
    range === 'today' ? data.days.filter((each) => each.day === today) : data.days,
  )
  if (totals.producedKwh === null && totals.battery === null) {
    return (
      <Text style={[TYPE.body, { color: tokens.muted }]}>
        {range === 'today' ? words.solar.nothingToday : words.solar.nothingMonth}
      </Text>
    )
  }
  const hours = range === 'today' ? (period?.hours ?? null) : null
  return (
    <>
      <SunCards
        data={data}
        totals={totals}
        range={range}
        month={month}
        today={today}
        hours={hours}
        now={now}
      />
      <BatteryCard data={data} totals={totals} hours={hours} />
      {hours && data.batterySoc ? (
        <EnergyChargeCard day={today} today={today} hours={hours} now={now} />
      ) : null}
    </>
  )
}

function SunCards({
  data,
  totals,
  range,
  month,
  today,
  hours,
  now,
}: {
  data: EnergySolarMonth
  totals: EnergySolarTotals
  range: Range
  month: string
  today: string
  hours: readonly EnergySolarChartHour[] | null
  now: number
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const { fontScale } = useWindowDimensions()
  const words = t.energy
  const card = energySolarCard(totals, range, data.battery, words, locale)
  if (!card) return null
  const perHour = hours ? energySolarHourChart(hours, now, words, locale) : null
  const perDay =
    range === 'month'
      ? energySelfSufficiencyChart(data.days, month, today, words, locale)
      : null
  const stacked = isAccessibilityTextSize(fontScale)
  return (
    <>
      <View
        testID="energy-solar-sun"
        style={[styles.card, { backgroundColor: tokens.surface }]}
      >
        <CardTitle>{words.solar.sun}</CardTitle>
        <View style={stacked ? styles.factsStacked : styles.facts}>
          {card.facts.map((fact) => (
            <View
              key={fact.key}
              testID={`energy-solar-fact-${fact.key}`}
              accessible
              accessibilityLabel={`${fact.label}, ${fact.value} ${fact.unit}`}
              style={stacked ? undefined : styles.fact}
            >
              <Text style={[TYPE.footnote, { color: tokens.muted }]}>
                {fact.label}
              </Text>
              <Text
                maxFontSizeMultiplier={NUMERAL_XL_MAX_SCALE}
                style={[TYPE.numeralL, { color: tokens.ink }]}
              >
                {fact.value}
              </Text>
              <Text style={[TYPE.footnote, TABULAR, { color: tokens.muted }]}>
                {fact.unit}
              </Text>
            </View>
          ))}
        </View>
        {card.selfShare !== null ? (
          <View
            testID="energy-solar-split"
            accessible
            accessibilityRole="image"
            accessibilityLabel={card.barLabel ?? undefined}
            style={styles.split}
          >
            <View
              style={{ flex: card.selfShare, backgroundColor: tokens.ink }}
            />
            <View
              style={{
                flex: 1 - card.selfShare,
                backgroundColor: tokens.hairStrong,
              }}
            />
          </View>
        ) : null}
        <Text style={[TYPE.subhead, { color: tokens.ink }]}>
          {card.sentence ?? words.solar.noExport}
        </Text>
      </View>
      {perHour ? (
        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <CardTitle unit={words.units.kWh}>{words.solar.perHour}</CardTitle>
          <EnergyDayBars
            testID="energy-solar-hours"
            colour={energySolarColour(tokens)}
            bars={perHour.bars.map(asBar)}
            height={72}
            label={perHour.sentence}
            ticks={HOUR_TICKS}
          />
          <Text style={[TYPE.subhead, { color: tokens.ink }]}>
            {perHour.sentence}
          </Text>
        </View>
      ) : null}
      {perDay ? (
        <View style={[styles.card, { backgroundColor: tokens.surface }]}>
          <CardTitle unit={words.units.percent}>{words.solar.perDay}</CardTitle>
          <EnergyDayBars
            testID="energy-solar-days"
            colour={energySolarColour(tokens)}
            bars={perDay.bars.map(asBar)}
            height={80}
            average={perDay.average}
            label={perDay.sentence}
            ticks={dayTicks(perDay.bars.length)}
          />
          <Text style={[TYPE.subhead, { color: tokens.ink }]}>
            {perDay.sentence}
          </Text>
        </View>
      ) : null}
    </>
  )
}

const asBar = (bar: { key: string; height: number; future: boolean }) => ({
  key: bar.key,
  value: bar.height,
  future: bar.future,
})

function BatteryCard({
  data,
  totals,
  hours,
}: {
  data: EnergySolarMonth
  totals: EnergySolarTotals
  hours: readonly EnergySolarChartHour[] | null
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.energy
  const card = energyBatteryCard(totals, words, locale)
  if (!card) return null
  const percent = hours ? energySocNow(hours) : null
  const stored = energyStoredLine(
    percent,
    energyAssetTotal(
      data.assets.map((each) => each.asset),
      'battery',
    ),
    words,
    locale,
  )
  return (
    <View
      testID="energy-solar-battery"
      style={[styles.card, { backgroundColor: tokens.surface }]}
    >
      <CardTitle>{words.solar.battery}</CardTitle>
      {percent !== null ? (
        <View style={styles.soc}>
          <View style={styles.socLine}>
            <Text
              maxFontSizeMultiplier={NUMERAL_XL_MAX_SCALE}
              style={[TYPE.numeralXl, { color: tokens.ink }]}
            >
              {Math.round(percent)}%
            </Text>
            {stored ? (
              <Text style={[TYPE.subhead, TABULAR, { color: tokens.muted }]}>
                {stored}
              </Text>
            ) : null}
          </View>
          <EnergyShareBar share={percent / 100} />
        </View>
      ) : null}
      <View>
        {card.rows.map((row, index) => (
          <View
            key={row.key}
            accessible
            accessibilityLabel={`${row.label}, ${row.value}`}
            style={[
              styles.row,
              index > 0
                ? {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: tokens.hair,
                  }
                : null,
            ]}
          >
            <Text
              style={[row.strong ? TYPE.bodyStrong : TYPE.body, { color: tokens.ink }]}
            >
              {row.label}
            </Text>
            <Text
              style={[
                row.strong ? TYPE.bodyStrong : TYPE.body,
                TABULAR,
                styles.shrink,
                { color: tokens.ink },
              ]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      {card.note ? (
        <Text style={[TYPE.subhead, { color: tokens.ink }]}>{card.note}</Text>
      ) : null}
      {card.footnote ? (
        <Text style={[TYPE.footnote, { color: tokens.muted }]}>
          {card.footnote}
        </Text>
      ) : null}
    </View>
  )
}

function Assets({
  groupSlug,
  data,
  today,
}: {
  groupSlug: string
  data: EnergySolarMonth
  today: string
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const payback = useEnergyPaybackDays(groupSlug, data, today)
  const all = data.assets.map((each) => each.asset)
  const anyPrice = all.some((asset) => asset.purchaseCents !== undefined)
  const shown = data.status === 'ok'
  return (
    <View style={styles.section}>
      <SectionLabel>
        {anyPrice && shown ? words.solar.payback : words.solar.assets}
      </SectionLabel>
      <InsetList testID="energy-assets">
        {data.assets.map(({ _id, asset }) => {
          const text =
            shown && payback
              ? energyPaybackText(
                  asset,
                  energyPayback(asset, all, payback.days),
                  words,
                  locale,
                )
              : null
          const spec = energyAssetSpec(asset, words, locale)
          const paid = text
            ? [text.amount, text.rest].filter(Boolean).join(' ')
            : null
          return (
            <InsetRow
              key={_id}
              testID={`energy-asset-${_id}`}
              accessibilityLabel={[asset.name, spec, paid, ...(text?.notes ?? [])]
                .filter(Boolean)
                .join(', ')}
              chevron
              onPress={() =>
                router.push(moduleHref('/all/energy/asset', { id: _id }))
              }
            >
              <View style={styles.asset}>
                <View>
                  <Text style={[TYPE.body, { color: tokens.ink }]}>
                    {asset.name}
                  </Text>
                  <Text style={[TYPE.subhead, { color: tokens.muted }]}>{spec}</Text>
                </View>
                {text ? (
                  <>
                    <EnergyShareBar share={text.share} height={8} />
                    <Text style={[TYPE.subhead, TABULAR, { color: tokens.ink }]}>
                      {text.amount ? (
                        <Text style={styles.strong}>{text.amount} </Text>
                      ) : null}
                      {text.rest}
                    </Text>
                    {text.notes.map((note) => (
                      <Text
                        key={note}
                        style={[TYPE.footnote, { color: tokens.muted }]}
                      >
                        {note}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
            </InsetRow>
          )
        })}
      </InsetList>
      {payback?.partial ? (
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.solar.paybackPartial}
        </Text>
      ) : null}
      {!anyPrice && shown ? (
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.solar.paybackHint}
        </Text>
      ) : null}
    </View>
  )
}

function CardTitle({ children, unit }: { children: string; unit?: string }) {
  const tokens = useTokens('home')
  return (
    <View style={styles.head}>
      <Text
        accessibilityRole="header"
        style={[TYPE.bodyStrong, styles.flex, { color: tokens.ink }]}
      >
        {children}
      </Text>
      {unit ? (
        <Text style={[TYPE.footnote, { color: tokens.muted }]}>{unit}</Text>
      ) : null}
    </View>
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
  shrink: { flexShrink: 1, textAlign: 'right' },
  facts: { flexDirection: 'row', gap: SPACE[3] },
  factsStacked: { gap: SPACE[3] },
  fact: { flex: 1 },
  split: {
    flexDirection: 'row',
    gap: 2,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  soc: { gap: SPACE[2] },
  socLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: SPACE[2],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: SPACE[3],
    paddingVertical: SPACE[2],
  },
  section: { gap: SPACE[2] },
  asset: { gap: 6 },
  strong: { fontWeight: '700' },
  hint: { paddingHorizontal: 4 },
})
