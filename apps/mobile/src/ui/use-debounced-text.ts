/**
 * A text field that saves itself, without saving on every keystroke.
 *
 * "No Save button" is a decision about the interface, not about the write
 * cadence, and the two got conflated in the first draft: `onChangeText` went
 * straight to the store, which on Convex is one mutation — one transaction,
 * one re-run of every subscribed query, one patch pushed to every phone
 * looking at that list — per character. Roughly ten a second while somebody
 * types a sentence.
 *
 * So the draft lives here and the write is debounced, flushed on blur, and
 * flushed again when the screen goes away. What a person sees is unchanged:
 * they type, they leave, it is saved.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Long enough to swallow a word, short enough that leaving feels instant. */
const IDLE = 600

export function useDebouncedText(
  value: string,
  /** `false` when it was not taken: the text then stays unsaved. */
  commit: (next: string) => unknown,
  /** Saves on blur and on leaving only, where a save is a slow round trip. */
  { onBlurOnly = false }: { onBlurOnly?: boolean } = {},
) {
  const [draft, setDraft] = useState(value)
  /** The keystroke not yet written, or `null` when everything is saved. */
  const pending = useRef<string | null>(null)
  /** What a refused save left in the field, until a blur sends it again. */
  const refused = useRef<string | null>(null)
  /** The text last sent, so a refusal of an older one is not kept over it. */
  const sent = useRef<string | null>(null)
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
    if (next === null) return
    sent.current = next
    if (latest.current(next) === false) pending.current = next
  }, [])

  // Adopt a change that came from somewhere else — another screen, another
  // phone — but never on top of a keystroke that has not been written yet, or
  // the field would fight the person typing in it.
  useEffect(() => {
    if (pending.current !== null) return
    if (refused.current !== null && refused.current.trim() !== value) return
    refused.current = null
    setDraft(value)
  }, [value])

  // Leaving mid-sentence keeps the sentence.
  useEffect(() => flush, [flush])

  const change = useCallback(
    (next: string) => {
      setDraft(next)
      pending.current = next
      held.current = null
      refused.current = null
      if (timer.current) clearTimeout(timer.current)
      if (!onBlurOnly) timer.current = setTimeout(flush, IDLE)
    },
    [flush, onBlurOnly],
  )

  /** Blur: what was typed, or what was refused before, is saved. */
  const blur = useCallback(() => {
    const retry = pending.current === null ? refused.current : null
    if (retry !== null) pending.current = retry
    refused.current = null
    flush()
    // Not taken again (`commit` returned `false`): it stays refused, for the
    // next blur, so leaving still does not send it (APP-829).
    if (retry !== null && pending.current === retry) {
      pending.current = null
      refused.current = retry
    }
  }, [flush])

  /**
   * Keeps a refused text in the field to try again, unless typed in or
   * sent again since. Leaving does not send it: only a blur does.
   */
  const keep = useCallback((text: string) => {
    if (pending.current !== null || sent.current !== text) return
    refused.current = text
    setDraft(text)
  }, [])

  /** Back to the saved text, unless typed in since. */
  const saved = useRef(value)
  saved.current = value
  const reset = useCallback(() => {
    if (pending.current === null) setDraft(saved.current)
  }, [])

  /** Back to the saved text, whatever is unsaved: the person chose to drop it. */
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pending.current = null
    refused.current = null
    setDraft(saved.current)
  }, [])

  /** `text` was saved another way: nothing to write, unless typed in since. */
  const settle = useCallback((text: string) => {
    // A refused copy of it is saved too: a later blur must not send it again.
    if (refused.current === text) refused.current = null
    if (pending.current !== text) return
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  /** Pending because a save was refused, not typed: a later refusal replaces it. */
  const held = useRef<string | null>(null)
  /** A save of `text` was refused: unsaved again, unless typed in since. */
  const hold = useCallback((text: string) => {
    if (pending.current !== null && pending.current !== held.current) return
    pending.current = text
    held.current = text
  }, [])

  return { draft, change, flush, blur, keep, reset, discard, settle, hold }
}
