/**
 * The six digits that prove the address is yours.
 *
 * The address is passed as a route param purely so the screen can say it back —
 * "we sent a code to *this*" is the difference between a person checking the
 * right inbox and a person checking the wrong one. The sign-up state itself
 * lives on Clerk's `SignUpFuture` resource, which survives this navigation, so
 * nothing functional depends on the param.
 *
 * `autoComplete="sms-otp"` covers Android's autofill of a code that arrives by
 * SMS; the email code has no equivalent, so the keyboard is the fallback and the
 * field is numeric and capped at six.
 */
import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useSignUp } from '@clerk/expo'
import { useLocalSearchParams } from 'expo-router'

import { AuthButton } from '../../src/components/AuthButton'
import { AuthError } from '../../src/components/AuthError'
import { AuthField } from '../../src/components/AuthField'
import { AuthLink } from '../../src/components/AuthLink'
import { AuthScreen } from '../../src/components/AuthScreen'
import { pickError, type CodedError } from '../../src/auth/clerkErrors'
import { useTokens } from '../../src/theme/tokens'
import { fmt, useI18n } from '../../src/i18n'

const CODE_LENGTH = 6

export default function VerifyEmail() {
  const { t } = useI18n()
  const { signUp, errors } = useSignUp()
  const { email } = useLocalSearchParams<{ email?: string }>()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const error = pickError(errors, returned, t)

  async function submit() {
    setBusy(true)
    setReturned(null)
    setNotice(null)

    const verified = await signUp.verifications.verifyEmailCode({ code })
    if (verified.error) {
      setReturned(verified.error)
      setBusy(false)
      return
    }

    // As with sign-in, `finalize()` is what turns a complete sign-up into a
    // session. The redirect out of `(auth)` unmounts this screen.
    const finalized = await signUp.finalize()
    if (finalized.error) {
      setReturned(finalized.error)
      setBusy(false)
    }
  }

  async function resend() {
    setReturned(null)
    const sent = await signUp.verifications.sendEmailCode()
    if (sent.error) {
      setReturned(sent.error)
      return
    }
    setNotice(t.verify.resent)
  }

  return (
    <AuthScreen
      heading={t.verify.heading}
      subtitle={fmt(t.verify.subtitle, { email: email ?? '' })}
      footer={<AuthLink label={t.actions.resend} onPress={resend} />}
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
      {notice ? <AuthNotice message={notice} /> : null}

      <AuthButton
        label={t.verify.submit}
        busy={busy}
        disabled={code.length !== CODE_LENGTH}
        onPress={submit}
      />
    </AuthScreen>
  )
}

/** The only good-news message in the whole flow; not worth its own file. */
function AuthNotice({ message }: { message: string }) {
  const tokens = useTokens()
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[noticeStyles.text, { color: tokens.muted }]}
    >
      {message}
    </Text>
  )
}

const noticeStyles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20 },
})
