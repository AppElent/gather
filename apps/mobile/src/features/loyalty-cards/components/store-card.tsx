/**
 * A Loyalty card as a card (APP-206's quick-actions sheet): credit-card
 * proportions in the store's brand colour, its logo or monogram top left
 * (`useStoreFace`, the same choice `StoreTile` makes) and a barcode hint along
 * the bottom.
 *
 * Decorative, like `StoreTile`: the store's name is written under it by the
 * caller, and the button around both carries the accessible name. The hint
 * encodes nothing; the real barcode is on the card's own screen.
 */
import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { useStoreFace } from './store-tile'

/** Credit-card proportions (85.6 × 54 mm), at the size the sheet's row shows. */
export const STORE_CARD_WIDTH = 150
export const STORE_CARD_HEIGHT = 95

/** The hint's bars, in points: wide and narrow, so it reads as a barcode. */
const HINT_BARS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1]
const HINT_HEIGHT = 18

export function StoreCard({
  name,
  color,
  catalogKey,
}: {
  name: string
  color?: string
  catalogKey?: string
}) {
  const tokens = useTokens()
  const face = useStoreFace({ name, color, catalogKey })

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.card,
        { backgroundColor: face.background, borderColor: tokens.hair },
      ]}
    >
      {face.logo ? (
        <View style={[styles.logoFrame, { borderColor: tokens.hair }]}>
          <Image
            source={face.logo.file}
            recyclingKey={face.logo.key}
            contentFit="cover"
            style={styles.logo}
            accessibilityIgnoresInvertColors
            onError={face.onLogoError}
          />
        </View>
      ) : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[TYPE.title2, { color: face.onBrand }]}
        >
          {face.monogram}
        </Text>
      )}
      <View style={styles.hint}>
        {HINT_BARS.map((width, index) => (
          <View
            // A fixed pattern: a bar's position is its identity.
            key={index}
            style={[styles.bar, { width, backgroundColor: face.onBrand }]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: STORE_CARD_WIDTH,
    height: STORE_CARD_HEIGHT,
    borderRadius: RADIUS.thumb,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE[3],
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  logoFrame: {
    width: SIZE.tileM,
    height: SIZE.tileM,
    borderRadius: RADIUS.tileM,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  hint: {
    flexDirection: 'row',
    gap: 2,
    height: HINT_HEIGHT,
    opacity: 0.85,
  },
  bar: { height: HINT_HEIGHT },
})
