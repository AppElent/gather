/**
 * The honest destination for every Gather Module until that Module has a
 * native workflow. A Module being live on the web is not evidence that it is
 * live here, so the phone has one clear answer no matter where it was opened.
 */
import { type ModuleDef, moduleText } from '@gather/core/modules'
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../i18n'
import { MODULE_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

export function ModulePlaceholder({
  module,
  showHeader = false,
}: {
  module: ModuleDef
  showHeader?: boolean
}) {
  const tokens = useTokens(module.group)
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const text = moduleText(module, t)
  const tint = tokens.tintOf(module.group)
  const Icon = MODULE_ICONS[module.icon]

  return (
    <>
      {showHeader ? (
        <Stack.Screen options={{ headerShown: true, title: text.label }} />
      ) : null}
      <ScrollView
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: showHeader ? 20 : insets.top + 12,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={[styles.hero, { backgroundColor: tint.bg }]}>
          <Icon size={46} color={tint.fg} strokeWidth={1.6} />
          <Text style={[styles.title, { color: tint.fg }]}>{text.label}</Text>
          <Text style={[styles.planned, { color: tint.fg }]}>
            {t.shell.placeholder.planned}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: tokens.fg }]}>
            {t.shell.placeholder.whatWillLiveHere}
          </Text>
          <Text style={[styles.description, { color: tokens.fg }]}>
            {text.description}
          </Text>
          <Text style={[styles.body, { color: tokens.muted }]}>
            {t.shell.placeholder.body}
          </Text>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  hero: {
    minHeight: 196,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  planned: { fontSize: 14, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: RADIUS.card, gap: 9, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  description: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 14.5, lineHeight: 21 },
})
