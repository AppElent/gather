/**
 * The catalogue as the band under the pitch, because the front door's job is to
 * say what gather is and the catalogue is the most honest answer available:
 * every Module this build shows, in every Group. The words lead, the tiles
 * confirm: each chip is neutral and only its glyph tile wears the group's fill
 * (ADR-0017).
 *
 * It is not interactive. A chip that looked tappable and was not would be a
 * worse promise than a chip that plainly is not, and there is nothing behind it
 * to tap into until you are signed in.
 */

import { MODULE_GROUPS, MODULES } from '@gather/core/modules'
import { StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { moduleShown } from '../modules/buildModules'
import { MODULE_ICONS } from '../theme/icons'
import { RADIUS, SIZE, TYPE, useTokens } from '../theme/tokens'

/**
 * Group order, so the four tints read as four bands rather than confetti. The
 * store build names only live Modules: a promise on the front door is one the
 * app has to keep.
 */
const ORDERED: readonly (typeof MODULES)[number][] = MODULE_GROUPS.flatMap(
  (group) =>
    MODULES.filter(
      (module) => module.group === group && moduleShown(module.id),
    ),
)

export function CatalogueStrip() {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <View
      style={styles.stripWrap}
      accessibilityRole="summary"
      accessibilityLabel={t.welcome.catalogueHeading}
    >
      {ORDERED.map((entry) => {
        const tint = tokens.tintOf(entry.group)
        const Icon = MODULE_ICONS[entry.icon]
        return (
          <View
            key={entry.id}
            style={[styles.chip, { backgroundColor: tokens.surface2 }]}
          >
            <View style={[styles.tile, { backgroundColor: tint.fill }]}>
              <Icon size={12} color={tint.on} strokeWidth={2} />
            </View>
            <Text style={[styles.chipLabel, { color: tokens.ink }]}>
              {t.modules.byId[entry.id].label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  stripWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 11,
    borderRadius: RADIUS.pill,
  },
  tile: {
    width: SIZE.tileXs,
    height: SIZE.tileXs,
    borderRadius: RADIUS.tileXs,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { ...TYPE.footnoteStrong },
})
