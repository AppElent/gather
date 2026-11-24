import { useEffect, useRef, useState } from 'react'
import { reportLostSave } from './lostSaves'

/**
 * Drafts whose save failed after their field had gone, by field, with what was
 * stored then: a draft never comes back over something newer.
 */
const kept = new Map<string, { draft: string; stored: string }>()

/**
 * A text field that keeps itself: it shows what is stored until something is
 * typed, and sends the draft a moment after the last key (`delay`), on blur
 * and when the field goes away. A draft that could not be saved stays in the
 * field, marked `failed`; when the field has gone by then, the page says so
 * and the draft is there again the next time the field is opened, unless what
 * is stored has changed. It is sent again only from the field, never by
 * leaving it unread.
 */
export function useAutosave({
  id,
  stored,
  save,
  delay,
  required = false,
}: {
  /** Names the field among all fields: which task's, and which one. */
  id: string
  stored: string
  save: (value: string) => Promise<unknown>
  /** Milliseconds after the last key; none sends on blur only. */
  delay?: number
  /** An emptied field goes back to what is stored instead of being sent. */
  required?: boolean
}) {
  const [restored] = useState(() => {
    const before = kept.get(id)
    return before?.stored === stored ? before : undefined
  })
  const [draft, setDraft] = useState<string | null>(restored?.draft ?? null)
  const [failed, setFailed] = useState(restored !== undefined)
  /** Nothing has been typed over a restored draft yet. */
  const [untouched, setUntouched] = useState(restored !== undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sending = useRef<string | null>(null)
  const mounted = useRef(false)
  const outdated = untouched && restored?.stored !== stored
  const latest = useRef({ draft, stored, save, required, untouched, outdated })
  latest.current = {
    ...latest.current,
    stored,
    save,
    required,
    untouched,
    outdated,
  }

  const set = (next: string | null) => {
    latest.current.draft = next
    setDraft(next)
  }

  const flush = () => {
    clearTimeout(timer.current)
    const {
      draft: text,
      stored: now,
      save: send,
      required: needed,
    } = latest.current
    if (text === null) return
    // Back to what is stored, unless something else is on its way there.
    const same =
      (needed ? text.trim() : text) === now && sending.current === null
    if (latest.current.outdated || same || (needed && !text.trim())) {
      kept.delete(id)
      setUntouched(false)
      setFailed(false)
      set(null)
      return
    }
    const value = needed ? text.trim() : text
    if (sending.current === value) return
    sending.current = value
    setFailed(false)
    send(value).then(
      () => {
        kept.delete(id)
        if (sending.current === value) sending.current = null
        // Unless something else was typed meanwhile.
        if (latest.current.draft === text) {
          setUntouched(false)
          set(null)
        }
      },
      (error) => {
        if (sending.current === value) sending.current = null
        if (mounted.current) {
          setFailed(true)
        } else if (latest.current.draft === text) {
          kept.set(id, { draft: text, stored: latest.current.stored })
          reportLostSave(error)
        }
      },
    )
  }

  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (!latest.current.untouched) flushRef.current()
    }
  }, [])

  return {
    value: outdated ? stored : (draft ?? stored),
    failed: failed && !outdated,
    change: (next: string) => {
      latest.current.untouched = false
      latest.current.outdated = false
      setUntouched(false)
      set(next)
      clearTimeout(timer.current)
      if (delay !== undefined)
        timer.current = setTimeout(() => flushRef.current(), delay)
    },
    /** Leaving the field: an emptied required one shows what is stored. */
    blur: () => flushRef.current(),
  }
}
