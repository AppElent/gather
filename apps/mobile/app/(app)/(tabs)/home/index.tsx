/**
 * Home: the one screen that names the Group and welcomes people to Gather.
 *
 * ADR-0015 pays for the missing address bar here. There is no persistent Group
 * line in chrome — a native header has room for *this screen's* title and
 * nothing else — so ambient orientation is Home's job, and naming the Group and
 * switching it stay one control, exactly as `GroupSwitcher` argued for the web.
 * Tapping the name opens an ephemeral native sheet; it does not change the
 * current destination.
 *
 * Home is deliberately not the catalogue. All is the single entrance to every
 * Module; Home only gives people their bearings and makes the Group switch
 * observable.
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
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../../../../src/availability/AvailabilityProvider'
import { useGroup } from '../../../../src/group/GroupProvider'
import { fmt, useI18n } from '../../../../src/i18n'
import { GroupSwitcherSheet } from '../../../../src/shell/GroupSwitcherSheet'
import { UI_ICONS } from '../../../../src/theme/icons'
import { useTokens } from '../../../../src/theme/tokens'
import { useHideSplash } from '../../../../src/useHideSplash'

export default function Home() {
  const tokens = useTokens()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { group } = useGroup()
  const { serviceActionsEnabled } = useAvailability()
  const onLayout = useHideSplash()
  const [switching, setSwitching] = useState(false)

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
          onPress={() => setSwitching(true)}
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
        {t.shell.home.intro}
      </Text>
      {switching ? (
        <GroupSwitcherSheet onClose={() => setSwitching(false)} />
      ) : null}
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
})
