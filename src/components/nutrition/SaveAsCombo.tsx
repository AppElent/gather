import { useState } from 'react'
import { useMessages } from '../../lib/i18n'

interface Props {
  /** Writes the Combo; rejecting shows its reason where the name was typed. */
  onSave: (name: string) => Promise<void>
}

/**
 * Turning a meal you have already filled in into a Combo.
 *
 * This is the only way one is made: there is no builder to open and no second
 * library to keep, because curating is a by-product of logging (ADR-0012). It
 * asks for one thing — a name you will recognise tomorrow — and appears only
 * on a slot that has something in it.
 */
export function SaveAsCombo({ onSave }: Props) {
  const messages = useMessages()
  const { combos } = messages.nutrition.diary
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className="inline-flex min-h-11 items-center text-sm underline"
      >
        {combos.save}
      </button>
    )
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        setError(null)
        try {
          await onSave(name.trim())
          setNaming(false)
          setName('')
        } catch (err) {
          setError(err instanceof Error ? err.message : combos.saveFailed)
        } finally {
          setSaving(false)
        }
      }}
    >
      <input
        // The field appeared because somebody asked for it, so it takes the
        // focus; anything else costs a second tap on a phone.
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={combos.saveTitle}
        placeholder={combos.namePlaceholder}
        className="min-h-11 min-w-0 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px]"
      />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {combos.save}
      </button>
      <button
        type="button"
        onClick={() => {
          setNaming(false)
          setError(null)
        }}
        className="min-h-11 text-sm underline"
      >
        {messages.common.actions.cancel}
      </button>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </form>
  )
}
