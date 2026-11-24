/**
 * One bar per hour of electricity's price (designs/energy sections 1 and 3).
 * The cheapest three hours are `ink`, past hours `surface2`, the rest
 * `hairStrong`; an `ink` outline marks now, or tomorrow's most expensive
 * hour. `highlight` off (Home) leaves the cheapest uncoloured. One VoiceOver
 * element with the answer as its label; the bars are hidden from it.
 */
import type { EnergyPriceChart } from '@gather/core/energy-present'
import { StyleSheet, View } from 'react-native'

import { useTokens } from '../../../theme/tokens'
import { HOUR_TICKS } from '../energy-chart-text'
import { EnergyChartTicks } from './energy-mirror-chart'

export function EnergyPriceBars({
  bars,
  height,
  highlight,
  label,
  testID,
}: {
  bars: EnergyPriceChart['bars']
  height: number
  highlight: boolean
  label: string
  testID?: string
}) {
  const tokens = useTokens()
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
          {bars.map((bar) => {
            const cheapest = highlight && bar.cheapest
            return (
              <View
                key={bar.key}
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, bar.height * height),
                    backgroundColor: cheapest
                      ? tokens.ink
                      : bar.marked
                        ? 'transparent'
                        : bar.past
                          ? tokens.surface2
                          : tokens.hairStrong,
                  },
                  bar.marked && styles.marked,
                  bar.marked && { borderColor: tokens.ink },
                ]}
              />
            )
          })}
        </View>
        <EnergyChartTicks ticks={HOUR_TICKS} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  marked: { borderWidth: 2 },
})
