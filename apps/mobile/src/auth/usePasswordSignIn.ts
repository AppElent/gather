/**
 * Email + password, all the way to an active session.
 *
 * Shared by the sign-in form and the dev-login shortcut, which are the same two
 * calls with different sources for the strings — worth a hook precisely because
 * the second half is easy to forget: in Core 3 a successful `password()` leaves
 * the sign-in `'complete'` but **not** signed in. `finalize()` is what promotes
 * it to the active session, and skipping it produces a flow that reports success
 * and leaves the person exactly where they were.
 *
 * Nothing here navigates. When `finalize()` lands, `isSignedIn` flips, the
 * `(auth)` layout redirects, and this component is unmounted out from under us
 * — which is also why `busy` is only ever cleared on the failure paths.
 *
 * The error comes from `pickError`, not from the returned `{ error }` alone;
 * see `clerkErrors.ts` for why that distinction is the difference between "That
 * password is not right" and "Something went wrong."
 *
 * Only `password` and `email_code` are enabled on the instance (see
 * `docs/research/mobile-clerk-expo.md`), so there is no second factor and no
 * Device Trust check to route to. Both are nonetheless *possible* statuses, and
 * #139's research is explicit that the right handling for a status we do not
 * implement is a branch that says so rather than silence — a sign-in that
 * quietly does nothing is the worst of the three outcomes. Hence the check
 * before `finalize()`: the person gets an honest error, and the log names the
 * status that needs a screen building.
 */
import { useCallback, useState } from 'react'
import { useSignIn } from '@clerk/expo'

import { pickError, type CodedError } from './clerkErrors'
import { useI18n } from '../i18n'

export function usePasswordSignIn() {
  const { signIn, errors } = useSignIn()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [returned, setReturned] = useState<CodedError | null>(null)
  const [override, setOverride] = useState<string | null>(null)

  const submit = useCallback(
    async (email: string, password: string) => {
      setBusy(true)
      setReturned(null)
      setOverride(null)

      const attempt = await signIn.password({
        identifier: email.trim(),
        password,
      })
      if (attempt.error) {
        setReturned(attempt.error)
        setBusy(false)
        return
      }

      if (signIn.status !== 'complete') {
        if (__DEV__) {
          console.warn(
            `[auth] sign-in stopped at an unhandled status: ${signIn.status}`,
          )
        }
        setOverride(t.errors.generic)
        setBusy(false)
        return
      }

      const finalized = await signIn.finalize()
      if (finalized.error) {
        setReturned(finalized.error)
        setBusy(false)
      }
    },
    [signIn, t],
  )

  return {
    submit,
    busy,
    error: override ?? pickError(errors, returned, t),
  }
}
