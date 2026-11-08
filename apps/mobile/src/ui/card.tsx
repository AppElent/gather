/**
 * A grouped surface: 16px radius, a hairline border and a 14px inset, which
 * the rows inside use as their own inset so a run of rows reads as one object.
 */
import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { RADIUS, useTokens } from '../theme/tokens'

export function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: ViewStyle
}) {
  const tokens = useTokens()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
})
