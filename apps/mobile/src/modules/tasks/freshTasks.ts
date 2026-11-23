/**
 * The task just saved from the keyboard composer (APP-587): its row shows on
 * the `home` wash for a moment, so the person sees where it went while the
 * composer stays open for the next one. Reduce Motion: no flash
 * (`TaskRow`).
 */
import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

/** How long a new row stays on the wash, in milliseconds. */
const FRESH_FOR = 1600

const fresh = new Set<string>()
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

export function markFresh(taskId: string): void {
  void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
    if (reduce) return
    fresh.add(taskId)
    notify()
    setTimeout(() => {
      fresh.delete(taskId)
      notify()
    }, FRESH_FOR)
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether this task was saved a moment ago. */
export function useFresh(taskId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => fresh.has(taskId),
    () => false,
  )
}
