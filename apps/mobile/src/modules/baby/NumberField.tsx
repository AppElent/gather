/**
 * A number on the quick-log sheet: quick values, a stepper, and a box you can
 * type in.
 *
 * All three, because each fails on its own. Chips alone make 137 ml
 * unrecordable — the preset stops being a shortcut and starts being the set of
 * legal answers. A stepper alone makes 180 ml eighteen taps. A keyboard alone
 * is the thing this sheet exists to avoid at 3am. Together the common value is
 * one tap, the nearby value is one more, and the unusual value is still
 * reachable.
 *
 * The value is held as text by the sheet rather than as a number: a half-typed
 * "6." is not a number and must not be turned into one while somebody is still
 * typing it.
 */
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { useKeyboardDoneBar } from '../../ui/keyboard-done-bar'
import { type SheetField, stepValue } from './sheetFields'

export interface NumberFieldProps {
  field: SheetField
  value: string
  onChange: (next: string) => void
  /** Screen-reader name for the row — the label is drawn by the caller. */
  label: string
  decreaseLabel: string
  increaseLabel: string
}

export function NumberField({
  field,
  value,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
}: NumberFieldProps) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { inputAccessoryViewID, accessory } = useKeyboardDoneBar({
    keyboardType: 'decimal-pad',
  })

  return (
    <View style={styles.wrap}>
      {field.options.length > 0 ? (
        <View style={styles.chips}>
          {field.options.map((option) => {
            const on = value.trim() === option
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${label} ${option}`}
                onPress={() => onChange(option)}
                style={[
                  styles.chip,
                  {
                    borderColor: on ? tokens.ink : tokens.hair,
                    backgroundColor: on ? tokens.ink : tokens.ground,
                  },
                ]}
              >
                <Text
                  style={[
                    on ? TYPE.bodyStrong : TYPE.body,
                    { color: on ? tokens.onInk : tokens.ink },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <View
        style={[
          styles.stepper,
          { borderColor: tokens.hair, backgroundColor: tokens.ground },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          onPress={() => {
            haptics.selectionChanged()
            onChange(stepValue(field, value, -1))
          }}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
        >
          <Text style={[styles.stepGlyph, { color: tint.text }]}>−</Text>
        </Pressable>

        {accessory}
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          inputAccessoryViewID={inputAccessoryViewID}
          selectTextOnFocus
          accessibilityLabel={label}
          placeholder={field.fallback || '—'}
          placeholderTextColor={tokens.muted}
          style={[styles.value, { color: tokens.ink }]}
        />
        {field.unit ? (
          <Text style={[styles.unit, { color: tokens.muted }]}>
            {field.unit}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          onPress={() => {
            haptics.selectionChanged()
            onChange(stepValue(field, value, 1))
          }}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
        >
          <Text style={[styles.stepGlyph, { color: tint.text }]}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  step: {
    width: 54,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { ...TYPE.title2 },
  value: {
    ...TYPE.title2,
    ...TABULAR,
    flex: 1,
    textAlign: 'center',
    paddingVertical: 0,
  },
  unit: { ...TYPE.subhead, paddingRight: 4 },
  pressed: { opacity: 0.5 },
})
