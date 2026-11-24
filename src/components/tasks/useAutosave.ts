import { useEffect, useRef, useState } from 'react'

/**
 * A text field that keeps itself: it shows what is stored until something is
 * typed, and sends the draft a moment after the last key (`delay`), on blur
 * and when the field goes away. A draft that could not be saved stays in the
 * field, marked `failed`.
 */
export function useAutosave({
  stored,
  save,
  delay,
  required = false,
}: {
  stored: string
  save: (value: string) => Promise<unknown>
  /** Milliseconds after the last key; none sends on blur only. */
  delay?: number
  /** An emptied field goes back to what is stored instead of being sent. */
  required?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sending = useRef<string | null>(null)
  const latest = useRef({ draft, stored, save, required })
  latest.current = { ...latest.current, stored, save, required }

  const set = (next: string | null) => {
    latest.current.draft = next
    setDraft(next)
  }

  const flush = () => {
    clearTimeout(timer.current)
    const { draft: text, stored: now, save: send, required: needed } =
      latest.current
    if (text === null) return
    if (needed ? !text.trim() || text.trim() === now : text === now) {
      set(null)
      return
    }
    const value = needed ? text.trim() : text
    if (sending.current === value) return
    sending.current = value
    setFailed(false)
    send(value).then(
      () => {
        sending.current = null
        // Unless something else was typed meanwhile.
        if (latest.current.draft === text) set(null)
      },
      () => {
        sending.current = null
        setFailed(true)
      },
    )
  }

  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => flushRef.current(), [])

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
