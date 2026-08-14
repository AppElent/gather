/**
 * The Group switcher, as a sheet with an address (ADR-0015).
 *
 * A route rather than a modal component, for `groupPaths.ts`'s recorded reason
 * — *"Adding food is a place, not a dialog: the sheet has an address so the
 * back gesture closes it."* The `formSheet` presentation then gives the swipe
 * down and the hardware back button for nothing, and neither has to be
 * re-implemented as state that can disagree with the navigator.
 *
 * It sits in the stack *above* the tabs because it belongs to no tab: it is
 * opened from Home today and will be reachable from the utility surfaces #164
 * adds beside it.
 *
 * ## What a switch does
 *
 * Two things, in this order, and both are load-bearing:
 *
 * 1. `setGroup` moves the ambient Group. Every mounted nested tab stack is
 *    keyed by the new slug and remounts at its root — including tabs nobody is
 *    looking at, which is the point: a stale id that survives in an unfocused
 *    tab surfaces one tap later under a header naming the wrong Group.
 * 2. `dismissTo` closes the sheet and lands on Home in the new Group.
 *    Always Home, never the screen you were on, because that is
 *    `groupIndexSurfaceOf`'s rule expressed natively: an id means nothing in
 *    another Group.
 *
 * Choosing the Group you are already in does neither — it is a dismissal, and
 * unwinding somebody's stacks because they opened the sheet and changed their
 * mind would be a switch they did not ask for.
 */
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useGroup } from '../../src/group/GroupProvider'
import { useI18n } from '../../src/i18n'
import { UI_ICONS } from '../../src/theme/icons'
import { RADIUS, useTokens } from '../../src/theme/tokens'

export default function SwitchGroup() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { group: current, groups, setGroup } = useGroup()
  const Check = UI_ICONS.Check

  function choose(slug: string) {
    if (slug !== current.slug) setGroup(slug)
    router.dismissTo('/home')
  }

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={styles.content}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.fg }]}
      >
        {t.shell.switcher.title}
      </Text>

      {groups.map((group) => {
        const isCurrent = group.slug === current.slug
        return (
          <Pressable
            key={group.slug}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent }}
            onPress={() => choose(group.slug)}
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
                {isCurrent
                  ? t.shell.switcher.current
                  : group.isPersonal
                    ? t.shell.switcher.personal
                    : t.shell.switcher.shared}
              </Text>
            </View>
            {isCurrent ? <Check size={20} color={tokens.fg} /> : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
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
