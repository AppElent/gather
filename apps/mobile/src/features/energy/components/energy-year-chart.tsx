/**
 * A year next to the year before (designs/energy, section 11): two bars per
 * month, last year `muted` and this year `ink`. The running month is an `ink`
 * outline, not filled. One VoiceOver element whose label states the
 * comparison; the bars are hidden from it.
 */
import { yearPairHeights } from '@gather/core/energy-present'
import { StyleSheet, Text, View } from 'react-native'

import { SPACE, TYPE, useTokens } from '../../../theme/tokens'

/** Stable keys for the twelve months: their labels may repeat ("J", "J"). */
const MONTH_KEYS = Array.from({ length: 12 }, (_, index) => `month-${index}`)

export function EnergyYearChart({
  previous,
  current,
  runningIndex,
  monthLabels,
  height,
  label,
  testID,
}: {
  previous: readonly (number | null)[]
  current: readonly (number | null)[]
  runningIndex: number | null
  /** Twelve short month names, one under each pair. */
  monthLabels: readonly string[]
  height: number
  label: string
  testID?: string
}) {
  const tokens = useTokens()
  const pairs = yearPairHeights(previous, current, runningIndex)

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
          {pairs.map((pair, index) => (
            <View key={MONTH_KEYS[index]} style={styles.pair}>
              <View
                style={[
                  styles.bar,
                  {
                    height: pair.previous > 0 ? Math.max(2, pair.previous * height) : 0,
                    backgroundColor: tokens.muted,
                  },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  pair.running
                    ? {
                        height: Math.max(4, pair.current * height),
                        borderWidth: 1.5,
                        borderColor: tokens.ink,
                      }
                    : {
                        height:
                          pair.current > 0 ? Math.max(2, pair.current * height) : 0,
                        backgroundColor: tokens.ink,
                      },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.labels}>
          {monthLabels.map((month, index) => (
            <Text
              key={MONTH_KEYS[index]}
              numberOfLines={1}
              style={[TYPE.footnote, styles.label, { color: tokens.muted }]}
            >
              {month}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE[1] },
  pair: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  labels: { flexDirection: 'row', gap: SPACE[1], marginTop: SPACE[1] },
  label: { flex: 1, textAlign: 'center' },
})
