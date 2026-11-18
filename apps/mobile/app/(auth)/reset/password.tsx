/**
 * Reset, step three: the new password, and the way back in.
 *
 * `submitPassword()` completes the sign-in but — as everywhere else in Core 3 —
 * does not activate the session. `finalize()` does, and skipping it here would
 * leave someone with a changed password sitting on the reset screen wondering
 * whether it worked.
 *
 * `signOutOfOtherSessions` is deliberately not passed. Someone resetting a
 * password they merely forgot should not have their other devices kicked out;
 * someone resetting one they think was stolen wants exactly that. Neither
 * default is right without asking, and asking is a question this prototype has
 * no answer for — see the resolution on #147.
 *
 * The email the reset started with sits above the password as a read-only
 * `username` field. Without it iCloud Keychain cannot tell whose password
 * this is, and saves a second login instead of updating the existing one.
 * The button submits through `useCredentialFields`, so a strong password
 * AutoFill filled while the field had focus is the one that is sent.
 */

import { useSignIn } from '@clerk/expo'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { type CodedError, pickError } from '../../../src/auth/clerkErrors'
import { useCredentialFields } from '../../../src/auth/useCredentialFields'
import { AuthError } from '../../../src/components/AuthError'
import { AuthScreen } from '../../../src/components/AuthScreen'
import { useI18n } from '../../../src/i18n'
import { Button } from '../../../src/ui/button'
import { Field } from '../../../src/ui/field'

export default function ResetPassword() {
  const { t } = useI18n()
  const { signIn, errors } = useSignIn()
  const { email } = useLocalSearchParams<{ email?: string }>()
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)

  const form = useCredentialFields({ password: '' }, ({ password }) => {
    if (password.length > 0 && !busy) void submit(password)
  })
  const error = pickError(errors, returned, t)

  async function submit(password: string) {
    setBusy(true)
    setReturned(null)

    const saved = await signIn.resetPasswordEmailCode.submitPassword({
      password,
    })
    if (saved.error) {
      setReturned(saved.error)
      setBusy(false)
      return
    }

    const finalized = await signIn.finalize()
    if (finalized.error) {
      setReturned(finalized.error)
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      heading={t.reset.password.heading}
      subtitle={t.reset.password.subtitle}
    >
      {email ? (
        <Field
          label={t.fields.email}
          value={email}
          editable={false}
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
        />
      ) : null}
      <Field
        label={t.fields.newPassword}
        {...form.field('password')}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={form.submitFrom('password')}
      />

      <AuthError message={error} />

      <Button
        testID="reset-password-submit"
        label={t.reset.password.submit}
        busy={busy}
        disabled={form.values.password.length === 0 && !form.editing}
        onPress={form.press}
      />
    </AuthScreen>
  )
}
