import { StyleSheet, View } from 'react-native'

import { RADIUS, SIZE, useTokens } from '../theme/tokens'

/** First-paint placeholder only; live data stays visible during later queries. */
export function LoadingSkeleton({
  rows = 3,
  label,
}: {
  rows?: number
  label: string
}) {
  const tokens = useTokens()
  return (
    <View accessibilityLabel={label} style={styles.wrap}>
      <View style={[styles.heading, { backgroundColor: tokens.surface2 }]} />
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={[styles.row, { backgroundColor: tokens.surface }]}
        >
          <View style={[styles.icon, { backgroundColor: tokens.surface2 }]} />
          <View style={[styles.line, { backgroundColor: tokens.surface2 }]} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  heading: { width: '45%', height: 28, borderRadius: RADIUS.pill },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
  },
  icon: {
    width: SIZE.tileS,
    height: SIZE.tileS,
    borderRadius: RADIUS.tileS,
    borderCurve: 'continuous',
  },
  line: { width: '52%', height: 14, borderRadius: RADIUS.pill },
})
