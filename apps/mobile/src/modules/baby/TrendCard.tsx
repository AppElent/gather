/**
 * One measurement over time, as a card rather than a sparkline in a tile.
 *
 * The chart is the thing a parent actually shows a doctor, so it gets its own
 * width instead of being squeezed in beside a number. Below two measurements it
 * says so rather than drawing a line through a single point.
 *
 * Which measurement is a prop, because the same card draws weight on the log
 * and all four on the Trends screen. The unit is not translated: `kg` is `kg`
 * (ADR-0011 keeps content out of the message tree, and a unit symbol is not
 * chrome).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Polyline } from 'react-native-svg'

import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import {
  plotTrend,
  type TrendSource,
  toPolyline,
  trendValues,
} from './trendPoints'

const CHART_WIDTH = 300
const CHART_HEIGHT = 88

/** One thing worth watching over time, and where to read it off an event. */
export interface TrendMetric {
  type: 'growth' | 'temperature'
  field: string
  unit: string
}

export const TREND_METRICS = {
  weight: { type: 'growth', field: 'weightKg', unit: 'kg' },
  height: { type: 'growth', field: 'heightCm', unit: 'cm' },
  head: { type: 'growth', field: 'headCircumferenceCm', unit: 'cm' },
  temperature: { type: 'temperature', field: 'celsius', unit: '°C' },
} satisfies Record<string, TrendMetric>

export interface TrendCardProps {
  events: readonly TrendSource[]
  /** The card's heading, already in the reader's language. */
  title: string
  /** Weight, the one the log itself shows, when nothing else is asked for. */
  metric?: TrendMetric
  /** Absent on the Trends screen, where "all trends" is where you already are. */
  onOpenAll?: () => void
}

export function TrendCard({
  events,
  title,
  metric = TREND_METRICS.weight,
  onOpenAll,
}: TrendCardProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const tint = tokens.tintOf('home')
  const text = t.baby.log.status

  const values = trendValues(events, metric.type, metric.field)
  const plotted = plotTrend(values, CHART_WIDTH, CHART_HEIGHT)

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: tokens.muted }]}>
          {title.toUpperCase()}
        </Text>
        {onOpenAll ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenAll}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={[styles.linkText, { color: tint.fg }]}>
              {text.allTrends}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        {plotted ? (
          <>
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            >
              {[0, CHART_HEIGHT / 2, CHART_HEIGHT].map((y) => (
                <Line
                  key={y}
                  x1={0}
                  y1={y}
                  x2={CHART_WIDTH}
                  y2={y}
                  stroke={tokens.tile}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                points={toPolyline(plotted.points)}
                fill="none"
                stroke={tint.fg}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle
                cx={plotted.points[plotted.points.length - 1].x}
                cy={plotted.points[plotted.points.length - 1].y}
                r={3.4}
                fill={tint.fg}
              />
            </Svg>
            <View style={styles.caption}>
              <Text style={[styles.captionText, { color: tokens.muted }]}>
                {fmt(text.measurements, { count: values.length })}
              </Text>
              <Text style={[styles.captionText, { color: tokens.muted }]}>
                {plotted.latest} {metric.unit}
              </Text>
            </View>
          </>
        ) : (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {text.noTrend}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 6 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  link: { minHeight: 32, justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '600' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 10,
  },
  caption: { flexDirection: 'row', justifyContent: 'space-between' },
  captionText: { fontSize: 11.5 },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  pressed: { opacity: 0.6 },
})
