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
 * Clerk **Core 3** (ADR-0014). The phone is a Clerk generation ahead of the
 * web, which is Core 2 in `src/lib/auth` — so the web's form logic
 * reads like a reference implementation and is not one. Same hook names,
 * different returns: `{ error }` instead of `throw`, `finalize()` instead of
 * `setActive()`, per-field errors on the hook's `errors` signal.
 */

import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { usePasswordSignIn } from '../../src/auth/usePasswordSignIn'
import { AuthButton } from '../../src/components/AuthButton'
import { AuthError } from '../../src/components/AuthError'
import { AuthField } from '../../src/components/AuthField'
import { AuthLink } from '../../src/components/AuthLink'
import { AuthScreen } from '../../src/components/AuthScreen'
import { SocialSoon } from '../../src/components/SocialSoon'
import { useEmailCodeSignIn } from '../../src/features/auth/sign-in-code/use-email-code-sign-in'
import { haptics } from '../../src/feedback/haptics'
import { useI18n } from '../../src/i18n'

export default function SignIn() {
  const { t } = useI18n()
  const router = useRouter()
  const passwordSignIn = usePasswordSignIn()
  const emailCode = useEmailCodeSignIn()
  const [source, setSource] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<TextInput>(null)

  const hasEmail = email.trim().length > 0
  const ready = hasEmail && password.length > 0
  const busy = passwordSignIn.busy || emailCode.busy
  const error = source === 'code' ? emailCode.error : passwordSignIn.error

  function signInWithPassword() {
    setSource('password')
    passwordSignIn.submit(email, password)
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
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => ready && !busy && signInWithPassword()}
      />

      <AuthError message={error} />

      <AuthButton
        testID="sign-in-submit"
        label={t.signIn.submit}
        busy={passwordSignIn.busy}
        disabled={!ready || emailCode.busy}
        onPress={signInWithPassword}
      />
      <AuthButton
        testID="sign-in-email-code"
        variant="secondary"
        label={t.signIn.emailCode.send}
        busy={emailCode.busy}
        disabled={!hasEmail || passwordSignIn.busy}
        onPress={signInWithCode}
      />
      <AuthLink label={t.signIn.forgot} onPress={() => router.push('/reset')} />

      <SocialSoon />
    </AuthScreen>
  )
}
