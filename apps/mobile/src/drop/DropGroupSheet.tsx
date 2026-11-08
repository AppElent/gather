/**
 * Naming the Group a Drop will be saved into — without moving there yet.
 *
 * This is not `GroupSwitcherSheet`, and the difference is the whole reason it
 * exists: the switcher calls `setGroup` the moment somebody taps, which is
 * right for navigating and wrong here. A Drop that named a Group and was then
 * abandoned would leave the app standing somewhere the person never asked to
 * be, and ADR-0028 says an abandoned Drop leaves nothing behind.
 *
 * So this answers with a Group id and changes nothing. The chooser holds it,
 * writes into it, and only then follows the Drop there — which is what
 * "confirming switches the app's Group as part of the save" means.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../components/NativeSheet'
import type { Id } from '../convex/api'
import { useGroup } from '../group/GroupProvider'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

export function DropGroupSheet({
  selected,
  onSelect,
  onClose,
}: {
  /** The Group currently named, which is not necessarily the ambient one. */
  selected: Id<'groups'>
  onSelect: (groupId: Id<'groups'>) => void
  onClose: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const { groups } = useGroup()
  const Check = UI_ICONS.Check

  return (
    <NativeSheet
      title={t.shell.switcher.title}
      onClose={onClose}
      maxHeight={0.7}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {groups.map((group) => {
          const isSelected = group._id === selected
          return (
            <Pressable
              key={group._id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                onSelect(group._id)
                onClose()
              }}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: tokens.fg }]}
                >
                  {group.name}
                </Text>
                <Text style={[styles.meta, { color: tokens.muted }]}>
                  {t.shell.switcher.shared}
                </Text>
              </View>
              {isSelected ? <Check size={20} color={tokens.fg} /> : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  content: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13 },
  pressed: { opacity: 0.75 },
})
