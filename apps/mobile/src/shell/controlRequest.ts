/**
 * The Control Center control's request for the quick-actions sheet (APP-207).
 *
 * The control's intent (`targets/widgets/_shared/OpenQuickActionsIntent.swift`)
 * runs inside the app and leaves the time it was asked under
 * `CONTROL_REQUEST_KEY` in the app's user defaults, which React Native reads
 * and watches as `Settings` (iOS only). `HomeScreenActionLinks` takes it
 * once, clears it, and opens the sheet if it is still fresh.
 */

/** Must match `OpenQuickActionsIntent.requestKey`. */
export const CONTROL_REQUEST_KEY = 'GatherQuickActionsControlRequestedAt'

/**
 * How old a request may be and still open the sheet. Long enough for a cold
 * start of a release build, short enough that one the app never took (it was
 * killed while loading) does not open the sheet on some later launch.
 */
export const CONTROL_REQUEST_MAX_AGE_MS = 60_000

/** Whether `requestedAt`, as stored by the intent, still asks for the sheet. */
export function isFreshControlRequest(requestedAt: unknown, now: number) {
  return (
    typeof requestedAt === 'number' &&
    Number.isFinite(requestedAt) &&
    now - requestedAt <= CONTROL_REQUEST_MAX_AGE_MS &&
    // A clock set back since: not fresh.
    requestedAt <= now
  )
}
