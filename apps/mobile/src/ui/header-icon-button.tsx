/**
 * An icon in the navigation bar, with the hit slop small targets get. iOS 26
 * draws a bar button on its own glass, so this paints nothing behind the icon.
 */
import type { ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'

export function HeaderIconButton({
  label,
  testID,
  onPress,
  disabled = false,
  children,
}: {
  label: string
  testID: string
  onPress: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={12}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { padding: 6 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
})
