/**
 * Two to four facts about a period, two by two (Usage, designs/energy
 * section 11): a label, the value in `numeral-l` and its unit. A fact that
 * needs a channel the site lacks is left out by the caller, never shown as
 * zero. At the accessibility text sizes the cells stack, one per row.
 */
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { NUMERAL_XL_MAX_SCALE, RADIUS, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { isAccessibilityTextSize } from '../../../ui/text-scale'

export interface EnergyFact {
  key: string
  label: string
  value: string
  unit?: string
}

export function EnergyFactGrid({ facts }: { facts: readonly EnergyFact[] }) {
  const tokens = useTokens()
  const { fontScale } = useWindowDimensions()
  const stacked = isAccessibilityTextSize(fontScale)
  if (facts.length === 0) return null
  return (
    <View style={styles.grid}>
      {facts.map((fact) => (
        <View
          key={fact.key}
          testID={`energy-fact-${fact.key}`}
          accessible
          accessibilityLabel={[fact.label, fact.value, fact.unit]
            .filter(Boolean)
            .join(' ')}
          style={[
            styles.cell,
            stacked ? styles.full : styles.half,
            { backgroundColor: tokens.surface },
          ]}
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
          {fact.unit ? (
            <Text style={[TYPE.footnote, { color: tokens.muted }]}>
              {fact.unit}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[3] },
  cell: {
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: SPACE[4],
    gap: 2,
  },
  half: { flexGrow: 1, flexBasis: '40%' },
  full: { flexBasis: '100%' },
})
