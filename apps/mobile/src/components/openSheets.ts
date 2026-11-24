/**
 * Every `NativeSheet` and keyboard composer on screen, so something outside
 * them can close them all (APP-618, APP-672), and every OS dialog a share waits
 * for, because nothing outside it can close it.
 *
 * A sheet is presented natively above the navigation stack, so pushing a
 * screen leaves it in front: a share arriving while one is up put the Drop
 * chooser behind it. `DropGate` closes the open sheets first, the way their own
 * Close does, and pushes the chooser once they are gone. A link opened over a
 * sheet does the same (`shell/linkAfterSheets.ts`): on iOS a sheet whose screen
 * has been covered no longer closes at all (APP-747).
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

/**
 * How long an answered prompt gets to leave, the keyboard to come back to the
 * form under it, and that form to finish moving. Closing a keyboard composer
 * while its card still animates crashes the app in Reanimated (APP-747).
 */
export const PROMPT_SETTLE_MS = 1000

export interface OpenSheet {
  /** The sheet has closed, however it happened. Safe to call more than once. */
  closed: () => void
}

interface Entry {
  dismiss: () => void
  /**
   * When this sheet was last asked to close, or `null` when not currently
   * asked, so a second share does not ask again and an earlier close timing
   * out does not reset a sheet asked after it started.
   */
  askedAt: number | null
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
let askClock = 0

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
  if (entry.askedAt !== null) return
  entry.askedAt = ++askClock
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
  const entry: Entry = {
    dismiss,
    askedAt: null,
    presenting: waiters.size > 0,
  }
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
    let cutoff = 0
    const done = () => {
      clearTimeout(timer)
      waiters.delete(done)
      resolve()
    }
    const timer = setTimeout(() => {
      done()
      // A request that was lost is made again by the next close, rather than
      // leaving the sheet in front of every chooser from now on. While another
      // close is still waiting, only reset sheets asked by the time this call
      // started so a newer sheet is not asked a second time.
      for (const entry of sheets) {
        if (
          entry.askedAt !== null &&
          (waiters.size === 0 || entry.askedAt <= cutoff)
        ) {
          entry.askedAt = null
        }
      }
    }, timeoutMs)
    waiters.add(done)
    for (const entry of [...sheets]) if (!entry.presenting) ask(entry)
    cutoff = askClock
    // A sheet whose dismiss reports closed at once has already settled.
    settle()
  })
}

/**
 * Registers an OS dialog that is up and whose answer would be lost, or would
 * open something over the chooser, if a share went ahead under it. Call the
 * result when it is answered; more than once is safe.
 *
 * With `maxMs` it counts as gone after that long, answered or not. Only for a
 * dialog that holds nothing typed: what a text prompt holds would be lost.
 */
export function openPrompt(maxMs?: number): () => void {
  const id = Symbol('prompt')
  prompts.add(id)
  const release = () => {
    clearTimeout(timer)
    if (!prompts.delete(id) || prompts.size > 0) return
    for (const resolve of [...promptWaiters]) resolve()
    promptWaiters.clear()
  }
  const timer = maxMs === undefined ? undefined : setTimeout(release, maxMs)
  return release
}

export function hasOpenPrompts() {
  return prompts.size > 0
}

/**
 * Resolves once no dialog is up, and what its answer changed or opened has had
 * time to render and present.
 */
export async function promptsAnswered(): Promise<void> {
  while (prompts.size > 0) {
    await new Promise<void>((resolve) => {
      promptWaiters.add(resolve)
    })
    await new Promise((resolve) => setTimeout(resolve, PROMPT_SETTLE_MS))
  }
}

/** Rounds of closing, for a sheet that replaces one as it closes. */
const CLOSE_ROUNDS = 2

/**
 * Waits for the open prompts, then closes what is open, for as long as whatever
 * asked is still `current`.
 */
export async function closeAllSheets(current: () => boolean): Promise<void> {
  await promptsAnswered()
  for (
    let round = 0;
    round < CLOSE_ROUNDS && current() && hasOpenSheets();
    round++
  ) {
    await closeOpenSheets()
  }
}
