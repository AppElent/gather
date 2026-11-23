/**
 * The battery's state of charge over a day (designs/energy, section 11): a
 * 2.5 pt `ink` line over a light Home `fill` area, with gridlines at 0, 50
 * and 100 %. Hours without a figure break nothing: the line joins the hours
 * that have one. One VoiceOver element with the range as its label.
 */
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Line, Polygon, Polyline } from 'react-native-svg'

import { SPACE, TABULAR, TYPE, useTokens } from '../../../theme/tokens'
import { EnergyChartTicks } from './energy-mirror-chart'

const WIDTH = 240
const HEIGHT = 100

export function EnergySocChart({
  percents,
  label,
  ticks,
  testID,
}: {
  /** One per hour of the day; null where the hour has no figure. */
  percents: readonly (number | null)[]
  label: string
  ticks: readonly string[]
  testID?: string
}) {
  const tokens = useTokens()
  const home = tokens.tintOf('home')
  const step = percents.length > 1 ? WIDTH / (percents.length - 1) : WIDTH
  const points = percents
    .map((percent, index) =>
      percent === null
        ? null
        : { x: index * step, y: HEIGHT - (Math.min(100, Math.max(0, percent)) / 100) * HEIGHT },
    )
    .filter((point): point is { x: number; y: number } => point !== null)
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const area =
    first && last ? `${first.x},${HEIGHT} ${line} ${last.x},${HEIGHT}` : ''

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.wrap}
      >
        <View style={styles.axis}>
          {['100', '50', '0'].map((value) => (
            <Text
              key={value}
              style={[TYPE.footnote, TABULAR, { color: tokens.muted }]}
            >
              {value}
            </Text>
          ))}
        </View>
        <View style={styles.plot}>
          <Svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
          >
            <Line x1={0} y1={1} x2={WIDTH} y2={1} stroke={tokens.hair} strokeWidth={1} />
            <Line x1={0} y1={50} x2={WIDTH} y2={50} stroke={tokens.hair} strokeWidth={1} />
            <Line
              x1={0}
              y1={HEIGHT - 1}
              x2={WIDTH}
              y2={HEIGHT - 1}
              stroke={tokens.hairStrong}
              strokeWidth={1}
            />
            {area ? (
              <Polygon points={area} fill={home.fill} fillOpacity={0.25} />
            ) : null}
            {line ? (
              <Polyline
                points={line}
                fill="none"
                stroke={tokens.ink}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </Svg>
          <EnergyChartTicks ticks={ticks} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: SPACE[2] },
  axis: { height: HEIGHT, justifyContent: 'space-between', alignItems: 'flex-end' },
  plot: { flex: 1 },
})
