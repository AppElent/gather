import type { ReactNode } from 'react'
import { Pressable, StyleSheet } from 'react-native'

/** An icon in the navigation bar, with the hit slop small targets get. */
export function HeaderIconButton({
  label,
  testID,
  onPress,
  children,
}: {
  label: string
  testID: string
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { padding: 6 },
  pressed: { opacity: 0.6 },
})
