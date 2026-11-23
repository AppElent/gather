/**
 * Every `NativeSheet` on screen, so something outside them can close them all
 * (APP-618).
 *
 * A sheet is presented natively above the navigation stack, so pushing a
 * screen leaves it in front: a share arriving while one is up put the Drop
 * chooser behind it. `DropGate` closes the open sheets first, the way their own
 * Close does, and pushes the chooser once they are gone.
 *
 * Kept free of React Native so it can be unit-tested.
 */

/** How long `closeOpenSheets` waits for the sheets to report they closed. */
export const CLOSE_SHEETS_TIMEOUT_MS = 1500

export interface OpenSheet {
  /** The sheet has closed, however it happened. Safe to call more than once. */
  closed: () => void
}

const sheets = new Set<() => void>()
const waiters = new Set<() => void>()

function settle() {
  if (sheets.size > 0) return
  for (const resolve of [...waiters]) resolve()
}

/**
 * Registers a sheet that is up. `dismiss` closes it the way its Close button
 * does, so the sheet's own close handling (its `onClose`) runs once.
 */
export function openSheet(dismiss: () => void): OpenSheet {
  // A wrapper per registration, so the same function registered twice is two
  // sheets.
  const entry = () => dismiss()
  sheets.add(entry)
  return {
    closed: () => {
      if (!sheets.delete(entry)) return
      settle()
    },
  }
}

export function hasOpenSheets() {
  return sheets.size > 0
}

/**
 * Asks every open sheet to close, and resolves once all have reported closed,
 * or after `timeoutMs` if one never does, so a caller is never stuck behind a
 * sheet. Resolves at once when none is open.
 */
export function closeOpenSheets(
  timeoutMs = CLOSE_SHEETS_TIMEOUT_MS,
): Promise<void> {
  if (sheets.size === 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      waiters.delete(done)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    waiters.add(done)
    for (const dismiss of [...sheets]) dismiss()
    // A sheet whose dismiss reports closed at once has already settled.
    settle()
  })
}
