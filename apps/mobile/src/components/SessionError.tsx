/**
 * The signed-in tree could not confirm who is signed in.
 *
 * `SessionIdentityBoundary`'s fallback, laid out like `AuthUnavailable`: a
 * failure the person did not cause, so it says what happened and offers the two
 * ways out — try again, which remounts the gate and asks Convex to
 * authenticate afresh, and sign out, which is local to Clerk and therefore
 * always available. It hides the splash, because on a cold start it can be the
 * first screen mounted.
 */
import { StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { useTokens } from '../theme/tokens'
import { useHideSplash } from '../useHideSplash'
import { AuthButton } from './AuthButton'

export function SessionError({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void
  onSignOut: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const onLayout = useHideSplash()

  return (
    <View
      testID="session-error"
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: tokens.bg }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.fg }]}
      >
        {t.session.title}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { color: tokens.muted }]}
      >
        {t.session.body}
      </Text>
      <View style={styles.actions}>
        <AuthButton label={t.actions.retry} onPress={onRetry} />
        <AuthButton
          variant="secondary"
          label={t.signedIn.signOut}
          onPress={onSignOut}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 44,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 12 },
})
