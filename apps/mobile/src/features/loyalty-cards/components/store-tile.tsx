import {
  DEFAULT_STORE_COLOR,
  isHexColor,
  storeMonogram,
  textOnBrand,
} from '@gather/core/loyalty-cards'
import { retailerLogoKey } from '@gather/core/retailer-logos'
import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { RETAILER_LOGO_FILES } from './retailer-logo-files'

/**
 * A store's tile: its logo when the Catalog ships one for `catalogKey`
 * (APP-159, the web's APP-154), otherwise its monogram on its brand colour. A
 * custom store, a dangling Provenance, or a logo that fails to load keeps the
 * monogram.
 *
 * Decorative — the store's name is always written beside it, so screen
 * readers skip the tile, logo and all.
 */
export function StoreTile({
  name,
  color,
  catalogKey,
  size = 'medium',
}: {
  name: string
  color?: string
  catalogKey?: string
  size?: 'medium' | 'large'
}) {
  const tokens = useTokens()
  const key = retailerLogoKey(catalogKey)
  const file = key ? RETAILER_LOGO_FILES[key] : undefined
  // The key that failed, not a flag: a recycled list row that moves on to
  // another store tries that store's logo afresh.
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const background = color && isHexColor(color) ? color : DEFAULT_STORE_COLOR
  const dimension = size === 'large' ? 56 : 42
  const frame = [
    styles.tile,
    { backgroundColor: background, width: dimension, height: dimension },
  ]

  if (key && file !== undefined && key !== failedKey) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        // A white logo tile needs an edge on a white card.
        style={[frame, styles.logoFrame, { borderColor: tokens.border }]}
      >
        <Image
          source={file}
          recyclingKey={key}
          contentFit="cover"
          style={styles.logo}
          accessibilityIgnoresInvertColors
          onError={() => setFailedKey(key)}
        />
      </View>
    )
  }

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={frame}
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
  logoFrame: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  logo: { width: '100%', height: '100%' },
  monogram: { fontWeight: '700' },
})
