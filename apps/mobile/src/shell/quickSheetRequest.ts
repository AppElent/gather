/**
 * "Open the quick-actions sheet": what `<scheme>://quick` asks (APP-206).
 *
 * The link can arrive signed out, or before the tabs exist, so the request is
 * held until the tabs layout takes it, the way `pendingGroupLink` holds a
 * Group link across the auth gate. A request made while the tabs are already
 * mounted reaches them through the listener instead. Either way it is taken
 * once: a second take answers null until somebody asks again.
 *
 * The address is a contract: deep links on installed apps point at it, and the
 * app icon's quick actions (APP-207) navigate to it. `QUICK_SHEET_PATH` is the
 * route file `app/quick.tsx`. `?action=task-new` (APP-207) also opens that
 * action's form; anything else in `action` is ignored, so the plain sheet
 * opens.
 *
 * While the sheet is up a request skips the route (`requestQuickSheetInPlace`):
 * navigating changes the root stack, and that dismisses the presented sheet.
 */
import type { Href } from 'expo-router'

import { QUICK_ACTIONS, type QuickActionId } from './quickActions'

export const QUICK_SHEET_PATH = '/quick'

export interface QuickSheetRequest {
  /**
   * The action whose form is open when the sheet appears: a `row` action,
   * checked by `quickSheetAction`.
   */
  action?: QuickActionId
}

type Listener = () => void

let pending: QuickSheetRequest | null = null
let openSheets = 0
const listeners = new Set<Listener>()

/**
 * The `action` query value as a request's action, or undefined for anything
 * that is not a row action, so a hand-typed or stale link still opens the
 * sheet.
 */
export function quickSheetAction(value: unknown): QuickActionId | undefined {
  return QUICK_ACTIONS.find(
    (action) => action.kind === 'row' && action.id === value,
  )?.id
}

/** The route that asks for the sheet, with the action as its query. */
export function quickSheetHref(request: QuickSheetRequest): Href {
  return { pathname: QUICK_SHEET_PATH, params: { ...request } }
}

/** Ask for the sheet: now, if the tabs are listening, or when they mount. */
export function requestQuickSheet(request: QuickSheetRequest = {}) {
  pending = request
  for (const listener of listeners) listener()
}

/** The request made since the last take, or null; clears it. */
export function takeQuickSheetRequest(): QuickSheetRequest | null {
  const asked = pending
  pending = null
  return asked
}

/**
 * Kept by the tabs layout while its sheet is up; call the result when it
 * closes. Counted, so a second tabs layout cannot clear the first's.
 */
export function markQuickSheetOpen() {
  openSheets += 1
  let marked = true
  return () => {
    if (marked) openSheets -= 1
    marked = false
  }
}

/**
 * Ask the sheet that is already up, and say whether it was: the caller then
 * skips the route, whose navigation would dismiss it.
 */
export function requestQuickSheetInPlace(request: QuickSheetRequest) {
  if (openSheets === 0) return false
  requestQuickSheet(request)
  return true
}

export function onQuickSheetRequest(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
