/**
 * Two to four key numbers about a record, large in ink with their units under
 * them (`components/FactsStrip`).
 *
 * Equal columns divided by `hair` rules, with a rule above and below. Each
 * cell is one VoiceOver element ("25 minutes"). At the accessibility text
 * sizes the cells stack, because four `numeral-l` values side by side no
 * longer fit. Values are never coloured and carry no icons.
 */
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { SPACE, TYPE, useTokens } from '../theme/tokens'
import { type Fact, factLabel, stripFacts } from './facts'
import { isAccessibilityTextSize } from './text-scale'

export function FactsStrip({ facts }: { facts: readonly (Fact | null)[] }) {
  const tokens = useTokens()
  const { fontScale } = useWindowDimensions()
  const shown = stripFacts(facts)
  if (shown.length === 0) return null

  const stacked = isAccessibilityTextSize(fontScale)
  const rule = { borderColor: tokens.hair }

  return (
    <View
      testID="facts-strip"
      style={[styles.strip, rule, stacked ? styles.stacked : styles.row]}
    >
      {shown.map((fact, index) => (
        <View
          key={`${fact.unit}-${index}`}
          accessible
          accessibilityLabel={factLabel(fact)}
          style={[
            styles.cell,
            !stacked && styles.column,
            index > 0 &&
              (stacked
                ? [styles.dividedBelow, rule]
                : [styles.dividedBeside, rule]),
          ]}
        >
          <Text style={[styles.value, { color: tokens.ink }]}>
            {fact.value}
          </Text>
          <Text style={[styles.unit, { color: tokens.muted }]}>
            {fact.unit}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row' },
  stacked: { flexDirection: 'column' },
  cell: { paddingVertical: SPACE[3] },
  column: { flex: 1 },
  dividedBeside: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: SPACE[3],
  },
  dividedBelow: { borderTopWidth: StyleSheet.hairlineWidth },
  value: { ...TYPE.numeralL },
  unit: { ...TYPE.footnote },
})
