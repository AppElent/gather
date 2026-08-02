import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { errorMessage } from '../../lib/errorMessage'
import { SurfaceCard } from './ShellPrimitives'

/**
 * Asking before something irreversible, in the app rather than in the browser.
 *
 * Every destructive control here used to be guarded by `window.confirm`, which
 * has two failure modes and no way to tell them apart. An embedded or sandboxed
 * frame — the PR preview, an in-app browser — may suppress the native modal
 * entirely, in which case `confirm` returns `false` and the click does nothing
 * at all, silently. And the work behind it was fired as a bare `void
 * mutation(...)`, so a refusal from Convex was discarded just as silently. A
 * delete that does nothing and a delete that was refused looked identical, and
 * both looked like a broken button.
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
  /** The work itself. Awaited; if it rejects, the dialog says why. */
  run: () => Promise<unknown> | unknown
}

interface ConfirmDialogProps {
  request: ConfirmRequest
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  request,
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    confirmRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  // Tab stays inside the question until it is answered, the same way the
  // navigation drawer holds focus.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    )
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-[min(26rem,100%)]"
      >
        <SurfaceCard>
          <div className="grid gap-3">
            <h2 className="m-0 text-base font-semibold">{request.title}</h2>
            {request.body ? (
              <div className="text-sm text-[var(--app-muted)]">
                {request.body}
              </div>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="m-0 rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 py-2 text-sm text-[var(--app-danger)]"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 text-sm font-semibold text-[var(--app-danger)] disabled:opacity-60"
              >
                {busy ? 'Working…' : (request.confirmLabel ?? 'Confirm')}
              </button>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
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

  async function accept() {
    if (!request || busy) return
    setBusy(true)
    setError(null)
    try {
      await request.run()
      setRequest(null)
    } catch (e) {
      setError(
        errorMessage(
          e,
          request.errorFallback ?? 'That did not work — try again.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const dialog = request ? (
    <ConfirmDialog
      request={request}
      busy={busy}
      error={error}
      onConfirm={() => void accept()}
      onCancel={cancel}
    />
  ) : null

  return { confirm, dialog }
}
