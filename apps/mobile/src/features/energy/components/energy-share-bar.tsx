/**
 * A share of a whole as a pill: how full the battery is, or how much of a
 * price is paid back. The words beside it say the same, so it is decoration.
 */
import { StyleSheet, View } from 'react-native'

import { useTokens } from '../../../theme/tokens'

export function EnergyShareBar({
  share,
  height = 10,
}: {
  /** 0 to 1. */
  share: number
  height?: number
}) {
  const tokens = useTokens()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: tokens.surface2 },
      ]}
    >
      <View
        style={{
          height,
          width: `${Math.min(1, Math.max(0, share)) * 100}%`,
          backgroundColor: tokens.ink,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({ track: { overflow: 'hidden' } })
