/**
 * Holds a link the system hands a running app until nothing is in front of the
 * screen it opens (APP-747).
 *
 * A sheet is presented above the stack, so the screen would open behind it, and
 * on iOS that sheet then no longer closes: its screen has been covered, and the
 * state that dismisses it does not reach the native sheet. So the sheets close
 * before the router navigates, exactly as they do for a share (`DropGate`): a
 * prompt is answered first, and what was typed is kept as a draft.
 *
 * One link is held at a time. A newer link, or a share, replaces it.
 */
import {
  closeAllSheets,
  hasOpenPrompts,
  hasOpenSheets,
} from '../components/openSheets'

let arrivals = 0

/** Forgets the link that is waiting, if any. */
export function dropHeldLink() {
  arrivals += 1
}

/**
 * The link itself once the way is clear, or `null`, which the router skips, when
 * something newer replaced it while it waited.
 */
export function linkAfterSheets(path: string): string | Promise<string | null> {
  dropHeldLink()
  if (!hasOpenSheets() && !hasOpenPrompts()) return path
  const arrival = arrivals
  const current = () => arrival === arrivals
  return closeAllSheets(current).then(() => (current() ? path : null))
}
