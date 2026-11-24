/**
 * Holds whatever takes a running app to a screen until nothing is in front of
 * it: a link the system hands over (APP-747), a share's chooser (`DropGate`), a
 * tapped notification, a home-screen action and the Control Center control
 * (APP-774).
 *
 * A sheet is presented above the stack, so the screen would open behind it, and
 * on iOS that sheet then no longer closes: its screen has been covered, and the
 * state that dismisses it does not reach the native sheet. So the sheets close
 * before anything navigates: a prompt is answered first, and what was typed is
 * kept as a draft.
 *
 * One arrival is held at a time, and the newest wins: a link's screen never
 * lands on top of the chooser a share was still waiting to open. A share that
 * loses keeps its Drop pending and is told (`onSuperseded`), so `DropGate` can
 * bring its chooser back once the newer screen is up (APP-817).
 */
import {
  closeAllSheets,
  hasOpenPrompts,
  hasOpenSheets,
} from '../components/openSheets'

/** What waits for the sheets, or `null` when nothing does. */
let held: { share: boolean } | null = null

/**
 * The share extension's link is in: forgets a link that waits. A share that
 * waits stays, because this one may carry nothing Gather can place; one that
 * does replaces it when its own chooser comes to open.
 */
export function dropHeldLink() {
  if (!held?.share) held = null
}

/** Whether something waits for the sheets, so they are closing or about to. */
export function isWaitingForSheets() {
  return held !== null
}

/**
 * `true` when nothing is in front, else whether this arrival is still the
 * newest one, and still `wanted`, once nothing is.
 */
function wayClear(
  share: boolean,
  wanted: () => boolean,
  onSuperseded?: () => void,
): true | Promise<boolean> {
  held = null
  if (!hasOpenSheets() && !hasOpenPrompts()) return true
  const arrival = { share }
  held = arrival
  const current = () => held === arrival && wanted()
  return closeAllSheets(current).then(() => {
    const go = current()
    // Something newer took the slot while this one still wanted it.
    if (held !== arrival && wanted()) onSuperseded?.()
    if (held === arrival) held = null
    return go
  })
}

/**
 * The link itself once the way is clear, or `null`, which the router skips, when
 * something newer replaced it while it waited.
 */
export function linkAfterSheets(path: string): string | Promise<string | null> {
  const clear = wayClear(false, () => true)
  return clear === true ? path : clear.then((go) => (go ? path : null))
}

/**
 * Calls `open` once the way is clear, at once when it already is; never when
 * something newer replaced it, or it is no longer `wanted`, while it waited.
 */
export function openAfterSheets(
  open: () => void,
  {
    share = false,
    wanted = () => true,
    onSuperseded,
  }: {
    share?: boolean
    wanted?: () => boolean
    /** Called once when something newer replaced this while it still wanted to open. */
    onSuperseded?: () => void
  } = {},
) {
  const clear = wayClear(share, wanted, onSuperseded)
  if (clear === true) open()
  else
    void clear.then((go) => {
      if (go) open()
    })
}
