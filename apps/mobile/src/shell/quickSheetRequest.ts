/**
 * "Open the quick-actions sheet": what `<scheme>://quick` asks (APP-206).
 *
 * The link can arrive signed out, or before the tabs exist, so the request is
 * held until the tabs layout takes it, the way `pendingGroupLink` holds a
 * Group link across the auth gate. A request made while the tabs are already
 * mounted reaches them through the listener instead. Either way it is taken
 * once: a second take answers false until somebody asks again.
 *
 * The address is a contract: APP-207 points the iOS Home Screen quick action
 * and the Control Center control at it. `QUICK_SHEET_PATH` is the route file
 * `app/quick.tsx`; renaming either breaks those entry points on installed
 * apps.
 */
export const QUICK_SHEET_PATH = '/quick'

type Listener = () => void

let pending = false
const listeners = new Set<Listener>()

/** Ask for the sheet: now, if the tabs are listening, or when they mount. */
export function requestQuickSheet() {
  pending = true
  for (const listener of listeners) listener()
}

/** Whether the sheet was asked for since the last take; clears the request. */
export function takeQuickSheetRequest(): boolean {
  const asked = pending
  pending = false
  return asked
}

export function onQuickSheetRequest(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
