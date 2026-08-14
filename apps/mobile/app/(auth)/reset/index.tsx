/**
 * Reset, step one: which account.
 *
 * Two calls, not one. `signIn.create({ identifier })` is what tells Clerk whose
 * password this is — `resetPasswordEmailCode.sendCode()` takes no arguments and
 * sends to "the first email address on the account", so without the `create()`
 * there is no account for it to mean.
 *
 * The three steps are three screens sharing one `SignInFuture` resource, which
 * lives on the Clerk client rather than in a param or a context. That is what
 * makes the back gesture work between them: going back a step does not discard
 * the attempt, it just stops looking at it.
 */
import { useState } from 'react'
import { useSignIn } from '@clerk/expo'
import { useRouter } from 'expo-router'

import { AuthButton } from '../../../src/components/AuthButton'
import { AuthError } from '../../../src/components/AuthError'
import { AuthField } from '../../../src/components/AuthField'
import { AuthScreen } from '../../../src/components/AuthScreen'
import { pickError, type CodedError } from '../../../src/auth/clerkErrors'
import { useI18n } from '../../../src/i18n'

export default function ResetRequest() {
  const { t } = useI18n()
  const router = useRouter()
  const { signIn, errors } = useSignIn()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)

  const ready = email.trim().length > 0
  const error = pickError(errors, returned, t)

  async function submit() {
    setBusy(true)
    setReturned(null)

    const created = await signIn.create({ identifier: email.trim() })
    if (created.error) {
      setReturned(created.error)
      setBusy(false)
      return
    }

    const sent = await signIn.resetPasswordEmailCode.sendCode()
    if (sent.error) {
      setReturned(sent.error)
      setBusy(false)
      return
    }

    setBusy(false)
    router.push({ pathname: '/reset/code', params: { email: email.trim() } })
  }

  return (
    <AuthScreen
      heading={t.reset.request.heading}
      subtitle={t.reset.request.subtitle}
    >
      <AuthField
        label={t.fields.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => ready && submit()}
      />

      <AuthError message={error} />

      <AuthButton
        label={t.reset.request.submit}
        busy={busy}
        disabled={!ready}
        onPress={submit}
      />
    </AuthScreen>
  )
}
