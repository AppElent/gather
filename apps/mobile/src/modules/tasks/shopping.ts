/**
 * Shopping mode's rules (APP-315; `designs/groceries/README.md`, "8. Shopping
 * mode"), kept apart from the screen so they can be tested.
 *
 * Checked items stay in place, unlike the normal list: the mode shows what
 * was open when shopping began, and anything added or put back since, until
 * it ends. An item another Member checks stays too, drawn checked.
 */
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { onShoppingList, waitsToRepeat } from './groceryList'

/** How long shopping mode waits for a tap before it ends by itself. */
export const SHOPPING_IDLE_MS = 30 * 60_000

type ShoppingTask = {
  id: string
  done: boolean
  repeat?: unknown
  dueDate?: string
}

/**
 * The ids shopping mode shows: those it already showed, and every item now
 * on the list (a repeating one waiting for its next due date is not).
 * Nothing leaves while the mode lasts, so a check never moves a row.
 */
export function shoppingIds(
  shown: ReadonlySet<string>,
  tasks: readonly ShoppingTask[],
  today: string,
): ReadonlySet<string> {
  const fresh = tasks.filter(
    (task) => onShoppingList(task, today) && !shown.has(task.id),
  )
  if (fresh.length === 0) return shown
  return new Set([...shown, ...fresh.map((task) => task.id)])
}

/**
 * The rows shopping mode draws, in the order given. A repeating item checked
 * off stays open on its next due date (APP-520), so it is drawn checked here
 * until that day, as any other checked row stays in place.
 */
export function shoppingRows<T extends ShoppingTask>(
  shown: ReadonlySet<string>,
  tasks: readonly T[],
  today: string,
): T[] {
  return tasks
    .filter((task) => shown.has(task.id))
    .map((task) => (waitsToRepeat(task, today) ? { ...task, done: true } : task))
}

/** How far along the shop is: checked rows of all rows shown. */
export function shoppingProgress(rows: readonly { done: boolean }[]): {
  done: number
  total: number
} {
  return {
    done: rows.filter((row) => row.done).length,
    total: rows.length,
  }
}

/**
 * Calls `onIdle` once `ms` pass without a `touch()`, counted only while
 * `active`. Time away (another tab, the phone locked, the app in the
 * background) counts: the check runs again the moment the screen is back.
 * Returns `touch`, which restarts the wait.
 */
export function useIdleTimeout(
  active: boolean,
  ms: number,
  onIdle: () => void,
): () => void {
  const last = useRef(Date.now())
  const fired = useRef(false)
  const callback = useRef(onIdle)
  callback.current = onIdle

  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | undefined
    // Re-arms for what is left rather than restarting on every touch: a tap
    // only moves `last`, and costs no render.
    const check = () => {
      clearTimeout(timer)
      if (fired.current) return
      const left = ms - (Date.now() - last.current)
      if (left <= 0) {
        fired.current = true
        callback.current()
        return
      }
      timer = setTimeout(check, left)
    }
    check()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check()
    })
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [active, ms])

  const touch = useRef(() => {
    last.current = Date.now()
  }).current
  return touch
}
