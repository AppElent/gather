/**
 * The shape every utility surface above the tabs is made of: a titled card with
 * a sentence saying what the setting actually does, and rows that go somewhere.
 *
 * The web has `SurfaceCard` for the same job. This is not a port of it — the
 * phone owns its look (ADR-0017) — but it is the same idea, and it is one
 * component rather than three because Settings, Account and Groups looking
 * subtly different from each other would read as three apps.
 */
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

export function SettingsCard({
  title,
  description,
  children,
}: {
  title?: string
  /** What the setting means. Optional: a list of Groups explains itself. */
  description?: string
  children?: ReactNode
}) {
  const tokens = useTokens()

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      {title ? (
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text style={[styles.description, { color: tokens.muted }]}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

/**
 * A row that goes somewhere else. The chevron is decorative — where it leads is
 * the label, which is why the label is the accessible name and the icon is
 * hidden from the reader.
 */
export function SettingsRow({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  const tokens = useTokens()
  const ChevronRight = UI_ICONS.ChevronRight

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} style={[styles.rowLabel, { color: tokens.fg }]}>
        {label}
      </Text>
      <ChevronRight
        size={20}
        color={tokens.muted}
        strokeWidth={1.8}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
})
