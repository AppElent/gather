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
 * The tail and its marks belong to the week they were made on, so a week
 * change hides them in its first frame, before the reset runs (APP-477).
 */
import { useEffect, useRef, useState } from 'react'

const NO_SLOTS: ReadonlySet<string> = new Set()

export function slotKey(meal: { date: string; slot: string }) {
  return `${meal.date}|${meal.slot}`
}

/**
 * How far the screen's toast rises so it sits above the bar, which floats
 * `gap` over the safe area (APP-1002): on a short phone the toast otherwise
 * covers Weggooien and Neem alle over. Nothing until the bar has a height.
 */
export function toastClearance(showBar: boolean, barHeight: number, gap: number) {
  return showBar && barHeight > 0 ? gap + barHeight : 0
}

export function useProposalBar(
  weekStart: string,
  drafts: readonly { source: 'ai' | 'rules' | 'fallback' }[],
) {
  // The week the tail and the marks were made on: read only on that week.
  const [tailWeek, setTailWeek] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<{ week: string; slots: ReadonlySet<string> }>({
    week: weekStart,
    slots: NO_SLOTS,
  })
  const [fallback, setFallback] = useState(false)
  const week = useRef(weekStart)
  week.current = weekStart
  const acceptedNow = useRef(accepted)
  acceptedNow.current = accepted
  const savedTail = tailWeek === weekStart
  const justAccepted = accepted.week === weekStart ? accepted.slots : NO_SLOTS

  // A new week starts with no proposal of this visit. Declared first, so the
  // effects below see the new week's drafts after the reset.
  useEffect(() => {
    setTailWeek(null)
    setAccepted({ week: weekStart, slots: NO_SLOTS })
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
    setTailWeek(started)
    return (planned: readonly string[]) => {
      if (week.current !== started) return
      if (planned.length > 0)
        setAccepted((current) => ({
          week: started,
          slots: new Set([...(current.week === started ? current.slots : []), ...planned]),
        }))
      else {
        const now = acceptedNow.current
        if (now.week !== started || now.slots.size === 0) setTailWeek(null)
      }
    }
  }
  /** Klaar, Weggooien, a new plan: the tail and its marks go. */
  const close = () => {
    setTailWeek(null)
    setAccepted({ week: week.current, slots: NO_SLOTS })
  }

  return {
    showBar: drafts.length > 0 || savedTail,
    fallback,
    justAccepted,
    startAccept,
    close,
  }
}
