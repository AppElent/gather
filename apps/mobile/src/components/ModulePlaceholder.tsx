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
import { RADIUS, SIZE, TYPE, useTokens } from '../theme/tokens'

export function ModulePlaceholder({ module }: { module: ModuleDef }) {
  const tokens = useTokens(module.group)
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const text = moduleText(module, t)
  const tint = tokens.tintOf(module.group)
  const Icon = MODULE_ICONS[module.icon]

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: text.label }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 20, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* A wash carries ink and muted; only the tile is group-coloured. */}
        <View style={[styles.hero, { backgroundColor: tint.wash }]}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.tile, { backgroundColor: tint.fill }]}
          >
            <Icon size={30} color={tint.on} strokeWidth={1.9} />
          </View>
          <Text style={[styles.title, { color: tokens.ink }]}>
            {text.label}
          </Text>
          <Text style={[styles.planned, { color: tokens.muted }]}>
            {t.shell.placeholder.planned}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.hair },
          ]}
        >
          <Text style={[styles.cardTitle, { color: tokens.ink }]}>
            {t.shell.placeholder.whatWillLiveHere}
          </Text>
          <Text style={[styles.description, { color: tokens.ink }]}>
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
  tile: {
    width: SIZE.tileL,
    height: SIZE.tileL,
    borderRadius: RADIUS.tileL,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...TYPE.title2, letterSpacing: -0.5 },
  planned: { ...TYPE.bodyStrong },
  card: { borderWidth: 1, borderRadius: RADIUS.card, gap: 9, padding: 16 },
  cardTitle: { ...TYPE.bodyStrong },
  description: { ...TYPE.bodyStrong },
  body: { ...TYPE.subhead },
})
