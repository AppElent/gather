/**
 * A text field that saves itself, without saving on every keystroke.
 *
 * "No Save button" is a decision about the interface, not about the write
 * cadence, and the two got conflated in the first draft: `onChangeText` went
 * straight to the store, which on Convex is one mutation â€” one transaction,
 * one re-run of every subscribed query, one patch pushed to every phone
 * looking at that list â€” per character. Roughly ten a second while somebody
 * types a sentence.
 *
 * So the draft lives here and the write is debounced, flushed on blur, and
 * flushed again when the screen goes away. What a person sees is unchanged:
 * they type, they leave, it is saved.
 *
 * The taskActions has no backend to spare, but it models the real cadence
 * deliberately â€” a taskActions that writes differently from the thing it is
 * standing in for is answering a question nobody asked.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Long enough to swallow a word, short enough that leaving feels instant. */
const IDLE = 600

export function useDebouncedText(
  value: string,
  commit: (next: string) => void,
  delay: number = IDLE,
) {
  const [draft, setDraft] = useState(value)
  /** The keystroke not yet written, or `null` when everything is saved. */
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(commit)
  latest.current = commit

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    pending.current = null
    if (next !== null) latest.current(next)
  }, [])

  // Adopt a change that came from somewhere else â€” another screen, another
  // phone â€” but never on top of a keystroke that has not been written yet, or
  // the field would fight the person typing in it.
  useEffect(() => {
    if (pending.current === null) setDraft(value)
  }, [value])

  // Leaving mid-sentence keeps the sentence.
  useEffect(() => flush, [flush])

  const change = useCallback(
    (next: string) => {
      setDraft(next)
      pending.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [delay, flush],
  )

  return { draft, change, flush }
}
