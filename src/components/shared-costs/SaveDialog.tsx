import { type FormEvent, useId, useRef, useState } from 'react'
import { useErrorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { inputClass } from '../recipes/fields'

/** "Save this": a name, and what saving means. */
export function SaveDialog({
  suggestedName,
  onSave,
  onClose,
}: {
  suggestedName: string
  onSave: (name: string) => Promise<unknown>
  onClose: () => void
}) {
  const { finances, common } = useMessages()
  const words = finances.split
  const errorText = useErrorMessage()
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(suggestedName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (!busy) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError(finances.errors.name)
      nameRef.current?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(trimmed)
      onClose()
    } catch (e) {
      setError(errorText(e, words.web.saveError))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={words.saveThis}
      onClose={close}
      initialFocus={nameRef}
      actions={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className={buttonClass.secondary}
          >
            {finances.actions.cancel}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy}
            className={buttonClass.primary}
          >
            {busy ? common.actions.working : finances.actions.save}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-3.5">
        <label className="grid gap-1 text-footnote text-[var(--muted)]">
          {words.saveName}
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            placeholder={words.whatPlaceholder}
            autoComplete="off"
            aria-invalid={error !== null}
            aria-describedby={error ? `${formId}-error` : undefined}
            className={`${inputClass} min-h-11 text-[var(--ink)]`}
          />
        </label>
        {error ? (
          <p
            id={`${formId}-error`}
            role="alert"
            className="m-0 text-footnote font-semibold text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        <p className="m-0 text-footnote text-[var(--muted)]">
          {words.immutable}
        </p>
      </form>
    </Dialog>
  )
}
