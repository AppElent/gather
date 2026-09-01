/**
 * The name other members see, in the two halves Clerk stores it in.
 *
 * One field would have been kinder to type into and wrong to store: Clerk holds
 * `firstName` and `lastName` separately, and splitting a typed string back into
 * them is a guess that gets Dutch surnames wrong ("van der Berg") in exactly
 * the households this app is for.
 *
 * Saving goes back rather than staying put with a tick. The screen changing is
 * the confirmation (`docs/mobile-interaction.md`); the previous screen already
 * draws the new name.
 */
import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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

export default function EditName() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const insets = useSafeAreaInsets()
  const last = useRef<TextInput>(null)

  const [first, setFirst] = useState(user?.firstName ?? '')
  const [family, setFamily] = useState(user?.lastName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!user || busy) return
    setBusy(true)
    setError(null)
    try {
      await user.update({ firstName: first.trim(), lastName: family.trim() })
      router.back()
    } catch (cause) {
      setError(readThrown(cause, t))
    } finally {
      setBusy(false)
    }
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
        <SettingsCard description={t.account.editName.description}>
          <View style={styles.fields}>
            <AuthField
              testID="account-first-name"
              label={t.account.editName.first}
              value={first}
              onChangeText={setFirst}
              autoComplete="given-name"
              textContentType="givenName"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => last.current?.focus()}
            />
            <AuthField
              ref={last}
              testID="account-last-name"
              label={t.account.editName.last}
              value={family}
              onChangeText={setFamily}
              autoComplete="family-name"
              textContentType="familyName"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void save()}
            />
          </View>
        </SettingsCard>

        <AuthError message={error} />

        <AuthButton
          label={t.actions.save}
          busy={busy}
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
})
