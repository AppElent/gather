import { useSignIn } from '@clerk/react'
import { useState } from 'react'
import { fmt, useMessages } from '../i18n'
import { AuthButton } from './AuthButton'
import { useAuthConfig } from './AuthConfigProvider'
import { AuthError } from './AuthError'
import { AuthField } from './AuthField'
import { orThrow } from './clerkResult'
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

type SignIn = ReturnType<typeof useSignIn>['signIn']

function hasEmailCodeFactor(signIn: SignIn) {
  return signIn.supportedFirstFactors.some((f) => f.strategy === 'email_code')
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

/**
 * Clerk Core 3: each step resolves to `{ error }` (rethrown by `orThrow`), the
 * attempt's state is read back from `signIn`, and `finalize()` is what makes a
 * `complete` sign-in the active session.
 */
export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useSignIn()
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
  async function proceed(signIn: SignIn) {
    if (signIn.status === 'complete') {
      await orThrow(signIn.finalize())
      onSuccess()
      return
    }
    // Device trust (`needs_client_trust`) verifies a new device with the same
    // second-factor methods as MFA.
    if (
      signIn.status !== 'needs_second_factor' &&
      signIn.status !== 'needs_client_trust'
    ) {
      setErrorKey('needsExtraStep')
      return
    }
    const factor = pickSecondFactor(signIn.supportedSecondFactors)
    if (!factor) {
      setErrorKey('noSecondFactor')
      return
    }
    if (factor.strategy === 'phone_code') {
      await orThrow(signIn.mfa.sendPhoneCode())
    } else if (factor.strategy === 'email_code') {
      await orThrow(signIn.mfa.sendEmailCode())
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
      await orThrow(signIn.password({ identifier: email, password }))
      await proceed(signIn)
    })
  }

  function sendEmailCode() {
    if (!email.trim()) {
      clearFeedback()
      setErrorKey('emailRequired')
      return
    }
    return run(async (signIn) => {
      await orThrow(signIn.create({ identifier: email.trim() }))
      if (!hasEmailCodeFactor(signIn)) {
        setClerkError(auth.signIn.emailCode.unavailable)
        return
      }
      await orThrow(signIn.emailCode.sendCode())
      setCode('')
      setStep('emailCode')
      cooldown.start()
    })
  }

  function resendEmailCode() {
    return run(async (signIn) => {
      if (!hasEmailCodeFactor(signIn)) {
        setClerkError(auth.signIn.emailCode.unavailable)
        return
      }
      await orThrow(signIn.emailCode.sendCode())
      cooldown.start()
      setNotice(true)
    })
  }

  function submitEmailCode(e: React.FormEvent) {
    e.preventDefault()
    return run(async (signIn) => {
      await orThrow(signIn.emailCode.verifyCode({ code }))
      await proceed(signIn)
    })
  }

  function submitSecondFactor(e: React.FormEvent) {
    e.preventDefault()
    if (!secondFactor) {
      return
    }
    return run(async (signIn) => {
      const verify = {
        totp: signIn.mfa.verifyTOTP,
        phone_code: signIn.mfa.verifyPhoneCode,
        email_code: signIn.mfa.verifyEmailCode,
        backup_code: signIn.mfa.verifyBackupCode,
      }[secondFactor.strategy]
      await orThrow(verify({ code }))
      if (signIn.status === 'complete') {
        await orThrow(signIn.finalize())
        onSuccess()
      } else {
        setErrorKey('invalidVerification')
      }
    })
  }

  function backToCredentials() {
    // A fresh attempt: the next password or code must not reuse this one.
    void signIn.reset()
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
