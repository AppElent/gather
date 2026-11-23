/**
 * The task just saved from the keyboard composer (APP-587): its row shows on
 * its group's wash for a moment, so the person sees where it went while the
 * composer stays open for the next one. Reduce Motion: no flash
 * (`TaskRow`).
 */
import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

import type { ModuleGroup } from '../../theme/tokens'

/** How long a new row stays on the wash, in milliseconds. */
const FRESH_FOR = 1600

const fresh = new Map<string, ModuleGroup>()
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

/** `group` is the wash it shows on: a grocery item's is `kitchen`. */
export function markFresh(taskId: string, group: ModuleGroup = 'home'): void {
  void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
    if (reduce) return
    fresh.set(taskId, group)
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

/** The group whose wash this task shows on, when it was saved a moment ago. */
export function useFresh(taskId: string): ModuleGroup | undefined {
  return useSyncExternalStore(
    subscribe,
    () => fresh.get(taskId),
    () => undefined,
  )
}
