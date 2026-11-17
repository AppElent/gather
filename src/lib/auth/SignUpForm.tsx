import { useSignUp } from '@clerk/react'
import { useState } from 'react'
import { fmt, useMessages } from '../i18n'
import { AuthButton } from './AuthButton'
import { useAuthConfig } from './AuthConfigProvider'
import { AuthError } from './AuthError'
import { AuthField } from './AuthField'
import { orThrow } from './clerkResult'
import { clerkErrorMessage } from './core'
import { SocialButtons } from './SocialButtons'
import { useOnceClerkLoaded } from './useOnceClerkLoaded'

export function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp } = useSignUp()
  const config = useAuthConfig()
  const { auth } = useMessages()
  const [step, setStep] = useState<'details' | 'verify'>('details')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // An Apple or Microsoft sign-up that Clerk could not finish comes back here
  // from `/sso-callback` at `missing_requirements`. Only an OAuth attempt (it
  // has an external account), so an abandoned email sign-up is left alone. An
  // email that is the only thing left to verify is the one gap this form can
  // close; anything else it says it cannot.
  useOnceClerkLoaded(() => {
    if (
      signUp.status !== 'missing_requirements' ||
      !signUp.verifications.externalAccount?.status
    ) {
      return
    }
    const address = signUp.emailAddress
    if (
      address &&
      signUp.missingFields.length === 0 &&
      signUp.unverifiedFields.length === 1 &&
      signUp.unverifiedFields[0] === 'email_address'
    ) {
      setEmail(address)
      setLoading(true)
      orThrow(signUp.verifications.sendEmailCode())
        .then(() => setStep('verify'))
        .catch((err) => setError(clerkErrorMessage(err, auth.errors.generic)))
        .finally(() => setLoading(false))
    } else {
      setError(auth.signUp.needsMore)
    }
  })

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await orThrow(signUp.password({ emailAddress: email, password }))
      await orThrow(signUp.verifications.sendEmailCode())
      setStep('verify')
    } catch (err) {
      setError(clerkErrorMessage(err, auth.errors.generic))
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await orThrow(signUp.verifications.verifyEmailCode({ code }))
      if (signUp.status === 'complete') {
        await orThrow(signUp.finalize())
        onSuccess()
      } else {
        setError(auth.errors.invalidVerification)
      }
    } catch (err) {
      setError(clerkErrorMessage(err, auth.errors.generic))
    } finally {
      setLoading(false)
    }
  }

  if (step === 'verify') {
    return (
      <form onSubmit={submitCode} noValidate className="flex flex-col gap-3">
        <AuthError message={error} />
        <p className="text-sm text-[var(--auth-muted)]">
          {fmt(auth.signUp.codeSent, { email })}
        </p>
        <AuthField
          label={auth.verificationCode}
          type="text"
          autoComplete="one-time-code"
          value={code}
          onChange={setCode}
          required
        />
        <AuthButton loading={loading}>{auth.signUp.verify}</AuthButton>
      </form>
    )
  }

  return (
    <form onSubmit={submitDetails} noValidate className="flex flex-col gap-3">
      <AuthError message={error} />
      <AuthField
        label={auth.email}
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
      />
      <AuthField
        label={auth.password}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        required
      />
      <AuthButton loading={loading}>{auth.signUp.submit}</AuthButton>
      <SocialButtons />
      <div className="mt-1 text-center text-xs text-[var(--auth-muted)]">
        <a href={config.paths.signIn} className="hover:underline">
          {auth.signUp.haveAccount}
        </a>
      </div>
    </form>
  )
}
