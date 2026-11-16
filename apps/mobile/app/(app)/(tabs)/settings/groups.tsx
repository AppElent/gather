import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GroupForms } from '../../../../src/components/GroupForms'
import { DeleteGroupSection } from '../../../../src/group/DeleteGroupSection'
import { useGroup } from '../../../../src/group/GroupProvider'
import { useI18n } from '../../../../src/i18n'
import { UI_ICONS } from '../../../../src/theme/icons'
import { RADIUS, TYPE, useTokens } from '../../../../src/theme/tokens'

export default function Groups() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { group: current, groups } = useGroup()
  const insets = useSafeAreaInsets()
  const text = t.shell.groups
  const Check = UI_ICONS.Check

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.intro, { color: tokens.muted }]}>{text.intro}</Text>
      <View style={styles.list}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: tokens.ink }]}
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
                { backgroundColor: tokens.surface, borderColor: tokens.hair },
              ]}
            >
              <View style={styles.rowText}>
                <Text
                  numberOfLines={1}
                  selectable
                  style={[styles.name, { color: tokens.ink }]}
                >
                  {group.name}
                </Text>
                <Text style={[styles.meta, { color: tokens.muted }]}>
                  {isCurrent
                    ? t.shell.switcher.current
                    : t.shell.switcher.shared}
                </Text>
              </View>
              {isCurrent ? <Check size={20} color={tokens.ink} /> : null}
            </View>
          )
        })}
      </View>
      <GroupForms />
      {/* Destructive, so last: below everything that adds a Group. */}
      <DeleteGroupSection />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  intro: { ...TYPE.subhead },
  list: { gap: 8 },
  sectionTitle: { ...TYPE.bodyStrong },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...TYPE.bodyStrong },
  meta: { ...TYPE.footnote },
})
