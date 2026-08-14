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
 */
import { useState } from 'react'
import { useSignIn } from '@clerk/expo'

import { AuthButton } from '../../../src/components/AuthButton'
import { AuthError } from '../../../src/components/AuthError'
import { AuthField } from '../../../src/components/AuthField'
import { AuthScreen } from '../../../src/components/AuthScreen'
import { pickError, type CodedError } from '../../../src/auth/clerkErrors'
import { useI18n } from '../../../src/i18n'

export default function ResetPassword() {
  const { t } = useI18n()
  const { signIn, errors } = useSignIn()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)

  const error = pickError(errors, returned, t)

  async function submit() {
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
      <AuthField
        label={t.fields.newPassword}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => password.length > 0 && submit()}
      />

      <AuthError message={error} />

      <AuthButton
        label={t.reset.password.submit}
        busy={busy}
        disabled={password.length === 0}
        onPress={submit}
      />
    </AuthScreen>
  )
}
