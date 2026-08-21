/** All: every Gather Module, grouped as the shared catalogue defines it. */
import { MODULE_GROUPS, modulesByGroup, moduleText } from '@gather/core/modules'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '../../../../src/i18n'
import { moduleDestination } from '../../../../src/modules/moduleDestination'
import { MODULE_ICONS } from '../../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../../src/theme/tokens'

export default function AllTab() {
  const tokens = useTokens()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const modules = modulesByGroup()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {t.shell.all.title}
        </Text>
        <Text style={[styles.intro, { color: tokens.muted }]}>
          {t.shell.all.intro}
        </Text>
      </View>

      {MODULE_GROUPS.map((group) => {
        const tint = tokens.tintOf(group)
        return (
          <View key={group} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: tokens.fg }]}>
              {t.modules.groups[group]}
            </Text>
            <View style={styles.entries}>
              {modules[group].map((module) => {
                const text = moduleText(module, t)
                const Icon = MODULE_ICONS[module.icon]
                return (
                  <Pressable
                    key={module.id}
                    accessibilityRole="button"
                    accessibilityLabel={text.label}
                    onPress={() =>
                      router.push(moduleDestination('all', module.id))
                    }
                    style={({ pressed }) => [
                      styles.entry,
                      { backgroundColor: tint.bg },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon size={24} color={tint.fg} strokeWidth={1.75} />
                    <View style={styles.entryText}>
                      <Text style={[styles.entryTitle, { color: tint.fg }]}>
                        {text.label}
                      </Text>
                      <Text
                        style={[styles.entryDescription, { color: tint.fg }]}
                      >
                        {text.description}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 24 },
  heading: { gap: 7 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  intro: { fontSize: 15, lineHeight: 22 },
  section: { gap: 9 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  entries: { gap: 8 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.card,
    padding: 14,
  },
  entryText: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 16, fontWeight: '700' },
  entryDescription: { fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.72 },
})
