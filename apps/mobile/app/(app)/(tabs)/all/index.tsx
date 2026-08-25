/** All: every Gather Module, grouped as the shared catalogue defines it. */
import { MODULE_GROUPS, modulesByGroup, moduleText } from '@gather/core/modules'
import { router, Stack } from 'expo-router'
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
    <>
      {/* The stack's title, not one drawn into the list: a heading inside the
        scroll view scrolls away and is gone, where the native one starts large
        and collapses into the bar (`headerLargeTitle` in `_layout.tsx`) so the
        screen still says what it is once you are down it. Reaching that needs
        both halves — a shown header here, and `contentInsetAdjustmentBehavior`
        below to name the scroll view it collapses against. */}
      <Stack.Screen options={{ headerShown: true, title: t.shell.all.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={[styles.intro, { color: tokens.muted }]}>
          {t.shell.all.intro}
        </Text>

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
                      onPress={() => router.push(moduleDestination(module.id))}
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
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 24 },
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
