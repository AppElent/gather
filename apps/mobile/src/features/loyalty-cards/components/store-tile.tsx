import {
  DEFAULT_STORE_COLOR,
  isHexColor,
  storeMonogram,
  textOnBrand,
} from '@gather/core/loyalty-cards'
import { StyleSheet, Text, View } from 'react-native'

import { RADIUS, TYPE } from '../../../theme/tokens'

/**
 * A store's tile: its monogram on its brand colour, until real logos arrive
 * (APP-140). Decorative — the store's name is always written beside it, so
 * screen readers skip the tile.
 */
export function StoreTile({
  name,
  color,
  size = 'medium',
}: {
  name: string
  color?: string
  size?: 'medium' | 'large'
}) {
  const background = color && isHexColor(color) ? color : DEFAULT_STORE_COLOR
  const dimension = size === 'large' ? 56 : 42
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.tile,
        { backgroundColor: background, width: dimension, height: dimension },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          size === 'large' ? TYPE.title : TYPE.lead,
          styles.monogram,
          { color: textOnBrand(background) },
        ]}
      >
        {storeMonogram(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: RADIUS.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: { fontWeight: '700' },
})
