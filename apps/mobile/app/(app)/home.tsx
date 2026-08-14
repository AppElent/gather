/**
 * The other side of the door, and nothing more.
 *
 * #147 is the signed-out front door; the signed-in shell is #146's five-slot tab
 * bar, which is prototyped on its own branch and not merged. But a door needs
 * somewhere to open onto or none of the ticket's questions can actually be
 * answered — this screen is what makes the guard observable, gives sign-out
 * something to leave, and above all makes the cold-start test real: quit with a
 * session, relaunch, and *this* is what must appear without the welcome screen
 * showing first.
 *
 * It also hides the splash, because on that relaunch it is the first screen
 * mounted.
 *
 * Deleted when #146's shell lands here.
 */
import { useUser } from '@clerk/expo'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSignOut } from '../../src/auth/useSignOut'
import { AuthButton } from '../../src/components/AuthButton'
import { useGroup } from '../../src/group/GroupProvider'
import { useHideSplash } from '../../src/useHideSplash'
import { useTokens } from '../../src/theme/tokens'
import { fmt, useI18n } from '../../src/i18n'

export default function Home() {
  const tokens = useTokens()
  const { t } = useI18n()
  const signOut = useSignOut()
  const { user } = useUser()
  const { group } = useGroup()
  const onLayout = useHideSplash()

  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  return (
    <SafeAreaView
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: tokens.bg }]}
    >
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: tokens.fg }]}
        >
          {t.signedIn.heading}
        </Text>
        <Text style={[styles.line, { color: tokens.muted }]}>
          {fmt(t.signedIn.as, { email })}
        </Text>
        {/* Ambient orientation, which is what the phone pays instead of the
            web's slug in the address bar (ADR-0015). Home names the Group; the
            switcher that this line becomes is #162's. */}
        <Text style={[styles.line, { color: tokens.fg }]}>
          {fmt(t.group.inGroup, { group: group.name })}
        </Text>
        <Text style={[styles.note, { color: tokens.muted }]}>
          {t.signedIn.note}
        </Text>
      </View>

      <AuthButton
        variant="secondary"
        label={t.signedIn.signOut}
        onPress={signOut}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 12 },
  body: { flex: 1, justifyContent: 'center', gap: 8 },
  heading: { fontSize: 27, fontWeight: '700', letterSpacing: -0.5 },
  line: { fontSize: 15.5 },
  note: { fontSize: 14, lineHeight: 21, marginTop: 12 },
})
