/**
 * Create an account: address, password, then a code to prove the address.
 *
 * The code is requested *here*, before navigating, so that the verify screen is
 * only ever reached with a code already in flight. Sending it from the verify
 * screen's mount instead would re-send on every remount — including the one a
 * back-and-forward produces — and Clerk rate-limits that.
 *
 * `autoComplete="new-password"` is what makes the platform offer to generate and
 * save one, which is the only reason the sign-in screen has anything to fill.
 *
 * Clerk **Core 3** (ADR-0014). The phone is a Clerk generation ahead of the
 * web, which is Core 2 via `@appelent/auth` — so that package's form logic
 * reads like a reference implementation and is not one. Same hook names,
 * different returns: `{ error }` instead of `throw`, `finalize()` instead of
 * `setActive()`, per-field errors on the hook's `errors` signal.
 */

import { useSignUp } from '@clerk/expo'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { type CodedError, pickError } from '../../src/auth/clerkErrors'
import { AuthButton } from '../../src/components/AuthButton'
import { AuthError } from '../../src/components/AuthError'
import { AuthField } from '../../src/components/AuthField'
import { AuthLink } from '../../src/components/AuthLink'
import { AuthScreen } from '../../src/components/AuthScreen'
import { SocialSoon } from '../../src/components/SocialSoon'
import { useI18n } from '../../src/i18n'

export default function SignUp() {
  const { t } = useI18n()
  const router = useRouter()
  const { signUp, errors } = useSignUp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)
  const passwordRef = useRef<TextInput>(null)

  const ready = email.trim().length > 0 && password.length > 0
  const error = pickError(errors, returned, t)

  async function submit() {
    setBusy(true)
    setReturned(null)

    const created = await signUp.password({
      emailAddress: email.trim(),
      password,
    })
    if (created.error) {
      setReturned(created.error)
      setBusy(false)
      return
    }

    const sent = await signUp.verifications.sendEmailCode()
    if (sent.error) {
      setReturned(sent.error)
      setBusy(false)
      return
    }

    setBusy(false)
    router.push({
      pathname: '/verify-email',
      params: { email: email.trim() },
    })
  }

  return (
    <AuthScreen
      heading={t.signUp.heading}
      subtitle={t.signUp.subtitle}
      footer={
        <AuthLink
          prompt={t.signUp.haveAccount}
          label={t.signUp.signIn}
          onPress={() => router.replace('/sign-in')}
        />
      }
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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label={t.fields.password}
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => ready && submit()}
      />

      <AuthError message={error} />

      <AuthButton
        label={t.signUp.submit}
        busy={busy}
        disabled={!ready}
        onPress={submit}
      />

      <SocialSoon />
    </AuthScreen>
  )
}
