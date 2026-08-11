import { useState } from 'react'
import { fmt, useMessages } from '../../lib/i18n'

interface Props {
  name: string
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
}

/**
 * Renaming and deleting one saved Combo (#129).
 *
 * Both are the person's own doing on their own row, so the controls live on
 * the card rather than behind a menu. Only one of the three states is on show
 * at a time — the buttons, the rename field, or the delete confirmation —
 * because they occupy the same corner and a card showing two of them at once
 * would be asking two questions.
 *
 * Neither action touches the diary. A Combo is a shortcut for what will
 * happen; the entries it has already written are records of what did, and
 * they keep the name they were logged under (ADR-0003, #99). That is worth
 * saying out loud at the point of deleting, so it is.
 *
 * A refusal from the server is never shown verbatim. These mutations answer
 * in English sentences, and the person reading may not be — so the form
 * validates the one case it can (an empty name) and anything else resolves to
 * a message from the tree (ADR-0011).
 */
export function ComboActions({ name, onRename, onDelete }: Props) {
  const messages = useMessages()
  const library = messages.nutrition.combosLibrary
  const [mode, setMode] = useState<'idle' | 'renaming' | 'confirming'>('idle')
  const [draft, setDraft] = useState(name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function idle() {
    setMode('idle')
    setError(null)
  }

  if (mode === 'renaming') {
    return (
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const next = draft.trim()
          // The server refuses an empty name too; catching it here is what
          // keeps that refusal off a screen it would arrive on in English.
          if (!next || busy) return
          setBusy(true)
          setError(null)
          try {
            await onRename(next)
            idle()
          } catch {
            setError(library.renameFailed)
          } finally {
            setBusy(false)
          }
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={fmt(library.renameLabel, { name })}
          className="min-h-11 min-w-0 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px]"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {messages.common.actions.save}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(name)
            idle()
          }}
          className="min-h-11 text-sm underline"
        >
          {messages.common.actions.cancel}
        </button>
        {error && <p className="w-full text-xs text-red-700">{error}</p>}
      </form>
    )
  }

  if (mode === 'confirming') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="w-full text-sm">
          {fmt(library.deleteConfirm, { name })}{' '}
          <span className="opacity-70">{library.deleteKeepsDiary}</span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await onDelete()
              // No idle() on success: the row this lives on is gone.
            } catch {
              setError(library.deleteFailed)
              setBusy(false)
            }
          }}
          className="min-h-11 rounded-[var(--app-radius)] border border-red-700 bg-red-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {messages.common.actions.delete}
        </button>
        <button
          type="button"
          onClick={idle}
          className="min-h-11 text-sm underline"
        >
          {messages.common.actions.cancel}
        </button>
        {error && <p className="w-full text-xs text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          setDraft(name)
          setMode('renaming')
        }}
        aria-label={fmt(library.renameLabel, { name })}
        className="inline-flex min-h-11 items-center text-sm underline"
      >
        {library.rename}
      </button>
      <button
        type="button"
        onClick={() => setMode('confirming')}
        aria-label={fmt(library.deleteLabel, { name })}
        className="inline-flex min-h-11 items-center text-sm text-red-700 underline"
      >
        {library.delete}
      </button>
    </div>
  )
}
