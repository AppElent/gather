/**
 * One bar per day or hour, in `ink` (Costs per month, designs/energy section 5)
 * or the colour given,
 * with an average as a dashed `ink` line on a `surface` edge when given, so it
 * reads across the bars. A day still to come is a 4 pt dashed `hairStrong` outline; a past day without a
 * figure stays empty, never a zero bar. One VoiceOver element with the
 * answer as its label; the bars are hidden from it.
 */
import { StyleSheet, View } from 'react-native'

import { useTokens } from '../../../theme/tokens'
import { EnergyChartTicks } from './energy-mirror-chart'

/** iOS draws no dashed border on one side only. */
const DASHES = Array.from({ length: 40 }, (_, index) => index)

export function EnergyDayBars({
  bars,
  height,
  average,
  colour,
  label,
  ticks,
  testID,
}: {
  bars: readonly { key: string; value: number | null; future: boolean }[]
  height: number
  /** On the bars' own scale. */
  average?: number
  colour?: string
  label: string
  ticks: readonly string[]
  testID?: string
}) {
  const tokens = useTokens()
  const max = Math.max(0, average ?? 0, ...bars.map((bar) => bar.value ?? 0))

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
      >
        <View style={[styles.row, { height }]}>
          {bars.map((bar) => (
            <View
              key={bar.key}
              style={[
                styles.bar,
                bar.future
                  ? {
                      height: 4,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: tokens.hairStrong,
                    }
                  : {
                      height:
                        bar.value !== null && bar.value > 0 && max > 0
                          ? Math.max(2, (bar.value / max) * height)
                          : 0,
                      backgroundColor: colour ?? tokens.ink,
                    },
              ]}
            />
          ))}
          {average !== undefined && max > 0 ? (
            <View
              testID="energy-average"
              style={[
                styles.average,
                {
                  bottom: (average / max) * height - 2,
                  backgroundColor: tokens.surface,
                },
              ]}
            >
              {DASHES.map((dash) => (
                <View
                  key={dash}
                  style={[styles.dash, { backgroundColor: tokens.ink }]}
                />
              ))}
            </View>
          ) : null}
        </View>
        <EnergyChartTicks ticks={ticks} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  average: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dash: { flex: 1, height: 1.5 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
})
