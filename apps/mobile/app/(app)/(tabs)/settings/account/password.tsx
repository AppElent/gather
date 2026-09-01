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
  type TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { readThrown } from '../../../../../src/auth/clerkErrors'
import { AuthButton } from '../../../../../src/components/AuthButton'
import { AuthError } from '../../../../../src/components/AuthError'
import { AuthField } from '../../../../../src/components/AuthField'
import { SettingsCard } from '../../../../../src/components/SettingsCard'
import { useI18n } from '../../../../../src/i18n'
import { useTokens } from '../../../../../src/theme/tokens'

export default function ChangePassword() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const insets = useSafeAreaInsets()
  const next = useRef<TextInput>(null)

  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = current.length > 0 && password.length > 0

  async function save() {
    if (!user || busy || !ready) return
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
        style={{ backgroundColor: tokens.bg }}
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
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <SettingsCard description={t.account.changePassword.description}>
          <View style={styles.fields}>
            <AuthField
              testID="account-current-password"
              label={t.account.changePassword.current}
              value={current}
              onChangeText={setCurrent}
              secure
              autoComplete="current-password"
              textContentType="password"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => next.current?.focus()}
            />
            <AuthField
              ref={next}
              testID="account-new-password"
              label={t.account.changePassword.next}
              value={password}
              onChangeText={setPassword}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => void save()}
            />
          </View>
        </SettingsCard>

        <AuthError message={error} />

        <AuthButton
          label={t.account.changePassword.submit}
          busy={busy}
          disabled={!ready}
          onPress={() => void save()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  fields: { gap: 12 },
  note: { fontSize: 15, lineHeight: 21 },
})
