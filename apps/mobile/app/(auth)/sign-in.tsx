/**
 * Email and password.
 *
 * `autoComplete` / `textContentType` are what let the platform password manager
 * fill this and — more importantly — offer to *save* a password created in the
 * sign-up flow. Getting them wrong does not break anything visibly, which is
 * exactly why they are easy to leave out.
 *
 * The submit does not navigate. `finalize()` flips `isSignedIn`, the `(auth)`
 * layout redirects, and this screen unmounts; see `usePasswordSignIn`.
 */
import { useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { useRouter } from 'expo-router'

import { AuthButton } from '../../src/components/AuthButton'
import { AuthError } from '../../src/components/AuthError'
import { AuthField } from '../../src/components/AuthField'
import { AuthLink } from '../../src/components/AuthLink'
import { AuthScreen } from '../../src/components/AuthScreen'
import { SocialSoon } from '../../src/components/SocialSoon'
import { usePasswordSignIn } from '../../src/auth/usePasswordSignIn'
import { useI18n } from '../../src/i18n'

export default function SignIn() {
  const { t } = useI18n()
  const router = useRouter()
  const { submit, busy, error } = usePasswordSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<TextInput>(null)

  const ready = email.trim().length > 0 && password.length > 0

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
        onSubmitEditing={() => ready && submit(email, password)}
      />

      <AuthError message={error} />

      <AuthButton
        label={t.signIn.submit}
        busy={busy}
        disabled={!ready}
        onPress={() => submit(email, password)}
      />
      <AuthLink
        label={t.signIn.forgot}
        onPress={() => router.push('/reset')}
      />

      <SocialSoon />
    </AuthScreen>
  )
}
