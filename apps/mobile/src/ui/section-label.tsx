import type { ReactNode } from 'react'
import { StyleSheet, Text } from 'react-native'

import { TYPE, useTokens } from '../theme/tokens'

/** The section heading above a `Card`, in sentence case as written. */
export function SectionLabel({ children }: { children: ReactNode }) {
  const tokens = useTokens()
  return (
    <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...TYPE.footnoteStrong,
    paddingHorizontal: 4,
  },
})
