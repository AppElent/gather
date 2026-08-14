/**
 * Every Group you are in, and the two ways to end up in another one.
 *
 * ## Why the rows do not switch Group
 *
 * They look like they should, and that is the trap. ADR-0015's rule is that
 * naming the current Group and changing it are *one* control, on Home — the
 * phone has no address bar, so a second place that silently moves the whole app
 * to another household is a change somebody cannot see the cause of afterwards.
 * The switcher sheet is that one control; this is the list of what it can
 * offer, and the place to add to it.
 *
 * So a row here is a statement, not a button, and the current one is marked the
 * same way the sheet marks it — including the spoken "Current group", because a
 * tick is not a sentence.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GroupForms } from '../../src/components/GroupForms'
import { useGroup } from '../../src/group/GroupProvider'
import { useI18n } from '../../src/i18n'
import { UI_ICONS } from '../../src/theme/icons'
import { RADIUS, useTokens } from '../../src/theme/tokens'

export default function Groups() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { group: current, groups } = useGroup()
  const insets = useSafeAreaInsets()
  const text = t.shell.groups
  const Check = UI_ICONS.Check

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
      // Otherwise the first tap on Create only dismisses the keyboard, and the
      // person taps a button that visibly did nothing.
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.intro, { color: tokens.muted }]}>{text.intro}</Text>

      <View style={styles.list}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: tokens.fg }]}
        >
          {text.yours}
        </Text>
        {groups.map((group) => {
          const isCurrent = group.slug === current.slug
          return (
            <View
              key={group.slug}
              style={[
                styles.row,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
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
                      ? text.personal
                      : t.shell.switcher.shared}
                </Text>
              </View>
              {isCurrent ? <Check size={20} color={tokens.fg} /> : null}
            </View>
          )
        })}
      </View>

      <GroupForms />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  intro: { fontSize: 15, lineHeight: 22 },
  list: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
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
})
