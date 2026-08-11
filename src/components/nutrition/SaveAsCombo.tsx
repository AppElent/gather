import { useState } from 'react'
import { useMessages } from '../../lib/i18n'

/** The refusal keys `combos.saveFromMeal` throws, and nothing else. */
const REFUSAL_KEYS = [
  'comboNothingSelected',
  'comboComponentUnavailable',
] as const

type Combos = ReturnType<typeof useMessages>['nutrition']['diary']['combos']

/**
 * What to show when the save is refused.
 *
 * The mutation throws a key for the refusals it means a person to read, and
 * this resolves it — the server cannot know which language it is being read
 * in, so anything it phrased itself would reach a Dutch reader in English
 * (ADR-0011). Anything else that fell out of the call is not a sentence meant
 * for anybody, so it gets the general one rather than being put on screen raw.
 */
export function refusalText(error: unknown, combos: Combos): string {
  const key = error instanceof Error ? error.message : ''
  return REFUSAL_KEYS.includes(key as (typeof REFUSAL_KEYS)[number])
    ? combos[key as (typeof REFUSAL_KEYS)[number]]
    : combos.saveFailed
}

interface Props {
  /** How many entries are ticked right now. Nothing ticked is not a Combo. */
  selectedCount: number
  /**
   * Turning the rows' checkboxes on and off. Owned by the meal, because the
   * rows are: this component only says when the choosing starts and stops.
   */
  onSelectingChange: (selecting: boolean) => void
  /** Writes the Combo; rejecting shows its reason where the name was typed. */
  onSave: (name: string) => Promise<void>
}

/**
 * Turning entries you have already logged into a Combo.
 *
 * This is the only way one is made: there is no builder to open and no second
 * library to keep, because curating is a by-product of logging (ADR-0012). It
 * appears only on a slot that has something in it, and asks for two things —
 * which of those entries to keep, and a name you will recognise tomorrow.
 *
 * Saving replaces the ticked entries with the Combo's own expansion (#99), so
 * the hint says so before the name is typed rather than after the meal has
 * changed underneath somebody.
 */
export function SaveAsCombo({
  selectedCount,
  onSelectingChange,
  onSave,
}: Props) {
  const messages = useMessages()
  const { combos } = messages.nutrition.diary
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function stop() {
    setNaming(false)
    setError(null)
    onSelectingChange(false)
  }

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => {
          setNaming(true)
          onSelectingChange(true)
        }}
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
        if (!name.trim() || selectedCount === 0) return
        setSaving(true)
        setError(null)
        try {
          await onSave(name.trim())
          setName('')
          stop()
        } catch (err) {
          setError(refusalText(err, combos))
        } finally {
          setSaving(false)
        }
      }}
    >
      <p className="w-full text-xs opacity-70">{combos.selectHint}</p>
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
        disabled={saving || !name.trim() || selectedCount === 0}
        className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {combos.save}
      </button>
      <button
        type="button"
        onClick={stop}
        className="min-h-11 text-sm underline"
      >
        {messages.common.actions.cancel}
      </button>
      {selectedCount === 0 && (
        <p className="w-full text-xs opacity-70">{combos.selectNothing}</p>
      )}
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </form>
  )
}
