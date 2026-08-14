/**
 * Reset, step two: the code from the email.
 *
 * A correct code moves `signIn.status` to `'needs_new_password'`. It does not
 * sign anyone in and must not look as though it has — hence a third screen
 * rather than revealing a password field in place.
 *
 * Clerk **Core 3** (ADR-0014). The phone is a Clerk generation ahead of the
 * web, which is Core 2 via `@appelent/auth` — so that package's form logic
 * reads like a reference implementation and is not one. Same hook names,
 * different returns: `{ error }` instead of `throw`, `finalize()` instead of
 * `setActive()`, per-field errors on the hook's `errors` signal.
 */
import { useState } from 'react'
import { useSignIn } from '@clerk/expo'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { AuthButton } from '../../../src/components/AuthButton'
import { AuthError } from '../../../src/components/AuthError'
import { AuthField } from '../../../src/components/AuthField'
import { AuthScreen } from '../../../src/components/AuthScreen'
import { pickError, type CodedError } from '../../../src/auth/clerkErrors'
import { fmt, useI18n } from '../../../src/i18n'

const CODE_LENGTH = 6

export default function ResetCode() {
  const { t } = useI18n()
  const router = useRouter()
  const { signIn, errors } = useSignIn()
  const { email } = useLocalSearchParams<{ email?: string }>()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)

  const error = pickError(errors, returned, t)

  async function submit() {
    setBusy(true)
    setReturned(null)

    const verified = await signIn.resetPasswordEmailCode.verifyCode({ code })
    if (verified.error) {
      setReturned(verified.error)
      setBusy(false)
      return
    }

    setBusy(false)
    router.push('/reset/password')
  }

  return (
    <AuthScreen
      heading={t.reset.code.heading}
      subtitle={fmt(t.reset.code.subtitle, { email: email ?? '' })}
    >
      <AuthField
        label={t.fields.code}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => code.length === CODE_LENGTH && submit()}
      />

      <AuthError message={error} />

      <AuthButton
        label={t.reset.code.submit}
        busy={busy}
        disabled={code.length !== CODE_LENGTH}
        onPress={submit}
      />
    </AuthScreen>
  )
}
