/**
 * Changing the password, and signing every other session out while doing it.
 *
 * `signOutOfOtherSessions` is not an option offered here, it is the behaviour:
 * a person changing a password is either tidying up or has decided somebody
 * else has it, and the second case is the one worth designing for. The
 * description says so before the fields rather than after the fact.
 *
 * An account with no password at all — signed up through a provider — gets a
 * sentence instead of a form. Clerk would reject the call, and a form that
 * cannot succeed is worse than being told why.
 *
 * iOS AutoFill needs the change-password shape to tell the fields apart: the
 * account's email as a read-only `username`, then the current password, then
 * the new one. Without the username it reads both secure fields as new
 * passwords, and declining its strong-password offer clears both.
 * The button submits through `useCredentialFields`, so the passwords sent are
 * the ones the fields show, even when AutoFill set one without reporting it.
 */
import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { readThrown } from '../../../../../src/auth/clerkErrors'
import { useCredentialFields } from '../../../../../src/auth/useCredentialFields'
import { AuthError } from '../../../../../src/components/AuthError'
import { SettingsCard } from '../../../../../src/components/SettingsCard'
import { useI18n } from '../../../../../src/i18n'
import { TYPE, useTokens } from '../../../../../src/theme/tokens'
import { Button } from '../../../../../src/ui/button'
import { Field } from '../../../../../src/ui/field'

export default function ChangePassword() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const insets = useSafeAreaInsets()
  const next = useRef<TextInputInstance>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useCredentialFields(
    { current: '', password: '' },
    (latest) => void save(latest),
  )
  const ready =
    form.values.current.length > 0 && form.values.password.length > 0

  async function save({
    current,
    password,
  }: {
    current: string
    password: string
  }) {
    if (!user || busy || current.length === 0 || password.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await user.updatePassword({
        currentPassword: current,
        newPassword: password,
        signOutOfOtherSessions: true,
      })
      router.back()
    } catch (cause) {
      setError(readThrown(cause, t))
    } finally {
      setBusy(false)
    }
  }

  if (user && !user.passwordEnabled) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.note, { color: tokens.muted }]}>
          {t.account.changePassword.noPassword}
        </Text>
      </ScrollView>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fill}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <SettingsCard description={t.account.changePassword.description}>
          <View style={styles.fields}>
            <Field
              testID="account-password-email"
              label={t.fields.email}
              value={user?.primaryEmailAddress?.emailAddress ?? ''}
              editable={false}
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
            />
            <Field
              testID="account-current-password"
              label={t.account.changePassword.current}
              {...form.field('current')}
              secure
              autoComplete="current-password"
              textContentType="password"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => next.current?.focus()}
            />
            <Field
              ref={next}
              testID="account-new-password"
              label={t.account.changePassword.next}
              {...form.field('password')}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={form.submitFrom('password')}
            />
          </View>
        </SettingsCard>

        <AuthError message={error} />

        <Button
          testID="account-password-submit"
          label={t.account.changePassword.submit}
          busy={busy}
          disabled={!ready && !form.editing}
          onPress={form.press}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  fields: { gap: 12 },
  note: { ...TYPE.subhead },
})
