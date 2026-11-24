import { useEffect, useRef, useState } from 'react'

/** Drafts whose save failed after their field had gone, by field. */
const kept = new Map<string, string>()

/**
 * A text field that keeps itself: it shows what is stored until something is
 * typed, and sends the draft a moment after the last key (`delay`), on blur
 * and when the field goes away. A draft that could not be saved stays in the
 * field, marked `failed`; when the field has gone by then, `onLost` says so
 * and the draft is there again the next time the field is opened.
 */
export function useAutosave({
  id,
  stored,
  save,
  onLost,
  delay,
  required = false,
}: {
  /** Names the field among all fields: which task's, and which one. */
  id: string
  stored: string
  save: (value: string) => Promise<unknown>
  onLost: (error: unknown) => void
  /** Milliseconds after the last key; none sends on blur only. */
  delay?: number
  /** An emptied field goes back to what is stored instead of being sent. */
  required?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(() => kept.get(id) ?? null)
  const [failed, setFailed] = useState(() => kept.has(id))
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sending = useRef<string | null>(null)
  const mounted = useRef(false)
  const latest = useRef({ draft, stored, save, onLost, required })
  latest.current = { ...latest.current, stored, save, onLost, required }

  const set = (next: string | null) => {
    latest.current.draft = next
    setDraft(next)
  }

  const flush = () => {
    clearTimeout(timer.current)
    const { draft: text, stored: now, save: send, required: needed } =
      latest.current
    if (text === null) return
    // Back to what is stored, unless something else is on its way there.
    const same = (needed ? text.trim() : text) === now && sending.current === null
    if (same || (needed && !text.trim())) {
      set(null)
      return
    }
    const value = needed ? text.trim() : text
    if (sending.current === value) return
    sending.current = value
    setFailed(false)
    send(value).then(
      () => {
        if (sending.current === value) sending.current = null
        // Unless something else was typed meanwhile.
        if (latest.current.draft === text) set(null)
      },
      (error) => {
        if (sending.current === value) sending.current = null
        if (mounted.current) {
          setFailed(true)
        } else if (latest.current.draft === text) {
          kept.set(id, text)
          latest.current.onLost(error)
        }
      },
    )
  }

  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    mounted.current = true
    kept.delete(id)
    return () => {
      mounted.current = false
      flushRef.current()
    }
  }, [id])

  return {
    value: draft ?? stored,
    failed,
    change: (next: string) => {
      set(next)
      clearTimeout(timer.current)
      if (delay !== undefined) timer.current = setTimeout(() => flushRef.current(), delay)
    },
    /** Leaving the field: an emptied required one shows what is stored. */
    blur: () => flushRef.current(),
  }
}
