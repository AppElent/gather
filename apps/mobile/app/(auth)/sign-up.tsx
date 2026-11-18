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
 * The button submits through `useCredentialFields`: the strong password iOS
 * offers lands in the field without `onChangeText`, and it is the one Clerk
 * must get.
 */

import { useSignUp } from '@clerk/expo'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import type { TextInputInstance } from 'react-native'
import { type CodedError, pickError } from '../../src/auth/clerkErrors'
import { useCredentialFields } from '../../src/auth/useCredentialFields'
import { AuthError } from '../../src/components/AuthError'
import { AuthLink } from '../../src/components/AuthLink'
import { AuthScreen } from '../../src/components/AuthScreen'
import { SocialButtons } from '../../src/components/SocialButtons'
import { useI18n } from '../../src/i18n'
import { Button } from '../../src/ui/button'
import { Field } from '../../src/ui/field'

export default function SignUp() {
  const { t } = useI18n()
  const router = useRouter()
  const { signUp, errors } = useSignUp()
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)
  const passwordRef = useRef<TextInputInstance>(null)

  // Not gated on the email: AutoFill can fill it without reporting it, and
  // Clerk's "enter your email" beats a silent button.
  const form = useCredentialFields(
    { email: '', password: '' },
    (latest) => {
      if (latest.password.length > 0 && !busy) void submit(latest)
    },
  )
  const ready =
    form.values.email.trim().length > 0 && form.values.password.length > 0
  const error = pickError(errors, returned, t)

  async function submit({
    email,
    password,
  }: {
    email: string
    password: string
  }) {
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
      <Field
        label={t.fields.email}
        {...form.field('email')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        label={t.fields.password}
        {...form.field('password')}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={form.submitFrom('password')}
      />

      <AuthError message={error} />

      <Button
        testID="sign-up-submit"
        label={t.signUp.submit}
        busy={busy}
        disabled={!ready && !form.editing}
        onPress={form.press}
      />

      <SocialButtons />
    </AuthScreen>
  )
}
