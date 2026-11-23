import { useUser } from '@clerk/react'
import { accountDeletion } from '@gather/core/account-deletion'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { preloadAppleJs } from '../../lib/auth/appleRevocation'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useI18n, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import {
  AccountChanged,
  type AccountDeleteState,
  AppleNotRevoked,
  type DeleteChoice,
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
 * Then the choice (APP-397), Gather's data first: Gather shares its login
 * with the other AppElent apps, and only the second choice takes it, which it
 * says by naming them. Both confirm the same way.
 *
 * An account linked to Sign in with Apple answers one more question before
 * the whole account goes (APP-388): the browser opens Apple's popup only from
 * a click, so the option asks for one, with a Cancel that deletes nothing.
 *
 * The run is not this section's. Once the purge starts the whole signed-in
 * tree is replaced (`AccountDeleteProvider`), so this only starts it and shows
 * the refusals after which nothing has been deleted.
 */
export function AccountDeleteSettings() {
  const messages = useMessages()
  const words = messages.settings.deleteAccount
  const { user } = useUser()
  const { state, start, continueWithApple, cancelApple } = useAccountDelete()
  const { confirm, dialog } = useConfirmAction()
  const preview = useQuery(api.accounts.deletionPreview, {})

  // Clerk refuses self-deletion unless the instance allows it, and a button
  // that purges the household and then fails is the worst outcome available.
  // Only the whole account asks Clerk to delete anything.
  const deletion = accountDeletion(user)
  const { locale } = useI18n()
  // Safari blocks a popup opened after awaiting a script load, so Apple JS is
  // ready before the click that needs it; only here, never on other pages.
  useEffect(() => {
    if (user && deletion === 'allowed') preloadAppleJs(user, locale)
  }, [user, deletion, locale])
  const running =
    state.step === 'confirmingSignIn' ||
    state.step === 'confirmingApple' ||
    state.step === 'revokingApple' ||
    state.step === 'purging'
  const askingApple =
    state.step === 'confirmingApple' || state.step === 'revokingApple'
  const busyWith = running ? state.choice : null
  const refusedFor = state.step === 'refused' ? state.choice : null
  const email =
    // Clerk first: the Convex mirror of the address is refreshed from the JWT
    // on mount, so it can be a token older than a change made here.
    user?.primaryEmailAddress?.emailAddress ?? preview?.email ?? ''

  function ask(choice: DeleteChoice) {
    const option = choice === 'gatherData' ? words.dataOnly : words.wholeAccount
    confirm({
      title: fmt(option.confirmTitle, { email }),
      body: option.confirmBody,
      confirmLabel: messages.common.actions.delete,
      confirmPhrase: {
        phrase: words.confirmPhrase,
        label: words.confirmPhraseLabel,
      },
      run: () => start(choice),
    })
  }

  function option(choice: DeleteChoice) {
    const text = choice === 'gatherData' ? words.dataOnly : words.wholeAccount
    const error =
      state.step === 'refused' && refusedFor === choice
        ? refusal(state, words)
        : choice === 'wholeAccount' && deletion === 'withheld'
          ? words.unavailable
          : null
    const disabled =
      preview === undefined ||
      running ||
      (choice === 'wholeAccount' && deletion !== 'allowed') ||
      (choice === 'gatherData' && deletion === 'unknown')
    const id = `account-delete-${choice}`
    return (
      <div
        className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--hair)] p-3"
        aria-labelledby={`${id}-title`}
        role="group"
      >
        <h3 id={`${id}-title`} className="m-0 text-sm font-semibold">
          {text.title}
        </h3>
        <p className="m-0 text-sm text-[var(--muted)]">{text.body}</p>
        {choice === 'wholeAccount' && askingApple ? (
          <div
            role="group"
            aria-labelledby={`${id}-apple`}
            className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--hair)] px-3 py-2"
          >
            <p id={`${id}-apple`} className="m-0 text-sm">
              {words.apple.prompt}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="account-delete-apple-continue"
                // The popup's own click: it opens Apple's window.
                autoFocus
                disabled={state.step === 'revokingApple'}
                onClick={continueWithApple}
                className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[color-mix(in_oklch,var(--danger)_45%,var(--hair))] px-3 text-sm font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-live="polite">
                  {state.step === 'revokingApple'
                    ? words.apple.waiting
                    : words.apple.continue}
                </span>
              </button>
              {state.step === 'confirmingApple' ? (
                <button
                  type="button"
                  data-testid="account-delete-apple-cancel"
                  onClick={cancelApple}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[var(--hair)] px-3 text-sm font-semibold"
                >
                  {messages.common.actions.cancel}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="m-0 rounded-[var(--radius-control)] border border-[color-mix(in_oklch,var(--danger)_45%,var(--hair))] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            data-testid={`${id}-submit`}
            disabled={disabled}
            onClick={() => ask(choice)}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[color-mix(in_oklch,var(--danger)_45%,var(--hair))] px-3 text-sm font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-live="polite">
              {busyWith === choice ? messages.common.actions.working : text.submit}
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <section
        aria-labelledby="account-delete-title"
        className="rm-panel border-[color-mix(in_oklch,var(--danger)_45%,var(--hair))] p-4"
      >
        <h2 id="account-delete-title" className="rm-label">
          {words.dangerZone}
        </h2>
        <p className="m-0 mb-3 text-sm font-semibold">{words.lead}</p>

        {preview === undefined ? (
          <p className="m-0 mb-3 text-sm text-[var(--muted)]">
            {messages.common.errors.loading}
          </p>
        ) : preview === null ? null : preview.deleted.length === 0 &&
          preview.kept.length === 0 ? (
          <p className="m-0 mb-3 text-sm text-[var(--muted)]">
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

        <p className="m-0 mb-3 text-sm">{words.choiceIntro}</p>
        <div className="grid gap-3">
          {option('gatherData')}
          {option('wholeAccount')}
        </div>
      </section>
      {/* Outside the panel: its backdrop-filter would make it the containing
          block of the dialog's fixed overlay, trapping it inside the card. */}
      {dialog}
    </>
  )
}

/** What a refusal says. Nothing was deleted in any of them. */
function refusal(
  state: Extract<AccountDeleteState, { step: 'refused' }>,
  words: ReturnType<typeof useMessages>['settings']['deleteAccount'],
) {
  if (state.cause instanceof SignInNotConfirmed) return words.signInCheckFailed
  if (state.cause instanceof AccountChanged) return words.accountChanged
  if (state.cause instanceof AppleNotRevoked)
    return words.apple[state.cause.reason]
  return errorMessage(
    state.cause,
    state.choice === 'gatherData' ? words.dataOnly.failed : words.failed,
  )
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
        className={`m-0 text-sm font-semibold ${tone === 'danger' ? 'text-[var(--danger)]' : ''}`}
      >
        {heading}
      </h3>
      <p className="m-0 text-sm text-[var(--muted)]">{body}</p>
      <ul className="m-0 mt-1 list-none divide-y divide-[var(--hair)] rounded-[var(--radius-control)] border border-[var(--hair)] p-0">
        {groups.map((name, index) => (
          <li key={`${index}:${name}`} className="px-3 py-2 text-sm">
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}
