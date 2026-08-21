/**
 * Home: the one screen that names the Group, and the way out of it.
 *
 * ADR-0015 pays for the missing address bar here. There is no persistent Group
 * line in chrome — a native header has room for *this screen's* title and
 * nothing else — so ambient orientation is Home's job, and naming the Group and
 * switching it stay one control, exactly as `GroupSwitcher` argued for the web.
 * Tapping the name pushes `switch-group`, which is a route rather than a modal
 * component so that the back gesture closes it.
 *
 * Home is deliberately not the catalogue. The Group's shared surface — the
 * Pins strip and the activity it has seen — is #163's; what is here now is the
 * orientation the Group switch needs to be observable.
 *
 * Beside the Group's name is the one way into everything that is not a Module
 * and not a Group: Settings, and through it Account and Groups (#164). One
 * entrance rather than three, because the header has room for the Group and one
 * more thing, and because Settings is what somebody is looking *for* when they
 * are not looking for a Module.
 *
 * It also hides the splash: on a cold start with a retained session this is the
 * first screen mounted.
 */
import { moduleText } from '@gather/core/modules'
import { pinnedModules } from '@gather/core/pins'
import { useQuery } from 'convex/react'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../../convex/_generated/api'
import { useAvailability } from '../../../../src/availability/AvailabilityProvider'
import { useGroup } from '../../../../src/group/GroupProvider'
import { fmt, useI18n } from '../../../../src/i18n'
import { moduleDestination } from '../../../../src/modules/moduleDestination'
import { MODULE_ICONS, UI_ICONS } from '../../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../../src/theme/tokens'
import { useHideSplash } from '../../../../src/useHideSplash'

export default function Home() {
  const tokens = useTokens()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const { serviceActionsEnabled } = useAvailability()
  const onLayout = useHideSplash()
  const pins = useQuery(api.users.myPins, { groupSlug: group.slug })
  const pinned = pins === undefined ? null : pinnedModules(pins ?? undefined)

  const ChevronDown = UI_ICONS.ChevronDown
  const SettingsIcon = UI_ICONS.Settings

  return (
    <ScrollView
      onLayout={onLayout}
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fmt(t.shell.home.switchFrom, {
            group: group.name,
            action: t.shell.switcher.action,
          })}
          onPress={() => router.push('/switch-group')}
          disabled={!serviceActionsEnabled}
          accessibilityState={{ disabled: !serviceActionsEnabled }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.groupButton,
            pressed && styles.pressed,
          ]}
        >
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.groupName, { color: tokens.fg }]}
          >
            {group.name}
          </Text>
          <ChevronDown size={22} color={tokens.muted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.shell.openSettings}
          onPress={() => router.navigate('/settings')}
          hitSlop={10}
          style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
        >
          <SettingsIcon size={23} color={tokens.muted} strokeWidth={1.8} />
        </Pressable>
      </View>

      <Text style={[styles.subtitle, { color: tokens.muted }]}>
        {group.isPersonal
          ? t.shell.home.personalSubtitle
          : t.shell.home.sharedSubtitle}
      </Text>

      <View style={styles.pins}>
        <Text style={[styles.pinsTitle, { color: tokens.fg }]}>
          {t.shell.home.pins}
        </Text>
        {pinned === null ? (
          <ActivityIndicator color={tokens.muted} />
        ) : pinned.length === 0 ? (
          <Text style={[styles.emptyPins, { color: tokens.muted }]}>
            {t.shell.home.nothingPinned}
          </Text>
        ) : (
          <View style={styles.pinList}>
            {pinned.map((module) => {
              const text = moduleText(module, t)
              const tint = tokens.tintOf(module.group)
              const Icon = MODULE_ICONS[module.icon]
              return (
                <Pressable
                  key={module.id}
                  accessibilityRole="button"
                  accessibilityLabel={text.label}
                  onPress={() =>
                    router.push(moduleDestination('home', module.id))
                  }
                  style={({ pressed }) => [
                    styles.pin,
                    { backgroundColor: tint.bg },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon size={20} color={tint.fg} strokeWidth={1.8} />
                  <Text style={[styles.pinLabel, { color: tint.fg }]}>
                    {text.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // `flexShrink` on the name and `flex: 1` here are what let a long Group name
  // truncate instead of pushing the gear off the screen.
  groupButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  settings: { padding: 4 },
  pressed: { opacity: 0.7 },
  groupName: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, lineHeight: 22 },
  pins: { marginTop: 26, gap: 10 },
  pinsTitle: { fontSize: 18, fontWeight: '700' },
  emptyPins: { fontSize: 15, lineHeight: 22 },
  pinList: { gap: 8 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  pinLabel: { fontSize: 16, fontWeight: '700' },
})
