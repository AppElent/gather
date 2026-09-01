import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useAvailability } from '../availability/AvailabilityProvider'
import { NativeSheet } from '../components/NativeSheet'
import { useGroup } from '../group/GroupProvider'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

/** An ephemeral shell modal: changing Group leaves the current valid surface in place. */
export function GroupSwitcherSheet({ onClose }: { onClose: () => void }) {
  const tokens = useTokens()
  const { t } = useI18n()
  const { group: current, groups, setGroup } = useGroup()
  const { serviceActionsEnabled } = useAvailability()
  const Check = UI_ICONS.Check

  function choose(groupId: string) {
    if (groupId !== current._id) setGroup(groupId)
    onClose()
  }

  return (
    <NativeSheet
      title={t.shell.switcher.title}
      onClose={onClose}
      maxHeight={0.7}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {groups.map((group) => {
          const isCurrent = group._id === current._id
          return (
            <Pressable
              key={group._id}
              accessibilityRole="button"
              accessibilityState={{
                selected: isCurrent,
                disabled: !serviceActionsEnabled,
              }}
              disabled={!serviceActionsEnabled}
              onPress={() => choose(group._id)}
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
                  {isCurrent ? t.shell.switcher.current : t.shell.switcher.shared}
                </Text>
              </View>
              {isCurrent ? <Check size={20} color={tokens.fg} /> : null}
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
    minHeight: 56,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 11 },
  pressed: { opacity: 0.7 },
})
