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

/**
 * Taking back a repeating item's check (APP-520, APP-990). The mode draws an
 * item waiting for its next date as checked, and a tap on it undoes the
 * completion that sent it there, whoever made it:
 *
 * - the completion this phone heard of, when it made the check itself;
 * - otherwise the latest one the server has, so a check by another Member,
 *   or one whose id was lost, can be taken back too;
 * - a check still on its way is waited for first, so a quick second tap
 *   undoes it rather than failing;
 * - an undo that failed is forgotten, and the next tap asks the server again.
 *
 * `undo` resolves false when there was nothing to undo or the write failed.
 * A second tap while an undo is on its way joins it.
 */
export function completionUndo<CompletionId>(server: {
  latest: (taskId: string) => Promise<CompletionId | null>
  undo: (completionId: CompletionId) => Promise<unknown>
}) {
  const heard = new Map<string, CompletionId>()
  const checking = new Map<string, Promise<boolean>>()
  const undoing = new Map<string, Promise<boolean>>()

  const run = async (taskId: string) => {
    // A check that failed made no completion: an older one is not the one
    // this tap meant to take back.
    if ((await checking.get(taskId)) === false) return false
    const completionId = heard.get(taskId) ?? (await server.latest(taskId))
    if (completionId === null) return false
    try {
      await server.undo(completionId)
      return true
    } finally {
      if (heard.get(taskId) === completionId) heard.delete(taskId)
    }
  }

  return {
    heard(taskId: string, completionId: CompletionId) {
      heard.set(taskId, completionId)
    },
    /** A check on its way; `landed` resolves whether the server took it. */
    checking(taskId: string, landed: Promise<boolean>) {
      const settled = landed.catch(() => false)
      checking.set(taskId, settled)
      void settled.then(() => {
        if (checking.get(taskId) === settled) checking.delete(taskId)
      })
    },
    undo(taskId: string): Promise<boolean> {
      const current = undoing.get(taskId)
      if (current) return current
      const next = run(taskId)
        .catch(() => false)
        .finally(() => undoing.delete(taskId))
      undoing.set(taskId, next)
      return next
    },
  }
}
