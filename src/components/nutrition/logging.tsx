import { type ReactNode, useState } from 'react'
import { errorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'

/**
 * One card's write to the diary: whether it is under way, and why the last
 * one failed. A failure stays on the card it happened on.
 */
export function useLogging() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallback = useMessages().nutrition.diary.add.logFailed
  return {
    busy,
    error,
    run: async (write: () => Promise<void>) => {
      setBusy(true)
      setError(null)
      try {
        await write()
      } catch (err) {
        setError(errorMessage(err, fallback))
      } finally {
        setBusy(false)
      }
    },
  }
}

/**
 * The confirm at the bottom of every expanded card.
 *
 * Disabled until what it would write makes sense, and saying why rather than
 * being mysteriously grey. `children` sit beside the button, for a card with
 * a second action of its own.
 */
export function Confirm({
  disabled,
  reason,
  busy,
  error,
  onConfirm,
  children,
}: {
  disabled: boolean
  reason: string
  busy: boolean
  error: string | null
  onConfirm: () => void
  children?: ReactNode
}) {
  const { add } = useMessages().nutrition.diary
  return (
    <div className="mt-3 grid gap-2">
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onConfirm}
          className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {add.confirm}
        </button>
        {children}
        {disabled && <span className="text-xs opacity-60">{reason}</span>}
      </div>
    </div>
  )
}
