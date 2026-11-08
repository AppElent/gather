import type { ReactNode } from 'react'
import { StyleSheet, Text } from 'react-native'

import { useTokens } from '../theme/tokens'

/** The section heading above a `Card`. */
export function SectionLabel({ children }: { children: ReactNode }) {
  const tokens = useTokens()
  return (
    <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
})
