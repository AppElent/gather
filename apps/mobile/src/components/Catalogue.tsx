/**
 * The catalogue, rendered two ways, because the front door's job is to say what
 * gather is and the catalogue is the most honest answer available: thirteen
 * Modules, every one of them in every Group.
 *
 * `CatalogueStrip` is the band under the pitch — the words lead, the tints
 * confirm. `CatalogueGrid` is the hero variant, where the catalogue *is* the
 * pitch and the words are a caption. Both exist so the choice can be made from
 * screenshots rather than from prose; one of them is expected to be deleted.
 *
 * Neither is interactive. A tile that looked tappable and was not would be a
 * worse promise than a tile that plainly is not, and there is nothing behind it
 * to tap into until you are signed in.
 */

import { MODULE_GROUPS, MODULES } from '@gather/core/modules'
import { StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { MODULE_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

/** Group order, so the four tints read as four bands rather than confetti. */
const ORDERED: readonly (typeof MODULES)[number][] = MODULE_GROUPS.flatMap(
  (group) => MODULES.filter((module) => module.group === group),
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
            style={[styles.chip, { backgroundColor: tint.bg }]}
          >
            <Icon size={14} color={tint.fg} strokeWidth={1.9} />
            <Text style={[styles.chipLabel, { color: tint.fg }]}>
              {t.modules.byId[entry.id].label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export function CatalogueGrid() {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <View style={styles.gridWrap}>
      {ORDERED.map((entry) => {
        const tint = tokens.tintOf(entry.group)
        const Icon = MODULE_ICONS[entry.icon]
        return (
          <View
            key={entry.id}
            style={[styles.tile, { backgroundColor: tint.bg }]}
          >
            <Icon size={22} color={tint.fg} strokeWidth={1.75} />
            <Text
              numberOfLines={2}
              style={[styles.tileLabel, { color: tint.fg }]}
            >
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
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  chipLabel: { fontSize: 12.5, fontWeight: '600' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    // Three to a row, whatever the screen is: 32% each plus two 8pt gaps.
    width: '31.9%',
    aspectRatio: 1.16,
    borderRadius: RADIUS.tile,
    padding: 11,
    justifyContent: 'space-between',
  },
  tileLabel: { fontSize: 12.5, fontWeight: '600', lineHeight: 16 },
})
