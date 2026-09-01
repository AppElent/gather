/**
 * The weights of action the front door — and now Account — needs.
 *
 * `primary` is ink, because the front door belongs to no Module and ADR-0017's
 * accent rule says the accent is ink where you are looking at everything. That
 * is also why none of these take a tint: a tinted Sign in would be claiming the
 * person is somewhere they have not arrived yet.
 *
 * `busy` keeps the label in place and swaps in a spinner beside it rather than
 * replacing the text — the button must not change width mid-tap.
 *
 * `danger` is the fourth, and it exists for exactly one action: deleting your
 * account. It is filled rather than outlined because it is the last thing on
 * that screen and it must not read as the quiet way out; it is also the only
 * button in the app that takes the accent away from ink on purpose.
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

import { RADIUS, useTokens } from '../theme/tokens'

interface AuthButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  /** So a verification run can reach the button without matching its words. */
  testID?: string
}

export function AuthButton({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  style,
  testID,
}: AuthButtonProps) {
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
              borderColor: tokens.border,
            }
          : { backgroundColor: 'transparent' }

  const color =
    variant === 'primary' || variant === 'danger' ? tokens.onAccent : tokens.fg

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
    borderRadius: RADIUS.control,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  ghost: { paddingVertical: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  label: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.82 },
  inert: { opacity: 0.5 },
})
