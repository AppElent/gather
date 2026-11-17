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

import { RADIUS, SIZE, TYPE, useTokens } from '../../../theme/tokens'
import { RETAILER_LOGO_FILES } from './retailer-logo-files'

/**
 * A store's tile: its logo when the Catalog ships one for `catalogKey`
 * (APP-159, the web's APP-154), otherwise its monogram on its brand colour. A
 * custom store, a dangling Provenance, or a logo that fails to load keeps the
 * monogram.
 *
 * Decorative — the store's name is always written beside it, so screen
 * readers skip the tile, logo and all.
 *
 * The monogram scales with Dynamic Type like every other word, but the tile is
 * a fixed size on the tile scale, so at the largest sizes the two letters
 * shrink back to fit inside it rather than spilling over its edge.
 */
/**
 * What a store's face is drawn from, for `StoreTile` and `StoreCard`: its
 * brand colour (or the default), the bundled logo for `catalogKey` while that
 * logo has not failed to load, and the monogram and its colour otherwise.
 */
export function useStoreFace({
  name,
  color,
  catalogKey,
}: {
  name: string
  color?: string
  catalogKey?: string
}) {
  const key = retailerLogoKey(catalogKey)
  const file = key ? RETAILER_LOGO_FILES[key] : undefined
  // The key that failed, not a flag: a recycled list row that moves on to
  // another store tries that store's logo afresh.
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const background = color && isHexColor(color) ? color : DEFAULT_STORE_COLOR
  return {
    background,
    logo:
      key && file !== undefined && key !== failedKey ? { key, file } : null,
    onLogoError: () => setFailedKey(key ?? null),
    monogram: storeMonogram(name),
    onBrand: textOnBrand(background),
  }
}

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
  const face = useStoreFace({ name, color, catalogKey })
  const dimension = size === 'large' ? SIZE.tileL : SIZE.tileM
  const radius = size === 'large' ? RADIUS.tileL : RADIUS.tileM
  const frame = [
    styles.tile,
    {
      backgroundColor: face.background,
      width: dimension,
      height: dimension,
      borderRadius: radius,
    },
  ]

  if (face.logo) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        // A white logo tile needs an edge on a white card.
        style={[frame, styles.logoFrame, { borderColor: tokens.hair }]}
      >
        <Image
          source={face.logo.file}
          recyclingKey={face.logo.key}
          contentFit="cover"
          style={styles.logo}
          accessibilityIgnoresInvertColors
          onError={face.onLogoError}
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
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          size === 'large' ? TYPE.title2 : TYPE.bodyStrong,
          { color: face.onBrand },
        ]}
      >
        {face.monogram}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFrame: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  logo: { width: '100%', height: '100%' },
})
