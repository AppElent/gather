/**
 * Passwordless sign-in: email a six-digit code, then trade it for a session.
 *
 * `send` runs on the sign-in screen, where the address was just typed; `verify`,
 * `resend` and the second-factor calls run on `sign-in-code`. Clerk's `signIn`
 * resource survives the navigation in between, the same way `signUp` does for
 * `verify-email`, so the only thing the second screen needs from the first is
 * the address to say back.
 *
 * Core 3 (ADR-0014): calls resolve to `{ error }`, and a verified code still
 * needs `finalize()` before `isSignedIn` flips — at which point the `(auth)`
 * layout redirects and the screen unmounts, so `busy` is only cleared on the
 * failure paths. Nothing here navigates, for the same reason as
 * `usePasswordSignIn`.
 *
 * A correct code does not always end the sign-in: an account with a second
 * factor comes back `'needs_second_factor'`. That is handled here (the web form
 * does the same) rather than left as the "stopped at an unhandled status"
 * dead end the password flow has, because a code that is accepted and then goes
 * nowhere reads as a broken app. Device Trust (`'needs_client_trust'`) and
 * anything else is `needsExtraStep` — an honest message, not silence.
 *
 * Errors follow `pickError` (see `clerkErrors.ts`): the machine-stable code is
 * on the hook's `errors` signal, the returned wrapper is only the fallback.
 */
import { useSignIn } from '@clerk/expo'
import { useCallback, useState } from 'react'
import { type CodedError, pickError } from '../../../auth/clerkErrors'
import { type Messages, useI18n } from '../../../i18n'

type ErrorKey = keyof Messages['errors']

/** What can be proved as a second factor here, in the order we prefer. */
const SECOND_FACTORS = [
  'totp',
  'phone_code',
  'email_code',
  'backup_code',
] as const
export type SecondFactorStrategy = (typeof SECOND_FACTORS)[number]

export interface SecondFactorStep {
  strategy: SecondFactorStrategy
  /** Where Clerk sent the code, for the two strategies that send one. */
  contact: string | null
}

/** The preferred supported second factor, or `undefined` when none is usable. */
export function pickSecondFactor<T extends { strategy: string }>(
  factors: readonly T[],
): T | undefined {
  for (const strategy of SECOND_FACTORS) {
    const factor = factors.find((f) => f.strategy === strategy)
    if (factor) return factor
  }
  return undefined
}

export function useEmailCodeSignIn() {
  const { signIn, errors } = useSignIn()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)
  const [override, setOverride] = useState<ErrorKey | null>(null)
  const [secondFactor, setSecondFactor] = useState<SecondFactorStep | null>(
    null,
  )

  const clear = useCallback(() => {
    setReturned(null)
    setOverride(null)
  }, [])

  /** Asks Clerk to email a code to `email`; `false` means stay where you are. */
  const send = useCallback(
    async (email: string): Promise<boolean> => {
      setBusy(true)
      clear()
      // A sign-in already in progress (the person went back with the chevron
      // after a send) must not be handed an address again.
      await signIn.reset()
      const sent = await signIn.emailCode.sendCode({
        emailAddress: email.trim(),
      })
      setBusy(false)
      if (sent.error) {
        setReturned(sent.error)
        return false
      }
      return true
    },
    [signIn, clear],
  )

  /** Asks Clerk to send the second factor's code, for the strategies that have one. */
  const sendSecondFactor = useCallback(
    (strategy: SecondFactorStrategy) =>
      strategy === 'phone_code'
        ? signIn.mfa.sendPhoneCode()
        : signIn.mfa.sendEmailCode(),
    [signIn],
  )

  /**
   * Sends the code again: to the second factor once the sign-in has reached it
   * (the first factor is already proved, so sending the email code again would
   * be a step backwards), otherwise to the address of the sign-in in progress.
   */
  const resend = useCallback(async (): Promise<boolean> => {
    if (resending) return false
    setResending(true)
    clear()
    const sent = secondFactor
      ? await sendSecondFactor(secondFactor.strategy)
      : await signIn.emailCode.sendCode()
    setResending(false)
    if (sent.error) {
      setReturned(sent.error)
      return false
    }
    return true
  }, [signIn, resending, secondFactor, sendSecondFactor, clear])

  /** Drops the attempt, so a corrected address or a password starts clean. */
  const startOver = useCallback(async () => {
    clear()
    setSecondFactor(null)
    await signIn.reset()
  }, [signIn, clear])

  const finalize = useCallback(async (): Promise<boolean> => {
    const finalized = await signIn.finalize()
    if (finalized.error) {
      setReturned(finalized.error)
      setBusy(false)
      return false
    }
    return true
  }, [signIn])

  /** The sign-in wants more than the code: pick a second factor and start it. */
  const beginSecondFactor = useCallback(async (): Promise<boolean> => {
    const factor = pickSecondFactor(signIn.supportedSecondFactors ?? [])
    if (!factor) {
      setOverride('noSecondFactor')
      return false
    }
    const strategy = factor.strategy as SecondFactorStrategy
    // The step is entered before anything is sent: the first factor is already
    // proved, so a failed send must leave the person on the second-factor form
    // with the error and a Resend that retries it, not back on the email code.
    setSecondFactor({
      strategy,
      contact:
        'safeIdentifier' in factor && typeof factor.safeIdentifier === 'string'
          ? factor.safeIdentifier
          : null,
    })
    if (strategy === 'phone_code' || strategy === 'email_code') {
      const prepared = await sendSecondFactor(strategy)
      if (prepared.error) {
        setReturned(prepared.error)
        return false
      }
    }
    return true
  }, [signIn, sendSecondFactor])

  /** `false` means the attempt failed and the screen should say so. */
  const verify = useCallback(
    async (code: string): Promise<boolean> => {
      setBusy(true)
      clear()
      const verified = await signIn.emailCode.verifyCode({ code })
      if (verified.error) {
        setReturned(verified.error)
        setBusy(false)
        return false
      }

      if (signIn.status === 'complete') return finalize()

      if (signIn.status === 'needs_second_factor') {
        const started = await beginSecondFactor()
        setBusy(false)
        return started
      }

      if (__DEV__) {
        console.warn(
          `[auth] sign-in stopped at an unhandled status: ${signIn.status}`,
        )
      }
      setOverride('needsExtraStep')
      setBusy(false)
      return false
    },
    [signIn, clear, finalize, beginSecondFactor],
  )

  const verifySecondFactor = useCallback(
    async (code: string): Promise<boolean> => {
      if (!secondFactor) return false
      setBusy(true)
      clear()
      const trimmed = code.trim()
      const verified =
        secondFactor.strategy === 'totp'
          ? await signIn.mfa.verifyTOTP({ code: trimmed })
          : secondFactor.strategy === 'phone_code'
            ? await signIn.mfa.verifyPhoneCode({ code: trimmed })
            : secondFactor.strategy === 'email_code'
              ? await signIn.mfa.verifyEmailCode({ code: trimmed })
              : await signIn.mfa.verifyBackupCode({ code: trimmed })
      if (verified.error) {
        setReturned(verified.error)
        setBusy(false)
        return false
      }

      if (signIn.status !== 'complete') {
        setOverride('needsExtraStep')
        setBusy(false)
        return false
      }
      return finalize()
    },
    [signIn, secondFactor, clear, finalize],
  )

  return {
    send,
    resend,
    resending,
    startOver,
    verify,
    verifySecondFactor,
    secondFactor,
    busy,
    error: override ? t.errors[override] : pickError(errors, returned, t),
  }
}
