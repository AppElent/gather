import { type ReactNode, useId, useRef, useState } from 'react'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { inputClass } from '../recipes/fields'
import { buttonClass } from './buttons'
import { Dialog } from './Dialog'

/**
 * Asking before something irreversible, in the app rather than in the browser.
 *
 * Never `window.confirm`, which has two failure modes and no way to tell them
 * apart. An embedded or sandboxed frame — the PR preview, an in-app browser —
 * may suppress the native modal entirely, in which case `confirm` returns
 * `false` and the click does nothing at all, silently. And work fired as a bare
 * `void mutation(...)` discards a refusal from Convex just as silently, so a
 * delete that does nothing and a delete that was refused look identical, and
 * both look like a broken button.
 *
 * So: the question is a dialog this app draws, and the work is awaited. A
 * rejection keeps the dialog open with the reason on it, because the reader is
 * still looking at the thing they asked to remove and that is where the answer
 * belongs.
 */
export interface ConfirmRequest {
  /** The question, as a sentence. */
  title: string
  /** What confirming will do, where the title cannot say all of it. */
  body?: ReactNode
  /** The verb on the confirming button. Defaults to "Confirm". */
  confirmLabel?: string
  /** Shown if `run` rejects with something that carries no message of its own. */
  errorFallback?: string
  /**
   * A word to type before the confirming button works, for the one action
   * that cannot be undone even by a household (deleting the account). The
   * label carries a `{phrase}` placeholder. Case and surrounding space do not
   * count.
   */
  confirmPhrase?: { phrase: string; label: string }
  /** The work itself. Awaited; if it rejects, the dialog says why. */
  run: () => Promise<unknown> | unknown
  /** A second way to say yes, where the question has two (never a Cancel). */
  alternative?: { label: string; run: () => Promise<unknown> | unknown }
}

interface ConfirmDialogProps {
  request: ConfirmRequest
  busy: boolean
  error: string | null
  onConfirm: () => void
  onAlternative: () => void
  onCancel: () => void
}

function ConfirmDialog({
  request,
  busy,
  error,
  onConfirm,
  onAlternative,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const phraseRef = useRef<HTMLInputElement>(null)
  const phraseId = useId()
  const [typed, setTyped] = useState('')
  const actions = useMessages().common.actions
  const { confirmPhrase } = request
  const phraseMatches =
    !confirmPhrase ||
    typed.trim().toLocaleUpperCase() ===
      confirmPhrase.phrase.toLocaleUpperCase()
  return (
    <Dialog
      title={request.title}
      onClose={onCancel}
      initialFocus={confirmPhrase ? phraseRef : confirmRef}
      closeButton={false}
      actions={
        <>
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass.secondary}
          >
            {actions.cancel}
          </button>
          {request.alternative ? (
            <button
              type="button"
              disabled={busy || !phraseMatches}
              onClick={onAlternative}
              className={buttonClass.secondary}
            >
              {request.alternative.label}
            </button>
          ) : null}
          <button
            ref={confirmRef}
            type="button"
            disabled={busy || !phraseMatches}
            onClick={onConfirm}
            className={buttonClass.secondaryDanger}
          >
            {busy ? actions.working : (request.confirmLabel ?? actions.confirm)}
          </button>
        </>
      }
    >
      {request.body ? (
        <div className="text-subhead text-[var(--muted)]">{request.body}</div>
      ) : null}
      {confirmPhrase ? (
        <label htmlFor={phraseId} className="grid gap-1 text-sm">
          <span>
            {fmt(confirmPhrase.label, { phrase: confirmPhrase.phrase })}
          </span>
          <input
            id={phraseId}
            ref={phraseRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                phraseMatches &&
                !busy
              )
                onConfirm()
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={inputClass}
          />
        </label>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
    </Dialog>
  )
}

/**
 * `confirm(request)` to ask; render `dialog` somewhere in the same tree.
 *
 * One question at a time, which is all any of these pages ask: the request
 * replaces whatever was pending, and clears the previous answer's error with
 * it.
 */
export function useConfirmAction() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const didNotWork = useMessages().common.errors.didNotWork
  const errorText = useErrorMessage()

  function confirm(next: ConfirmRequest) {
    setError(null)
    setBusy(false)
    setRequest(next)
  }

  function cancel() {
    if (busy) return
    setRequest(null)
    setError(null)
  }

  async function accept(run: ConfirmRequest['run'] | undefined) {
    if (!request || !run || busy) return
    setBusy(true)
    setError(null)
    try {
      await run()
      setRequest(null)
    } catch (e) {
      setError(errorText(e, request.errorFallback ?? didNotWork))
    } finally {
      setBusy(false)
    }
  }

  const dialog = request ? (
    <ConfirmDialog
      request={request}
      busy={busy}
      error={error}
      onConfirm={() => void accept(request.run)}
      onAlternative={() => void accept(request.alternative?.run)}
      onCancel={cancel}
    />
  ) : null

  return { confirm, dialog }
}
