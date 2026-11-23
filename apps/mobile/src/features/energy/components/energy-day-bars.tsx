/**
 * One bar per day in `ink` (Costs per month, designs/energy section 5). A day
 * still to come is a 4 pt dashed `hairStrong` outline; a past day without a
 * figure stays empty, never a zero bar. One VoiceOver element with the
 * answer as its label; the bars are hidden from it.
 */
import { StyleSheet, View } from 'react-native'

import { useTokens } from '../../../theme/tokens'
import { EnergyChartTicks } from './energy-mirror-chart'

export function EnergyDayBars({
  bars,
  height,
  label,
  ticks,
  testID,
}: {
  bars: readonly { key: string; value: number | null; future: boolean }[]
  height: number
  label: string
  ticks: readonly string[]
  testID?: string
}) {
  const tokens = useTokens()
  const max = Math.max(0, ...bars.map((bar) => bar.value ?? 0))

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
                      backgroundColor: tokens.ink,
                    },
              ]}
            />
          ))}
        </View>
        <EnergyChartTicks ticks={ticks} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
})
