/**
 * The eight figures, per serving, wherever a recipe has any.
 *
 * Read-only on the phone, deliberately. The web has a grid of eight number
 * inputs and keeps it; typing eight numbers on a phone keyboard is the same
 * problem as typing fourteen ingredients, and the phone's answer to that
 * problem is the estimate button rather than a smaller grid. What lands here
 * came from an import or from an estimate somebody asked for, and the badge
 * says which (ADR-0011's `nutrients.sources`).
 */
import { NUTRIENT_KEYS, type NutrientKey } from '@gather/core/domain'
import { StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'

type Facts = Partial<Record<NutrientKey, number>>

export interface NutritionFactsProps {
  nutrition: Facts
  /** Already formatted: "per serving", or "per serving · 4 servings". */
  unitLabel: string
  source?: 'imported' | 'ai' | 'manual'
}

export function NutritionFacts({
  nutrition,
  unitLabel,
  source,
}: NutritionFactsProps) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const present = NUTRIENT_KEYS.filter((key) => nutrition[key] !== undefined)
  if (present.length === 0) return null

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {t.recipes.detail.nutrition}
        </Text>
        {source ? (
          <Text
            style={[
              styles.badge,
              { color: tokens.muted, borderColor: tokens.border },
            ]}
          >
            {t.nutrients.sources[source]}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.unit, { color: tokens.muted }]}>{unitLabel}</Text>
      <View style={styles.grid}>
        {present.map((key) => (
          <View key={key} style={styles.cell}>
            <Text style={[styles.label, { color: tokens.muted }]}>
              {t.nutrients.labels[key]}
            </Text>
            <Text style={[styles.value, { color: tokens.fg }]}>
              {nutrition[key]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  badge: {
    fontSize: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unit: { fontSize: 12.5, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 12 },
  // Two per row at every phone width, without measuring.
  cell: { flexBasis: '46%', flexGrow: 1, gap: 1 },
  label: { fontSize: 12 },
  value: { fontSize: 16, fontWeight: '600' },
})
