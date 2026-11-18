/**
 * Email and password.
 *
 * `autoComplete` / `textContentType` are what let the platform password manager
 * fill this and — more importantly — offer to *save* a password created in the
 * sign-up flow. Getting them wrong does not break anything visibly, which is
 * exactly why they are easy to leave out.
 *
 * "Email me a code" is the passwordless way in: it sends the code from here,
 * where the address is already typed, and only then opens `sign-in-code`. A
 * failed send stays on this screen with its error. Password and code share the
 * one error box, so `source` says which of the two the person last tried.
 *
 * The submit does not navigate. `finalize()` flips `isSignedIn`, the `(auth)`
 * layout redirects, and this screen unmounts; see `usePasswordSignIn`.
 *
 * Sign in submits through `useCredentialFields`, so a saved login AutoFill
 * filled without `onChangeText` is the one sent, even mid-edit.
 */

import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import type { TextInputInstance } from 'react-native'
import { useCredentialFields } from '../../../auth/useCredentialFields'
import { usePasswordSignIn } from '../../../auth/usePasswordSignIn'
import { AuthError } from '../../../components/AuthError'
import { AuthLink } from '../../../components/AuthLink'
import { AuthScreen } from '../../../components/AuthScreen'
import { SocialButtons } from '../../../components/SocialButtons'
import { haptics } from '../../../feedback/haptics'
import { useI18n } from '../../../i18n'
import { Button } from '../../../ui/button'
import { Field } from '../../../ui/field'
import { useEmailCodeSignIn } from '../use-email-code-sign-in'

export function SignInScreen() {
  const { t } = useI18n()
  const router = useRouter()
  const passwordSignIn = usePasswordSignIn()
  const emailCode = useEmailCodeSignIn()
  const [source, setSource] = useState<'password' | 'code'>('password')
  // Not gated on the email: AutoFill can fill it without reporting it, and
  // Clerk's "enter your email" beats a silent button.
  const form = useCredentialFields(
    { email: '', password: '' },
    (latest) => {
      if (latest.password.length > 0 && !busy) signInWithPassword(latest)
    },
  )
  const { email, password } = form.values
  const passwordRef = useRef<TextInputInstance>(null)

  const hasEmail = email.trim().length > 0
  const ready = hasEmail && password.length > 0
  const busy = passwordSignIn.busy || emailCode.busy
  const error = source === 'code' ? emailCode.error : passwordSignIn.error

  function signInWithPassword(latest: { email: string; password: string }) {
    setSource('password')
    passwordSignIn.submit(latest.email, latest.password)
  }

  async function signInWithCode() {
    setSource('code')
    if (await emailCode.send(email)) {
      router.push({
        pathname: '/sign-in-code',
        params: { email: email.trim() },
      })
    } else {
      haptics.actionFailed()
    }
  }

  return (
    <AuthScreen
      heading={t.signIn.heading}
      footer={
        <AuthLink
          prompt={t.signIn.noAccount}
          label={t.signIn.createOne}
          onPress={() => router.replace('/sign-up')}
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
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={form.submitFrom('password')}
      />

      <AuthError message={error} />

      <Button
        testID="sign-in-submit"
        label={t.signIn.submit}
        busy={passwordSignIn.busy}
        disabled={(!ready && !form.editing) || emailCode.busy}
        onPress={form.press}
      />
      <Button
        testID="sign-in-email-code"
        variant="secondary"
        label={t.signIn.emailCode.send}
        busy={emailCode.busy}
        disabled={!hasEmail || passwordSignIn.busy}
        onPress={signInWithCode}
      />
      <AuthLink label={t.signIn.forgot} onPress={() => router.push('/reset')} />

      <SocialButtons />
    </AuthScreen>
  )
}
