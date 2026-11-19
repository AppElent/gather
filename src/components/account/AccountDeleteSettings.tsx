import { useUser } from '@clerk/react'
import { accountDeletion } from '@gather/core/account-deletion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import {
  AccountChanged,
  type AccountDeleteState,
  SignInNotConfirmed,
  useAccountDelete,
} from './AccountDeleteProvider'

/**
 * The Account page's Danger zone: the web's Delete account.
 *
 * The phone's Delete account screen in a section (`account-delete-screen.tsx`),
 * with its words: it names the Groups that go and the Groups that stay
 * *before* the confirmation, because "everything in them" means nothing until
 * you can see which households it is talking about. The confirmation names the
 * account and asks for a word to be typed, since nothing undoes it.
 *
 * The run is not this section's. Once the purge starts the whole signed-in
 * tree is replaced (`AccountDeleteProvider`), so this only starts it and shows
 * the refusals after which nothing has been deleted.
 */
export function AccountDeleteSettings() {
  const messages = useMessages()
  const words = messages.settings.deleteAccount
  const { user } = useUser()
  const { state, start } = useAccountDelete()
  const { confirm, dialog } = useConfirmAction()
  const preview = useQuery(api.accounts.deletionPreview, {})

  // Clerk refuses self-deletion unless the instance allows it, and a button
  // that purges the household and then fails is the worst outcome available.
  const deletion = accountDeletion(user)
  const busy = state.step === 'confirmingSignIn' || state.step === 'purging'
  const error =
    state.step === 'refused'
      ? refusal(state, words)
      : deletion === 'withheld'
        ? words.unavailable
        : null

  function ask() {
    confirm({
      title: fmt(words.confirmTitle, {
        // Clerk first: the Convex mirror of the address is refreshed from the
        // JWT on mount, so it can be a token older than a change made here.
        email: user?.primaryEmailAddress?.emailAddress ?? preview?.email ?? '',
      }),
      body: words.confirmBody,
      confirmLabel: messages.common.actions.delete,
      confirmPhrase: {
        phrase: words.confirmPhrase,
        label: words.confirmPhraseLabel,
      },
      run: start,
    })
  }

  return (
    <section
      aria-labelledby="account-delete-title"
      className="rm-panel border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] p-4"
    >
      <h2 id="account-delete-title" className="rm-label">
        {words.dangerZone}
      </h2>
      <p className="m-0 mb-3 text-sm font-semibold">{words.lead}</p>

      {preview === undefined ? (
        <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
          {messages.common.errors.loading}
        </p>
      ) : preview === null ? null : preview.deleted.length === 0 &&
        preview.kept.length === 0 ? (
        <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
          {words.noGroups}
        </p>
      ) : (
        <div className="mb-3 grid gap-3">
          <Consequence
            heading={words.goesHeading}
            body={words.goesBody}
            groups={preview.deleted}
            tone="danger"
          />
          <Consequence
            heading={words.keptHeading}
            body={words.keptBody}
            groups={preview.kept}
          />
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="m-0 mb-3 rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 py-2 text-sm text-[var(--app-danger)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="account-delete-submit"
        disabled={deletion !== 'allowed' || preview === undefined || busy}
        onClick={ask}
        className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 text-sm font-semibold text-[var(--app-danger)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-live="polite">
          {busy ? messages.common.actions.working : words.submit}
        </span>
      </button>
      {dialog}
    </section>
  )
}

/** What a refusal says. Nothing was deleted in any of them. */
function refusal(
  state: Extract<AccountDeleteState, { step: 'refused' }>,
  words: ReturnType<typeof useMessages>['settings']['deleteAccount'],
) {
  if (state.cause instanceof SignInNotConfirmed) return words.signInCheckFailed
  if (state.cause instanceof AccountChanged) return words.accountChanged
  return errorMessage(state.cause, words.failed)
}

/** One half of the answer: these Groups, and what happens to them. */
function Consequence({
  heading,
  body,
  groups,
  tone,
}: {
  heading: string
  body: string
  groups: string[]
  tone?: 'danger'
}) {
  if (groups.length === 0) return null

  return (
    <div className="grid gap-1">
      <h3
        className={`m-0 text-sm font-semibold ${tone === 'danger' ? 'text-[var(--app-danger)]' : ''}`}
      >
        {heading}
      </h3>
      <p className="m-0 text-sm text-[var(--app-muted)]">{body}</p>
      <ul className="m-0 mt-1 list-none divide-y divide-[var(--app-border)] rounded-[var(--app-radius)] border border-[var(--app-border)] p-0">
        {groups.map((name, index) => (
          <li key={`${index}:${name}`} className="px-3 py-2 text-sm">
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}
