/**
 * A section title that collapses what is under it.
 *
 * The whole header is the target, not the chevron - a 17pt glyph is well under
 * 44pt and a person aiming at a word should not have to aim at a triangle. The
 * chevron is decoration and says so to VoiceOver; the header carries the state
 * through `accessibilityState.expanded` and an action label, so a reader who
 * cannot see it is told both what it is and what pressing it will do.
 *
 * No haptic. `docs/mobile-interaction.md` gives ordinary taps nothing, and
 * disclosure is an ordinary tap.
 */
import { Platform, Pressable, StyleSheet, Text } from 'react-native'

import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'

export function SectionHeader({
  title,
  collapsed,
  onToggle,
  testID,
}: {
  title: string
  /** Omit to render a plain, non-collapsing title (Pinned, and Edit mode). */
  collapsed?: boolean
  onToggle?: () => void
  testID?: string
}) {
  const tokens = useTokens()
  const { t } = useI18n()

  if (collapsed === undefined || !onToggle) {
    return (
      <Text testID={testID} style={[styles.title, { color: tokens.fg }]}>
        {title}
      </Text>
    )
  }

  const Chevron = collapsed ? UI_ICONS.ChevronRight : UI_ICONS.ChevronDown
  const action = collapsed ? t.shell.all.expand : t.shell.all.collapse

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={action.replace('{section}', title)}
      accessibilityState={{ expanded: !collapsed }}
      onPress={onToggle}
      android_ripple={{ color: tokens.border }}
      style={({ pressed }) => [
        styles.header,
        pressed && Platform.OS === 'ios'
          ? { backgroundColor: tokens.tile }
          : null,
      ]}
    >
      <Text style={[styles.title, { color: tokens.fg }]}>{title}</Text>
      <Chevron
        size={17}
        color={tokens.muted}
        strokeWidth={2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    // Negative margin so the press fill reaches past the content gutter while
    // the text stays aligned with the rows beneath it.
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    minHeight: 44,
    borderRadius: RADIUS.control,
  },
  title: { fontSize: 17, fontWeight: '700' },
})
