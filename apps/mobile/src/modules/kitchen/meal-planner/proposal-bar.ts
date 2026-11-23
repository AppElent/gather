/**
 * Whether the proposal bar shows, and which slots say "net overgenomen"
 * (APP-319, APP-460). Without React Native, so a test can mount it.
 *
 * The bar shows while the week has drafts, straight from the query: drafts
 * the query cache already holds on mount or on a week change bring it up in
 * the first frame (the APP-319 round-1 regression). Once this visit accepts a
 * draft, the bar stays as the all-saved tail until Klaar, Weggooien or a week
 * change. The tail is set when an accept starts, not when it resolves: the
 * drafts query may drop the last draft first, and the bar would flash off.
 * An accept that resolves after a week change marks nothing on the new week.
 */
import { useEffect, useRef, useState } from 'react'

export function slotKey(meal: { date: string; slot: string }) {
  return `${meal.date}|${meal.slot}`
}

export function useProposalBar(
  weekStart: string,
  drafts: readonly { source: 'ai' | 'rules' | 'fallback' }[],
) {
  const [savedTail, setSavedTail] = useState(false)
  const [justAccepted, setJustAccepted] = useState<ReadonlySet<string>>(new Set())
  const [fallback, setFallback] = useState(false)
  const week = useRef(weekStart)
  week.current = weekStart
  const accepted = useRef(justAccepted)
  accepted.current = justAccepted

  // A new week starts with no proposal of this visit. Declared first, so the
  // effects below see the new week's drafts after the reset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset per week
  useEffect(() => {
    setSavedTail(false)
    setJustAccepted(new Set())
  }, [weekStart])
  const draftFallback = drafts.some((draft) => draft.source === 'fallback')
  // Kept from the drafts, so the all-saved tail still says which kind it was.
  useEffect(() => {
    if (drafts.length > 0) setFallback(draftFallback)
  }, [drafts.length, draftFallback])

  /**
   * Call when an accept starts; call what it returns with the slots the
   * server planned (none when it planned nothing or failed).
   */
  const startAccept = () => {
    const started = week.current
    setSavedTail(true)
    return (planned: readonly string[]) => {
      if (week.current !== started) return
      if (planned.length > 0)
        setJustAccepted((current) => new Set([...current, ...planned]))
      else if (accepted.current.size === 0) setSavedTail(false)
    }
  }
  /** Klaar, Weggooien, a new plan: the tail and its marks go. */
  const close = () => {
    setSavedTail(false)
    setJustAccepted(new Set())
  }

  return {
    showBar: drafts.length > 0 || savedTail,
    fallback,
    justAccepted,
    startAccept,
    close,
  }
}
