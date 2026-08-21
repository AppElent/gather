/**
 * An empty Baby log.
 *
 * Not a setup screen with a switch: a Module is never enabled or disabled, and
 * "not set up" means **empty** (ADR-0022). So this is an invitation with one
 * action, and creating the first Child *is* the Module's setup — everything the
 * Module needs configured is a property of a Child.
 *
 * It names the Group the Child will land in, because the phone's Group is
 * ambient (ADR-0015) and the one moment it must be said out loud is just before
 * something is created in it.
 *
 * Deliberately not shared with `ModulePlaceholder`. That answers "this Module
 * is not built here yet"; this one says "it is built, and it is yours to
 * start". A promise about the future and an invitation to act now are not one
 * component — and a shared version designed against a single example would fit
 * neither (ADR-0022).
 */
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { BABY_UI_ICONS } from './icons'
import { type BabyBase, babyHref } from './paths'

export interface FirstRunProps {
  base: BabyBase
  groupName: string
}

export function FirstRun({ base, groupName }: FirstRunProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const router = useRouter()
  const tint = tokens.tintOf('home')
  const text = t.baby.log.firstRun

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.hero}>
        <View style={[styles.glyph, { backgroundColor: tint.bg }]}>
          <BABY_UI_ICONS.Baby size={50} color={tint.fg} strokeWidth={1.5} />
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {text.title}
        </Text>
        <Text style={[styles.body, { color: tokens.muted }]}>{text.body}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(babyHref(base, '/new'))}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: tint.fg },
            pressed && styles.pressed,
          ]}
        >
          <BABY_UI_ICONS.Plus
            size={19}
            color={tokens.surface}
            strokeWidth={2.2}
          />
          <Text style={[styles.actionText, { color: tokens.surface }]}>
            {text.action}
          </Text>
        </Pressable>
        <Text style={[styles.goesIn, { color: tokens.muted }]}>
          {fmt(text.goesIn, { group: groupName })}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  hero: { alignItems: 'center', gap: 18 },
  glyph: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 27, fontWeight: '700', letterSpacing: -0.7 },
  body: { fontSize: 15.5, lineHeight: 23, textAlign: 'center' },
  actions: { gap: 12 },
  action: {
    minHeight: 52,
    borderRadius: RADIUS.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { fontSize: 16.5, fontWeight: '700' },
  goesIn: { fontSize: 13, textAlign: 'center' },
  pressed: { opacity: 0.7 },
})
