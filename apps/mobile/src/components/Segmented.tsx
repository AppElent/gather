/**
 * A row of mutually exclusive choices, which is what both of #164's settings
 * are: three appearances, two languages, one of each selected.
 *
 * Not `@react-native-segmented-control/segmented-control` and not `expo-ui`'s
 * picker. ADR-0017 keeps the phone on plain React Native primitives styled from
 * `theme/tokens`, and a platform segmented control would be the one control in
 * the app that cannot take the palette — including in the case that matters
 * most here, a person reading the appearance switch in the appearance they are
 * about to leave.
 *
 * The track is `surface2`; the selected option is a `surface` pill on it and
 * the others are transparent, all labelled in ink. No group colour and no
 * accent: a selected state is not a tile (ADR-0017).
 *
 * Selection is announced rather than only drawn: `accessibilityState.selected`
 * is what makes this a set of choices to a screen reader instead of five
 * buttons that happen to have different backgrounds.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { haptics } from '../feedback/haptics'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../theme/tokens'

export interface SegmentedOption<Value extends string> {
  value: Value
  label: string
  /** Spoken instead of the label, where the label alone is not a sentence. */
  accessibilityLabel?: string
}

export function Segmented<Value extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentedOption<Value>[]
  value: Value
  onChange: (next: Value) => void
}) {
  const tokens = useTokens()

  return (
    <View style={[styles.track, { backgroundColor: tokens.surface2 }]}>
      {options.map((option) => {
        const isOn = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={() => {
              if (!isOn) haptics.selectionChanged()
              onChange(option.value)
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: isOn ? tokens.surface : 'transparent' },
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { color: tokens.ink }]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: SPACE[1],
    padding: SPACE[1],
    borderRadius: RADIUS.pill,
  },
  option: {
    flex: 1,
    minHeight: SIZE.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
  },
  label: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.75 },
})
