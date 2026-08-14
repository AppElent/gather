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
 * Selection is announced rather than only drawn: `accessibilityState.selected`
 * is what makes this a set of choices to a screen reader instead of five
 * buttons that happen to have different backgrounds.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { RADIUS, useTokens } from '../theme/tokens'

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
    <View style={styles.row}>
      {options.map((option) => {
        const isOn = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: isOn ? tokens.accent : tokens.surface,
                borderColor: isOn ? tokens.accent : tokens.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: isOn ? tokens.onAccent : tokens.fg },
              ]}
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
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: RADIUS.control,
  },
  label: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.75 },
})
