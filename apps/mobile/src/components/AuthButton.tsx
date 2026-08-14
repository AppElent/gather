/**
 * The three weights of action the front door needs.
 *
 * `primary` is ink, because the front door belongs to no Module and ADR-0017's
 * accent rule says the accent is ink where you are looking at everything. That
 * is also why none of these take a tint: a tinted Sign in would be claiming the
 * person is somewhere they have not arrived yet.
 *
 * `busy` keeps the label in place and swaps in a spinner beside it rather than
 * replacing the text — the button must not change width mid-tap.
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { RADIUS, useTokens } from '../theme/tokens'

interface AuthButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  busy?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function AuthButton({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  style,
}: AuthButtonProps) {
  const tokens = useTokens()
  const inert = disabled || busy

  const surface =
    variant === 'primary'
      ? { backgroundColor: tokens.accent }
      : variant === 'secondary'
        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: tokens.border }
        : { backgroundColor: 'transparent' }

  const color = variant === 'primary' ? tokens.onAccent : tokens.fg

  return (
    <Pressable
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
