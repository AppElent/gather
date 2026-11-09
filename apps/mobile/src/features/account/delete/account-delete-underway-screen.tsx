/**
 * The account while it is being deleted, drawn in place of the signed-in tree
 * (`AccountDeleteProvider`).
 *
 * Most of the time it is on screen for one Clerk round trip and then the app
 * signs out. It exists for the other case: Clerk refusing once the household
 * is already being purged. That is the one failure here the person has to
 * read, so it is said on a screen nothing can unmount, with the two ways on:
 * ask Clerk again, or sign out. Signing out is local to Clerk and therefore
 * always available.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { AuthError } from '../../../components/AuthError'
import { useI18n } from '../../../i18n'
import { TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import type { AccountDeleteValue } from './account-delete-provider'

export function AccountDeleteUnderwayScreen({
  state,
  retryLogin,
  onSignOut,
}: Pick<AccountDeleteValue, 'state' | 'retryLogin'> & {
  onSignOut: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const stranded = state.step === 'stranded'

  return (
    <View
      testID="account-delete-underway"
      style={[styles.wrap, { backgroundColor: tokens.bg }]}
    >
      {stranded ? (
        <View style={styles.actions}>
          <AuthError message={t.account.deleteAccount.partlyFailed} />
          <Button
            testID="account-delete-retry"
            label={t.common.actions.retry}
            onPress={retryLogin}
          />
          <Button
            variant="secondary"
            label={t.signedIn.signOut}
            onPress={onSignOut}
          />
        </View>
      ) : (
        <>
          <ActivityIndicator color={tokens.muted} />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.text, { color: tokens.muted }]}
          >
            {t.account.deleteAccount.underway}
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  text: { ...TYPE.body, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 12 },
})
