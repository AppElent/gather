/**
 * The one fact the household opened the app for, with the action that
 * answers it (`components/NowCard`). Home shows it only while something is
 * due or overdue, and never more than one.
 *
 * - **Ground:** the group's `wash`, corner `radius-now`, padding `space-4`.
 *   Text on it is `ink` and `muted` only.
 * - **Caption row:** a `tile-m` tile and the caption in `subhead`.
 * - **Fact line:** the value in `numeral-xl` `ink` with tabular figures,
 *   capped at 1.5× and wrapping rather than truncating, then an optional
 *   detail in `subhead` `muted`.
 * - **One button,** full width, the group's `fill` and `on`.
 *
 * The caption and the fact are one VoiceOver element, read as a sentence.
 * Never glass, never a second button, never the value in a group colour.
 */
import { StyleSheet, Text, View } from 'react-native'

import type { Glyph } from '../theme/glyph'
import {
  type ModuleGroup,
  NUMERAL_XL_MAX_SCALE,
  RADIUS,
  SPACE,
  TYPE,
  useTokens,
} from '../theme/tokens'
import { Button } from './button'
import { ModuleTile } from './module-tile'

export function NowCard({
  group,
  glyph,
  caption,
  value,
  detail,
  action,
  testID,
}: {
  group: ModuleGroup
  glyph: Glyph
  /** From `@gather/core`: "Overdue tasks". */
  caption: string
  /** The fact: a count or a duration ("3", "2 h 10 min"). */
  value: string
  /** What qualifies it: "in Groceries". */
  detail?: string
  action: { label: string; onPress: () => void; testID?: string }
  testID?: string
}) {
  const tokens = useTokens()
  const tint = tokens.tintOf(group)

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: tint.wash }]}
    >
      <View
        accessible
        accessibilityLabel={[caption, value, detail].filter(Boolean).join(', ')}
        style={styles.fact}
      >
        <View style={styles.caption}>
          <ModuleTile group={group} glyph={glyph} size="m" />
          <Text style={[styles.captionText, { color: tokens.ink }]}>
            {caption}
          </Text>
        </View>
        <View style={styles.line}>
          <Text
            maxFontSizeMultiplier={NUMERAL_XL_MAX_SCALE}
            style={[styles.value, { color: tokens.ink }]}
          >
            {value}
          </Text>
          {detail ? (
            <Text style={[styles.detail, { color: tokens.muted }]}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        group={group}
        label={action.label}
        onPress={action.onPress}
        testID={action.testID}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.now,
    borderCurve: 'continuous',
    padding: SPACE[4],
    gap: SPACE[4],
  },
  fact: { gap: SPACE[1] },
  caption: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  captionText: { ...TYPE.subhead, flex: 1 },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: SPACE[2],
  },
  value: { ...TYPE.numeralXl, letterSpacing: -0.5 },
  detail: { ...TYPE.subhead, flexShrink: 1 },
})
