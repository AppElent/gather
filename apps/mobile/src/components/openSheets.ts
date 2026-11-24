/**
 * Every `NativeSheet` and keyboard composer on screen, so something outside
 * them can close them all (APP-618, APP-672), and every OS dialog a share waits
 * for, because nothing outside it can close it.
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

/**
 * How long a sheet that opens mid-close gets to finish presenting before it is
 * asked to close: dismissing in the same tick as `present()` is lost on both
 * platforms.
 */
export const LATE_SHEET_DELAY_MS = 350

export interface OpenSheet {
  /** The sheet has closed, however it happened. Safe to call more than once. */
  closed: () => void
}

interface Entry {
  dismiss: () => void
  /** Already asked to close, so a second share does not ask again. */
  asked: boolean
  /**
   * Opened during a close and still presenting: only its own delayed ask
   * closes it, or a second close in that window would ask too early and the
   * request would be lost.
   */
  presenting: boolean
}

const sheets = new Set<Entry>()
const waiters = new Set<() => void>()
const prompts = new Set<symbol>()
const promptWaiters = new Set<() => void>()
const closingListeners = new Set<() => void>()

/** Tells the forms a share is closing sheets. */
function tellClosing() {
  for (const listener of [...closingListeners]) {
    // A draft that cannot be kept must not keep the chooser away.
    try {
      listener()
    } catch {}
  }
}

/**
 * Calls `listener` each time a sheet is about to be asked to close for a
 * share, including one that opened mid-close, so a form can keep what was
 * typed as a draft (APP-622). Returns the unsubscribe.
 */
export function onSheetsClosing(listener: () => void): () => void {
  closingListeners.add(listener)
  return () => {
    closingListeners.delete(listener)
  }
}

function settle() {
  if (sheets.size > 0) return
  for (const resolve of [...waiters]) resolve()
}

function ask(entry: Entry) {
  if (entry.asked) return
  entry.asked = true
  tellClosing()
  entry.dismiss()
}

/**
 * Registers a sheet that is up. `dismiss` closes it the way its Close button
 * does, so the sheet's own close handling (its `onClose`) runs once.
 *
 * A sheet that opens while sheets are being closed for a share is closed too,
 * once it has had time to present, or it would cover the chooser the same way.
 */
export function openSheet(dismiss: () => void): OpenSheet {
  // An entry per registration, so the same function registered twice is two
  // sheets.
  const entry: Entry = { dismiss, asked: false, presenting: waiters.size > 0 }
  sheets.add(entry)
  if (entry.presenting) {
    setTimeout(() => {
      entry.presenting = false
      if (sheets.has(entry) && waiters.size > 0) ask(entry)
    }, LATE_SHEET_DELAY_MS)
  }
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
 * Asks every open sheet to close, once each, and resolves once all have
 * reported closed, or after `timeoutMs` if one never does, so a caller is never
 * stuck behind a sheet. Resolves at once when none is open.
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
    const timer = setTimeout(() => {
      // A request that was lost is made again by the next close, rather than
      // leaving the sheet in front of every chooser from now on.
      for (const entry of sheets) entry.asked = false
      done()
    }, timeoutMs)
    waiters.add(done)
    for (const entry of [...sheets]) if (!entry.presenting) ask(entry)
    // A sheet whose dismiss reports closed at once has already settled.
    settle()
  })
}

/**
 * Registers an OS dialog that is up and whose answer would be lost, or would
 * open something over the chooser, if a share went ahead under it. Call the
 * result when it is answered; more than once is safe.
 */
export function openPrompt(): () => void {
  const id = Symbol('prompt')
  prompts.add(id)
  return () => {
    if (!prompts.delete(id) || prompts.size > 0) return
    for (const resolve of [...promptWaiters]) resolve()
    promptWaiters.clear()
  }
}

export function hasOpenPrompts() {
  return prompts.size > 0
}

/**
 * Resolves once no dialog is up, and what its answer changed or opened has had
 * time to render and present. There is no time limit: the dialog is in front
 * of the person, and goes only when they answer it.
 */
export async function promptsAnswered(): Promise<void> {
  while (prompts.size > 0) {
    await new Promise<void>((resolve) => {
      promptWaiters.add(resolve)
    })
    await new Promise((resolve) => setTimeout(resolve, LATE_SHEET_DELAY_MS))
  }
}
