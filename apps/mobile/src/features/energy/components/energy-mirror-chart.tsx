/**
 * Usage against solar, one mirrored bar chart (designs/energy, section 11):
 * usage above a `hairStrong` baseline in `ink`, solar below it in the Home
 * group's `text` (light) or `fill` (dark), on one shared scale. A slot still
 * to come is a 4 pt dashed `hairStrong` outline, never a zero bar; a past
 * slot without a figure stays empty.
 *
 * The figure is one VoiceOver element whose label says the answer (peak,
 * total); the bars are hidden from it. The caller puts the same sentence
 * under the chart for everyone.
 */
import { type MirrorSlot, mirrorHeights } from '@gather/core/energy-present'
import { StyleSheet, Text, View } from 'react-native'

import { SPACE, TABULAR, TYPE, useTokens } from '../../../theme/tokens'

/** The 4 pt outline of a slot still to come. */
const FUTURE_HEIGHT = 4

export function EnergyMirrorChart({
  slots,
  upHeight,
  downHeight,
  label,
  ticks,
  testID,
}: {
  slots: readonly MirrorSlot[]
  upHeight: number
  downHeight: number
  /** The answer in words, for VoiceOver. */
  label: string
  /** The axis under the bars, evenly spread ("00", "06", …). */
  ticks: readonly string[]
  testID?: string
}) {
  const tokens = useTokens()
  const solar = energySolarColour(tokens)
  const bars = mirrorHeights(slots)
  const gap = bars.length > 26 ? 2 : 3
  const showDown = slots.some((slot) => slot.down !== null)

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
        <View style={[styles.row, styles.up, { height: upHeight, gap }]}>
          {bars.map((bar) => (
            <View
              key={bar.key}
              style={[
                styles.bar,
                styles.barUp,
                bar.future
                  ? {
                      height: FUTURE_HEIGHT,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: tokens.hairStrong,
                    }
                  : {
                      height: bar.up > 0 ? Math.max(2, bar.up * upHeight) : 0,
                      backgroundColor: tokens.ink,
                    },
              ]}
            />
          ))}
        </View>
        <View style={[styles.baseline, { backgroundColor: tokens.hairStrong }]} />
        {showDown ? (
          <View style={[styles.row, { height: downHeight, gap }]}>
            {bars.map((bar) => (
              <View
                key={bar.key}
                style={[
                  styles.bar,
                  styles.barDown,
                  {
                    height:
                      bar.down > 0 ? Math.max(2, bar.down * downHeight) : 0,
                    backgroundColor: solar,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
        <EnergyChartTicks ticks={ticks} />
      </View>
    </View>
  )
}

/** Solar's colour: the Home group's `text` in light, its `fill` in dark. */
export function energySolarColour(tokens: ReturnType<typeof useTokens>) {
  const home = tokens.tintOf('home')
  return tokens.scheme === 'dark' ? home.fill : home.text
}

export function EnergyChartTicks({ ticks }: { ticks: readonly string[] }) {
  const tokens = useTokens()
  return (
    <View style={styles.ticks}>
      {ticks.map((tick) => (
        <Text
          key={tick}
          style={[TYPE.footnote, TABULAR, { color: tokens.muted }]}
        >
          {tick}
        </Text>
      ))}
    </View>
  )
}

/** A small legend: a swatch and its word, wrapping at large text sizes. */
export function EnergyChartLegend({
  items,
}: {
  items: readonly {
    label: string
    kind: 'fill' | 'dashed' | 'outline'
    colour: string
  }[]
}) {
  const tokens = useTokens()
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View
            style={[
              styles.swatch,
              item.kind === 'fill'
                ? { backgroundColor: item.colour }
                : {
                    borderWidth: item.kind === 'outline' ? 1.5 : 1,
                    borderStyle: item.kind === 'dashed' ? 'dashed' : 'solid',
                    borderColor: item.colour,
                  },
            ]}
          />
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  up: { alignItems: 'flex-end' },
  bar: { flex: 1 },
  barUp: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barDown: { borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  baseline: { height: 1 },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACE[1],
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE[4], rowGap: SPACE[1] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
})
