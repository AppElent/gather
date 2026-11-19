import { useMessages } from '../../lib/i18n'
import type { AccountDeleteValue } from './AccountDeleteProvider'

/**
 * The account while it is being deleted, drawn in place of the signed-in app
 * (`AccountDeleteProvider`); the phone's `account-delete-underway-screen.tsx`.
 *
 * Most of the time it is on screen for one Clerk round trip and then the page
 * leaves. It exists for the other case: Clerk refusing once the household is
 * already being purged. That is the one failure here the person has to read,
 * so it is said where nothing can unmount it, with the two ways on: ask Clerk
 * again, or sign out.
 */
export function AccountDeleteUnderway({
  state,
  retryLogin,
  signOut,
}: Pick<AccountDeleteValue, 'state' | 'retryLogin' | 'signOut'>) {
  const messages = useMessages()
  const words = messages.settings.deleteAccount
  const stranded = state.step === 'stranded'

  return (
    <main
      data-testid="account-delete-underway"
      className="app-shell grid min-h-svh place-items-center px-6 text-sm"
    >
      {stranded ? (
        <div className="grid w-full max-w-sm gap-3">
          <p
            role="alert"
            className="m-0 rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 py-2 text-sm text-[var(--app-danger)]"
          >
            {words.partlyFailed}
          </p>
          <button
            type="button"
            data-testid="account-delete-retry"
            onClick={retryLogin}
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)]"
          >
            {messages.common.actions.retry}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
          >
            {messages.common.actions.signOut}
          </button>
        </div>
      ) : (
        <p
          aria-live="polite"
          className="m-0 text-center text-[var(--app-muted)]"
        >
          {words.underway}
        </p>
      )}
    </main>
  )
}
