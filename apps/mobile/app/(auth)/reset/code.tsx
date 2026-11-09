/**
 * Reset, step two: the code from the email.
 *
 * A correct code moves `signIn.status` to `'needs_new_password'`. It does not
 * sign anyone in and must not look as though it has — hence a third screen
 * rather than revealing a password field in place.
 */

import { useSignIn } from '@clerk/expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { type CodedError, pickError } from '../../../src/auth/clerkErrors'
import { CODE_LENGTH } from '../../../src/auth/codeLength'
import { AuthError } from '../../../src/components/AuthError'
import { AuthScreen } from '../../../src/components/AuthScreen'
import { Button } from '../../../src/components/Button'
import { Field } from '../../../src/components/Field'
import { fmt, useI18n } from '../../../src/i18n'

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
    // The code has been consumed. Keeping this screen in history would strand
    // a Back navigation on a code that cannot be submitted again.
    router.replace('/reset/password')
  }

  return (
    <AuthScreen
      heading={t.reset.code.heading}
      subtitle={fmt(t.reset.code.subtitle, { email: email ?? '' })}
    >
      <Field
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

      <Button
        label={t.reset.code.submit}
        busy={busy}
        disabled={code.length !== CODE_LENGTH}
        onPress={submit}
      />
    </AuthScreen>
  )
}
