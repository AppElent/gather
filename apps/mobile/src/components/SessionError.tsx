/**
 * The signed-in tree could not confirm who is signed in.
 *
 * `SessionIdentityBoundary`'s fallback, laid out like `AuthUnavailable`: a
 * failure the person did not cause, so it says what happened and offers the two
 * ways out — try again, which remounts the gate and asks Convex to
 * authenticate afresh, and sign out, which is local to Clerk and therefore
 * always available. It hides the splash, because on a cold start it can be the
 * first screen mounted.
 *
 * `AccountBeingDeleted` is the same layout for the one closed-gate cause it
 * can name: the account is being deleted (APP-939).
 */
import { StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../i18n'
import { TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { useHideSplash } from '../useHideSplash'

export function SessionError({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void
  onSignOut: () => void
}) {
  const { t } = useI18n()
  return (
    <SessionScreen
      testID="session-error"
      title={t.session.title}
      body={t.session.body}
      onRetry={onRetry}
      onSignOut={onSignOut}
    />
  )
}

/**
 * The account is being deleted, usually from another phone (APP-939): the
 * backend refuses to provision it, so trying again cannot help and Sign out
 * is the one way on.
 */
export function AccountBeingDeleted({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useI18n()
  return (
    <SessionScreen
      testID="session-account-deleted"
      title={t.session.deletedTitle}
      body={t.session.deletedBody}
      onSignOut={onSignOut}
    />
  )
}

function SessionScreen({
  testID,
  title,
  body,
  onRetry,
  onSignOut,
}: {
  testID: string
  title: string
  body: string
  onRetry?: () => void
  onSignOut: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const onLayout = useHideSplash()

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: tokens.ground }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.ink }]}
      >
        {title}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { color: tokens.muted }]}
      >
        {body}
      </Text>
      <View style={styles.actions}>
        {onRetry ? (
          <Button label={t.common.actions.retry} onPress={onRetry} />
        ) : null}
        <Button
          variant={onRetry ? 'secondary' : 'primary'}
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
    ...TYPE.title2,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  text: { ...TYPE.subhead, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 12 },
})
