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
 * orientation the Group switch needs to be observable, plus the way out of the
 * app until #164 gives Account a home above the tabs.
 *
 * It also hides the splash: on a cold start with a retained session this is the
 * first screen mounted.
 */
import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSignOut } from '../../../../src/auth/useSignOut'
import { AuthButton } from '../../../../src/components/AuthButton'
import { useGroup } from '../../../../src/group/GroupProvider'
import { fmt, useI18n } from '../../../../src/i18n'
import { UI_ICONS } from '../../../../src/theme/icons'
import { useTokens } from '../../../../src/theme/tokens'
import { useHideSplash } from '../../../../src/useHideSplash'

export default function Home() {
  const tokens = useTokens()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const signOut = useSignOut()
  const { user } = useUser()
  const { group } = useGroup()
  const onLayout = useHideSplash()

  const ChevronDown = UI_ICONS.ChevronDown
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  return (
    <ScrollView
      onLayout={onLayout}
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fmt(t.shell.home.switchFrom, {
          group: group.name,
          action: t.shell.switcher.action,
        })}
        onPress={() => router.push('/switch-group')}
        hitSlop={8}
        style={({ pressed }) => [styles.groupButton, pressed && styles.pressed]}
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

      <Text style={[styles.subtitle, { color: tokens.muted }]}>
        {group.isPersonal
          ? t.shell.home.personalSubtitle
          : t.shell.home.sharedSubtitle}
      </Text>

      <View style={styles.footer}>
        <Text style={[styles.account, { color: tokens.muted }]}>
          {fmt(t.signedIn.as, { email })}
        </Text>
        <AuthButton
          variant="secondary"
          label={t.signedIn.signOut}
          onPress={signOut}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 6 },
  groupButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  groupName: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, lineHeight: 22 },
  footer: { marginTop: 32, gap: 12 },
  account: { fontSize: 13 },
})
