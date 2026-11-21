/**
 * "Hide the tab bar while I am on screen" (APP-544).
 *
 * A full-screen mode, such as groceries shopping mode
 * (`designs/groceries/README.md`, "8. Shopping mode"), asks for the bar to go
 * while it is focused, and the tabs layout passes the answer to `NativeTabs`'s
 * `hidden`. The bar comes back the moment no screen holds it hidden: leaving
 * the screen any way at all (Done, Back, the idle timeout, another tab, a
 * link) unfocuses or unmounts it, and that lets go.
 *
 * Holds are counted, not a flag, so one screen letting go never shows the bar
 * under another that still wants it hidden. A module-level store rather than a
 * context, as `searchFocus.ts` explains: the two ends are a route layout and a
 * screen several files apart. Only the bar's own visibility changes the layout,
 * so the five triggers do not re-render on every navigation.
 */
import { useEffect, useSyncExternalStore } from 'react'

let holds = 0
const listeners = new Set<() => void>()

function hold(): () => void {
  holds += 1
  notify()
  let released = false
  return () => {
    if (released) return
    released = true
    holds -= 1
    notify()
  }
}

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function hidden() {
  return holds > 0
}

/** Whether some screen holds the tab bar hidden. For the tabs layout. */
export function useTabBarHidden(): boolean {
  return useSyncExternalStore(subscribe, hidden, hidden)
}

/** Hides the tab bar while `active`; shows it again when not, or on unmount. */
export function useHideTabBarWhile(active: boolean) {
  useEffect(() => (active ? hold() : undefined), [active])
}
