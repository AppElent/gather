/**
 * A Module's glyph in a squircle filled with its group colour: the one place a
 * group's `fill` appears inside a list or a screen (Tiles & Today,
 * `components/ModuleTile`).
 *
 * Four sizes and nothing between them. The glyph is the group's `on` colour at
 * about 57% of the tile. The tile is decoration — the row or header beside it
 * already names the Module — so it is hidden from VoiceOver and TalkBack.
 */
import { moduleById } from '@gather/core/modules'
import { StyleSheet, View } from 'react-native'

import type { Glyph } from '../theme/glyph'
import { MODULE_ICONS } from '../theme/icons'
import { type ModuleGroup, RADIUS, SIZE, useTokens } from '../theme/tokens'

export type TileSize = 'xs' | 's' | 'm' | 'l'

/** The tile scale: the box, its corner and the glyph inside it. */
export const TILE_METRICS: Record<
  TileSize,
  { box: number; radius: number; glyph: number }
> = {
  xs: { box: SIZE.tileXs, radius: RADIUS.tileXs, glyph: 12 },
  s: { box: SIZE.tileS, radius: RADIUS.tileS, glyph: 16 },
  m: { box: SIZE.tileM, radius: RADIUS.tileM, glyph: 20 },
  l: { box: SIZE.tileL, radius: RADIUS.tileL, glyph: 30 },
}

/**
 * A Module's group and glyph, from the shared catalogue, so a screen never
 * picks its own colour or icon. `null` for an id the catalogue does not know.
 */
export function moduleTile(
  moduleId: string,
): { group: ModuleGroup; glyph: Glyph } | null {
  const module = moduleById(moduleId)
  if (!module) return null
  return { group: module.group, glyph: MODULE_ICONS[module.icon] }
}

export function ModuleTile({
  group,
  glyph: Icon,
  size,
  past = false,
}: {
  group: ModuleGroup
  glyph: Glyph
  size: TileSize
  /**
   * A past item on the Today rail: `surface-2` with a `muted` glyph at full
   * opacity, never a faded fill.
   */
  past?: boolean
}) {
  const tokens = useTokens()
  const tint = tokens.tintOf(group)
  const metrics = TILE_METRICS[size]

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: metrics.box,
          height: metrics.box,
          borderRadius: metrics.radius,
          backgroundColor: past ? tokens.surface2 : tint.fill,
        },
      ]}
    >
      <Icon
        size={metrics.glyph}
        color={past ? tokens.muted : tint.on}
        strokeWidth={2}
        weight="medium"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
