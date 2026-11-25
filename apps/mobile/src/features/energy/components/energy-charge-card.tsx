/**
 * The battery through a day (APP-494, APP-496): its state of charge with the
 * strip of what it did each hour, the same sentence under it, and the legend
 * of the strip. Usage › Day and Solar and battery › Today show it.
 */
import {
  type EnergySolarChartHour,
  energyBatteryStrip,
  energySocNow,
  formatEnergyDate,
} from '@gather/core/energy-present'
import { StyleSheet, Text, View } from 'react-native'

import { fmt, useI18n } from '../../../i18n'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../../theme/tokens'
import { HOUR_TICKS } from '../energy-chart-text'
import { EnergyChartLegend, energySolarColour } from './energy-mirror-chart'
import { EnergySocChart } from './energy-soc-chart'

export function EnergyChargeCard({
  day,
  today,
  hours,
  now,
}: {
  day: string
  today: string
  hours: readonly EnergySolarChartHour[]
  now: number
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.energy
  const percents = hours.map((hour) => hour.socPercent)
  const known = percents.filter((value): value is number => value !== null)
  const strip = energyBatteryStrip(hours, now, words, locale)
  if (known.length === 0) return null
  const percent = energySocNow(hours)
  const label = [
    fmt(words.usage.socLabel, {
      date: formatEnergyDate(day, locale, 'dayMonth'),
      low: Math.round(Math.min(...known)),
      high: Math.round(Math.max(...known)),
    }),
    strip?.sentence,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <View
      testID="energy-usage-soc"
      style={[styles.card, { backgroundColor: tokens.surface }]}
    >
      <View style={styles.head}>
        <Text style={[TYPE.subhead, styles.flex, { color: tokens.muted }]}>
          {words.usage.socTitle}
        </Text>
        {day === today && percent !== null ? (
          <Text style={[TYPE.footnote, TABULAR, { color: tokens.muted }]}>
            {fmt(words.usage.socNow, { percent: Math.round(percent) })}
          </Text>
        ) : null}
      </View>
      <EnergySocChart
        testID="energy-soc-chart"
        percents={percents}
        strip={strip?.cells}
        label={label}
        ticks={HOUR_TICKS}
      />
      {strip ? (
        <EnergyChartLegend
          items={[
            { label: words.usage.socCharge, kind: 'fill', colour: tokens.ink },
            {
              label: words.usage.socDischarge,
              kind: 'fill',
              colour: energySolarColour(tokens),
            },
            { label: words.solar.legendIdle, kind: 'fill', colour: tokens.surface2 },
            ...(strip.cells.some((cell) => cell.mode === 'future')
              ? [
                  {
                    label: words.usage.legendFuture,
                    kind: 'dashed' as const,
                    colour: tokens.hairStrong,
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      <Text style={[TYPE.subhead, { color: tokens.ink }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
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
