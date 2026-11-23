/**
 * The period's one figure on the Home wash (Costs and Usage, designs/energy
 * sections 5 and 11): a caption, the total in `numeral-xl` with an optional
 * unit, and the sentences that qualify it. Text on the wash is `ink` and
 * `muted` only.
 *
 * Without a figure (no usage yet, no contract, prices not in) the card says
 * why in words instead of a number: never a made-up zero.
 */
import { StyleSheet, Text, View } from 'react-native'

import {
  NUMERAL_XL_MAX_SCALE,
  RADIUS,
  SPACE,
  TYPE,
  useTokens,
} from '../../../theme/tokens'

export function EnergyTotalCard({
  caption,
  value,
  unit,
  notes,
  testID,
}: {
  caption: string
  /** The figure, formatted; null when there is none to show. */
  value: string | null
  unit?: string
  /** The sentences under it; the first stands in for a missing figure. */
  notes: readonly string[]
  testID?: string
}) {
  const tokens = useTokens()
  const wash = tokens.tintOf('home').wash
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: wash }]}>
      <Text style={[TYPE.subhead, { color: tokens.muted }]}>{caption}</Text>
      {value !== null ? (
        <View
          accessible
          accessibilityLabel={unit ? `${value} ${unit}` : value}
          style={styles.line}
        >
          <Text
            testID={testID ? `${testID}-value` : undefined}
            maxFontSizeMultiplier={NUMERAL_XL_MAX_SCALE}
            style={[TYPE.numeralXl, { color: tokens.ink }]}
          >
            {value}
          </Text>
          {unit ? (
            <Text style={[TYPE.body, { color: tokens.muted }]}>{unit}</Text>
          ) : null}
        </View>
      ) : null}
      {notes.map((note) => (
        <Text key={note} style={[TYPE.subhead, { color: tokens.ink }]}>
          {note}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.now,
    padding: SPACE[4],
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: SPACE[2],
  },
})
