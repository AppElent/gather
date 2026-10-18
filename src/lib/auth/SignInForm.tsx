import { useSignIn } from '@clerk/clerk-react'
import { useState } from 'react'
import { fmt, useMessages } from '../i18n'
import { AuthButton } from './AuthButton'
import { useAuthConfig } from './AuthConfigProvider'
import { AuthError } from './AuthError'
import { AuthField } from './AuthField'
import {
  clerkErrorMessage,
  type EmailCodeErrorKey,
  emailCodeErrorKey,
  pickSecondFactor,
  type SecondFactorStrategy,
} from './core'
import { TestLoginButton } from './TestLoginButton'
import { useCooldown } from './useCooldown'

/** Seconds "Send a new code" stays disabled after a send. */
const RESEND_COOLDOWN_SECONDS = 30

type SignIn = NonNullable<ReturnType<typeof useSignIn>['signIn']>
type FirstFactor = NonNullable<SignIn['supportedFirstFactors']>[number]
type EmailCodeFactor = Extract<FirstFactor, { strategy: 'email_code' }>

function emailCodeFactor(factors: SignIn['supportedFirstFactors']) {
  return factors?.find((f): f is EmailCodeFactor => f.strategy === 'email_code')
}

type SecondFactorStep = {
  strategy: SecondFactorStrategy
  safeIdentifier?: string
}

/**
 * Which screen is showing: credentials (password, or "email me a code"), the
 * code sent for a passwordless sign-in, or the second factor that follows
 * either of them.
 */
type Step = 'credentials' | 'emailCode' | 'secondFactor'

export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { isLoaded, signIn, setActive } = useSignIn()
  const config = useAuthConfig()
  const { auth } = useMessages()
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [secondFactor, setSecondFactor] = useState<SecondFactorStep | null>(
    null,
  )
  const [code, setCode] = useState('')
  // Hold a key, not a sentence, so the message follows the language toggle.
  const [errorKey, setErrorKey] = useState<
    keyof typeof auth.errors | EmailCodeErrorKey | null
  >(null)
  const [clerkError, setClerkError] = useState<string | null>(null)
  const [notice, setNotice] = useState(false)
  const [loading, setLoading] = useState(false)

  const error = errorKey ? auth.errors[errorKey] : clerkError

  function clearFeedback() {
    setErrorKey(null)
    setClerkError(null)
    setNotice(false)
  }

  function fail(err: unknown) {
    const key = emailCodeErrorKey(err)
    if (key) {
      setErrorKey(key)
    } else {
      setClerkError(clerkErrorMessage(err, auth.errors.generic))
    }
  }

  async function run(action: (signIn: SignIn) => Promise<void>) {
    if (!isLoaded) {
      return
    }
    clearFeedback()
    setLoading(true)
    try {
      await action(signIn)
    } catch (err) {
      fail(err)
    } finally {
      setLoading(false)
    }
  }

  /** Both first factors end here: a session, a second factor, or a dead end. */
  async function proceed(
    signIn: SignIn,
    result: Awaited<ReturnType<SignIn['create']>>,
  ) {
    if (result.status === 'complete') {
      await setActive?.({ session: result.createdSessionId })
      onSuccess()
      return
    }
    if (result.status !== 'needs_second_factor') {
      setErrorKey('needsExtraStep')
      return
    }
    const factor = pickSecondFactor(result.supportedSecondFactors ?? [])
    if (!factor) {
      setErrorKey('noSecondFactor')
      return
    }
    if (factor.strategy === 'phone_code') {
      await signIn.prepareSecondFactor({
        strategy: 'phone_code',
        phoneNumberId: factor.phoneNumberId,
      })
    } else if (factor.strategy === 'email_code') {
      await signIn.prepareSecondFactor({
        strategy: 'email_code',
        emailAddressId: factor.emailAddressId,
      })
    }
    setCode('')
    setSecondFactor({
      strategy: factor.strategy,
      safeIdentifier:
        'safeIdentifier' in factor ? factor.safeIdentifier : undefined,
    })
    setStep('secondFactor')
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    return run(async (signIn) => {
      await proceed(
        signIn,
        await signIn.create({ identifier: email, password }),
      )
    })
  }

  function sendEmailCode() {
    if (!email.trim()) {
      clearFeedback()
      setErrorKey('emailRequired')
      return
    }
    return run(async (signIn) => {
      const attempt = await signIn.create({ identifier: email.trim() })
      const factor = emailCodeFactor(attempt.supportedFirstFactors)
      if (!factor) {
        setClerkError(auth.signIn.emailCode.unavailable)
        return
      }
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: factor.emailAddressId,
      })
      setCode('')
      setStep('emailCode')
      cooldown.start()
    })
  }

  function resendEmailCode() {
    return run(async (signIn) => {
      const factor = emailCodeFactor(signIn.supportedFirstFactors)
      if (!factor) {
        setClerkError(auth.signIn.emailCode.unavailable)
        return
      }
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: factor.emailAddressId,
      })
      cooldown.start()
      setNotice(true)
    })
  }

  function submitEmailCode(e: React.FormEvent) {
    e.preventDefault()
    return run(async (signIn) => {
      await proceed(
        signIn,
        await signIn.attemptFirstFactor({ strategy: 'email_code', code }),
      )
    })
  }

  function submitSecondFactor(e: React.FormEvent) {
    e.preventDefault()
    if (!secondFactor) {
      return
    }
    return run(async (signIn) => {
      const result = await signIn.attemptSecondFactor({
        strategy: secondFactor.strategy,
        code,
      })
      if (result.status === 'complete') {
        await setActive?.({ session: result.createdSessionId })
        onSuccess()
      } else {
        setErrorKey('invalidVerification')
      }
    })
  }

  function backToCredentials() {
    clearFeedback()
    setSecondFactor(null)
    setCode('')
    setStep('credentials')
  }

  if (step === 'secondFactor' && secondFactor) {
    const text = auth.signIn.secondFactor
    const prompt =
      secondFactor.strategy === 'totp'
        ? text.totp
        : secondFactor.strategy === 'backup_code'
          ? text.backupCode
          : fmt(text.sent, {
              contact: secondFactor.safeIdentifier ?? text.sentFallback,
            })
    return (
      <form
        onSubmit={submitSecondFactor}
        noValidate
        className="flex flex-col gap-3"
      >
        <AuthError message={error} />
        <p className="text-sm text-[var(--auth-muted)]">{prompt}</p>
        <AuthField
          label={
            secondFactor.strategy === 'backup_code'
              ? text.backupCodeLabel
              : auth.verificationCode
          }
          type="text"
          autoComplete="one-time-code"
          value={code}
          onChange={setCode}
          required
        />
        <AuthButton loading={loading}>{text.verify}</AuthButton>
        <button
          type="button"
          onClick={backToCredentials}
          className="text-xs text-[var(--auth-muted)] hover:underline"
        >
          {text.back}
        </button>
      </form>
    )
  }

  if (step === 'emailCode') {
    const text = auth.signIn.emailCode
    return (
      <form
        onSubmit={submitEmailCode}
        noValidate
        className="flex flex-col gap-3"
      >
        <AuthError message={error} />
        <p className="text-sm text-[var(--auth-muted)]">
          {fmt(text.sent, { email })}
        </p>
        <AuthField
          label={auth.code}
          type="text"
          autoComplete="one-time-code"
          value={code}
          onChange={setCode}
          required
        />
        <AuthButton loading={loading}>{auth.signIn.submit}</AuthButton>
        {notice ? (
          <output className="text-xs text-[var(--auth-muted)]">
            {text.resent}
          </output>
        ) : null}
        <div className="mt-1 flex justify-between gap-3 text-xs text-[var(--auth-muted)]">
          <button
            type="button"
            className="hover:underline disabled:no-underline disabled:opacity-60"
            disabled={loading || cooldown.remaining > 0}
            onClick={resendEmailCode}
          >
            {cooldown.remaining > 0
              ? fmt(text.resendIn, { seconds: cooldown.remaining })
              : text.resend}
          </button>
          <button
            type="button"
            className="text-right hover:underline"
            onClick={backToCredentials}
          >
            {text.back}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={submitPassword} noValidate className="flex flex-col gap-3">
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
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        required
      />
      <AuthButton loading={loading}>{auth.signIn.submit}</AuthButton>
      <AuthButton
        type="button"
        variant="ghost"
        className="border-solid border-[var(--auth-border)]"
        loading={loading}
        onClick={sendEmailCode}
      >
        {auth.signIn.emailCode.send}
      </AuthButton>
      <TestLoginButton onSuccess={onSuccess} />
      <div className="mt-1 flex justify-between text-xs text-[var(--auth-muted)]">
        {config.features.forgotPassword ? (
          <a href={config.paths.forgotPassword} className="hover:underline">
            {auth.signIn.forgotPassword}
          </a>
        ) : (
          <span />
        )}
        <a href={config.paths.signUp} className="hover:underline">
          {auth.signIn.createAccount}
        </a>
      </div>
    </form>
  )
}
