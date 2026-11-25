import { addDays } from '@gather/core/civil-date'
import { useEffect, useRef } from 'react'

const STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
}

const TYPING =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

/**
 * Arrows move between days (up and down a week, where `weeks` says the view
 * has them), `t` is today and `n` adds an event. Not while a field has focus,
 * a dialog or menu is open, or a modifier is held; and a key somebody else
 * already answered is left alone.
 */
export function useCalendarKeys({
  day,
  weeks,
  onDay,
  onToday,
  onNew,
}: {
  /** The day arrows move from; absent while they should not move. */
  day: string | undefined
  weeks: boolean
  onDay: (date: string) => void
  onToday: () => void
  onNew: () => void
}) {
  const latest = useRef({ day, weeks, onDay, onToday, onNew })
  latest.current = { day, weeks, onDay, onToday, onNew }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing
      )
        return
      const target = event.target as Element | null
      if (target?.closest?.(TYPING)) return
      if (document.querySelector('[aria-modal="true"], [role="menu"]')) return
      const now = latest.current
      const step = STEPS[event.key]
      if (step) {
        if (!now.day) return
        const byWeek = Math.abs(step) === 7
        // Up and down scroll the panel when it holds the focus.
        if (byWeek && (!now.weeks || target?.closest?.('aside'))) return
        event.preventDefault()
        now.onDay(addDays(now.day, step))
      } else if (event.key === 't' || event.key === 'n') {
        event.preventDefault()
        if (event.key === 't') now.onToday()
        else now.onNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
