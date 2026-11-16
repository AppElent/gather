/**
 * The app's button: the weights of action a screen needs, from the front door
 * to Account and the Group forms. Reach for this before writing another.
 *
 * Every variant is a pill (`RADIUS.pill`).
 *
 * `primary` is filled with `tokens.accent` and labelled in `tokens.onAccent`.
 * It takes no group, so that is ink with an `onInk` label: the front door
 * belongs to no Module, and ADR-0017's accent rule says the accent is ink
 * where you are looking at everything. A tinted Sign in would be claiming the
 * person is somewhere they have not arrived yet.
 *
 * `busy` keeps the label in place and swaps in a spinner beside it rather than
 * replacing the text — the button must not change width mid-tap.
 *
 * `danger` is the fourth, and it exists for deleting what cannot come back:
 * your account, or a Group. It is filled with `tokens.danger` and labelled in
 * `tokens.onInk`, rather than outlined, because it is the last thing on its
 * screen and it must not read as the quiet way out.
 */
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'

import { RADIUS, TYPE, useTokens } from '../theme/tokens'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  /** So a verification run can reach the button without matching its words. */
  testID?: string
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  style,
  testID,
}: ButtonProps) {
  const tokens = useTokens()
  const inert = disabled || busy

  const surface =
    variant === 'primary'
      ? { backgroundColor: tokens.accent }
      : variant === 'danger'
        ? { backgroundColor: tokens.danger }
        : variant === 'secondary'
          ? {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: tokens.hair,
            }
          : { backgroundColor: 'transparent' }

  const color =
    variant === 'primary'
      ? tokens.onAccent
      : variant === 'danger'
        ? tokens.onInk
        : tokens.ink

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' && styles.ghost,
        surface,
        pressed && !inert && styles.pressed,
        inert && styles.inert,
        style,
      ]}
    >
      <View style={styles.row}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {busy ? <ActivityIndicator size="small" color={color} /> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.pill,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  ghost: { paddingVertical: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  label: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.82 },
  inert: { opacity: 0.5 },
})
