/**
 * The leading column of a record's row: its photo as a 46 pt thumbnail
 * (`radius-thumb`), or — with no photo — the Module's `tile-s`, centred in the
 * same column so a list of mixed rows does not comb. Never a placeholder
 * picture.
 */
import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

import type { Glyph } from '../theme/glyph'
import { type ModuleGroup, RADIUS, SIZE, useTokens } from '../theme/tokens'
import { ModuleTile } from './module-tile'

export function RecordThumb({
  uri,
  group,
  glyph,
}: {
  uri?: string | null
  group: ModuleGroup
  glyph: Glyph
}) {
  const tokens = useTokens()
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.thumb, { backgroundColor: tokens.surface2 }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    )
  }
  return (
    <View style={styles.column}>
      <ModuleTile group={group} glyph={glyph} size="s" />
    </View>
  )
}

const styles = StyleSheet.create({
  thumb: {
    width: SIZE.thumb,
    height: SIZE.thumb,
    borderRadius: RADIUS.thumb,
    borderCurve: 'continuous',
  },
  column: {
    width: SIZE.thumb,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
