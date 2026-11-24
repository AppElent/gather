import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CLOSE_SHEETS_TIMEOUT_MS,
  closeOpenSheets,
  hasOpenPrompts,
  hasOpenSheets,
  LATE_SHEET_DELAY_MS,
  type OpenSheet,
  onSheetsClosing,
  openPrompt,
  openSheet,
  promptsAnswered,
} from './openSheets'

const registered: OpenSheet[] = []

/** A sheet whose dismiss reports closed when `later` is called. */
function sheet() {
  let close = () => {}
  const dismiss = vi.fn(() => {
    close = () => handle.closed()
  })
  const handle = openSheet(dismiss)
  registered.push(handle)
  return { dismiss, handle, later: () => close() }
}

afterEach(() => {
  for (const handle of registered.splice(0)) handle.closed()
  vi.useRealTimers()
})

describe('openSheets', () => {
  it('resolves at once when no sheet is open', async () => {
    expect(hasOpenSheets()).toBe(false)
    await expect(closeOpenSheets()).resolves.toBeUndefined()
  })

  it('dismisses every open sheet once and waits for all to close', async () => {
    const a = sheet()
    const b = sheet()
    expect(hasOpenSheets()).toBe(true)

    let resolved = false
    const closing = closeOpenSheets().then(() => {
      resolved = true
    })
    expect(a.dismiss).toHaveBeenCalledTimes(1)
    expect(b.dismiss).toHaveBeenCalledTimes(1)

    a.later()
    await Promise.resolve()
    expect(resolved).toBe(false)

    b.later()
    await closing
    expect(resolved).toBe(true)
    expect(hasOpenSheets()).toBe(false)
  })

  it('resolves when a dismiss reports closed synchronously', async () => {
    const handle = openSheet(() => handle.closed())
    registered.push(handle)
    await expect(closeOpenSheets()).resolves.toBeUndefined()
    expect(hasOpenSheets()).toBe(false)
  })

  it('gives up after the timeout when a sheet never reports closed', async () => {
    vi.useFakeTimers()
    sheet()
    let resolved = false
    const closing = closeOpenSheets().then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(CLOSE_SHEETS_TIMEOUT_MS - 1)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await closing
    expect(resolved).toBe(true)
  })

  it('asks again, on the next close, a sheet that never reported closed', async () => {
    vi.useFakeTimers()
    const a = sheet()
    const first = closeOpenSheets()
    await vi.advanceTimersByTimeAsync(CLOSE_SHEETS_TIMEOUT_MS)
    await first
    const second = closeOpenSheets()
    expect(a.dismiss).toHaveBeenCalledTimes(2)
    a.later()
    await second
  })

  it('counts a closed sheet once, however often it reports', () => {
    const a = sheet()
    const b = sheet()
    a.handle.closed()
    a.handle.closed()
    expect(hasOpenSheets()).toBe(true)
    b.handle.closed()
    expect(hasOpenSheets()).toBe(false)
  })

  it('treats the same dismiss registered twice as two sheets', () => {
    const dismiss = () => {}
    const first = openSheet(dismiss)
    const second = openSheet(dismiss)
    registered.push(first, second)
    first.closed()
    expect(hasOpenSheets()).toBe(true)
    second.closed()
    expect(hasOpenSheets()).toBe(false)
  })

  it('asks a closing sheet once when a second close comes in', async () => {
    const a = sheet()
    const first = closeOpenSheets()
    const second = closeOpenSheets()
    expect(a.dismiss).toHaveBeenCalledTimes(1)
    a.later()
    await Promise.all([first, second])
  })

  it('does not reset a newer sheet when an earlier overlapping close times out', async () => {
    vi.useFakeTimers()
    const stuck = sheet()
    const first = closeOpenSheets(1000)
    expect(stuck.dismiss).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)
    const newer = sheet()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    expect(newer.dismiss).toHaveBeenCalledTimes(1)

    const second = closeOpenSheets(1000)
    expect(stuck.dismiss).toHaveBeenCalledTimes(1)
    expect(newer.dismiss).toHaveBeenCalledTimes(1)

    // `first` times out while `second` is still waiting for `newer`.
    await vi.advanceTimersByTimeAsync(1000 - 500 - LATE_SHEET_DELAY_MS)
    await first

    // A follow-up close retries the sheet that timed out, not the newer one.
    const third = closeOpenSheets(1000)
    expect(stuck.dismiss).toHaveBeenCalledTimes(2)
    expect(newer.dismiss).toHaveBeenCalledTimes(1)

    stuck.later()
    newer.later()
    await Promise.all([second, third])
    expect(hasOpenSheets()).toBe(false)
  })

  it('re-asks a newer sheet once its own close also times out', async () => {
    vi.useFakeTimers()
    const stuck = sheet()
    const first = closeOpenSheets(1000)

    await vi.advanceTimersByTimeAsync(500)
    const newer = sheet()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    const second = closeOpenSheets(1000)

    await vi.advanceTimersByTimeAsync(1000 - 500 - LATE_SHEET_DELAY_MS)
    await first

    // Once `second` times out too, no waiter remains and `newer` can be asked again.
    await vi.advanceTimersByTimeAsync(1000)
    await second

    const third = closeOpenSheets(1000)
    expect(stuck.dismiss).toHaveBeenCalledTimes(2)
    expect(newer.dismiss).toHaveBeenCalledTimes(2)

    stuck.later()
    newer.later()
    await third
  })

  it('closes a sheet that opens mid-close once it has presented, and waits for it', async () => {
    vi.useFakeTimers()
    const a = sheet()
    let resolved = false
    const closing = closeOpenSheets().then(() => {
      resolved = true
    })
    const late = sheet()
    // Not in the same tick as its present().
    expect(late.dismiss).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    expect(late.dismiss).toHaveBeenCalledTimes(1)

    a.later()
    await vi.advanceTimersByTimeAsync(0)
    expect(resolved).toBe(false)

    late.later()
    await closing
    expect(resolved).toBe(true)
  })

  it('lets a second close wait out a late sheet still presenting', async () => {
    vi.useFakeTimers()
    const a = sheet()
    const first = closeOpenSheets()
    const late = sheet()
    // A replacement share closes again while `late` is still presenting.
    const second = closeOpenSheets()
    expect(late.dismiss).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    expect(late.dismiss).toHaveBeenCalledTimes(1)
    a.later()
    late.later()
    await Promise.all([first, second])
    expect(hasOpenSheets()).toBe(false)
  })

  it('leaves a sheet that opens after closing finished alone', async () => {
    const a = sheet()
    const closing = closeOpenSheets()
    a.later()
    await closing
    const next = sheet()
    expect(next.dismiss).not.toHaveBeenCalled()
  })

  it('tells its listeners before asking any sheet to close', async () => {
    const order: string[] = []
    const stop = onSheetsClosing(() => order.push('listener'))
    const broken = onSheetsClosing(() => {
      throw new Error('no draft')
    })
    const handle = openSheet(() => {
      order.push('dismiss')
      handle.closed()
    })
    registered.push(handle)
    await closeOpenSheets()
    expect(order).toEqual(['listener', 'dismiss'])

    // Not told when nothing is open, nor once unsubscribed.
    await closeOpenSheets()
    stop()
    broken()
    const again = openSheet(() => again.closed())
    registered.push(again)
    await closeOpenSheets()
    expect(order).toEqual(['listener', 'dismiss'])
  })

  it('tells its listeners about a sheet that opened mid-close', async () => {
    vi.useFakeTimers()
    const a = sheet()
    const told = vi.fn()
    const closing = closeOpenSheets()
    const late = sheet()
    const stop = onSheetsClosing(told)
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    expect(told).toHaveBeenCalledTimes(1)
    a.later()
    late.later()
    await closing
    stop()
  })
})

describe('prompts', () => {
  it('waits for every open prompt, then for what its answer opened', async () => {
    vi.useFakeTimers()
    const first = openPrompt()
    const second = openPrompt()
    let answered = false
    const waiting = promptsAnswered().then(() => {
      answered = true
    })
    first()
    first()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(hasOpenPrompts()).toBe(true)
    expect(answered).toBe(false)

    second()
    expect(hasOpenPrompts()).toBe(false)
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS - 1)
    expect(answered).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await waiting
    expect(answered).toBe(true)
  })

  it('waits for a prompt that an answer led to', async () => {
    vi.useFakeTimers()
    const first = openPrompt()
    let answered = false
    void promptsAnswered().then(() => {
      answered = true
    })
    first()
    const next = openPrompt()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS * 2)
    expect(answered).toBe(false)
    next()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    expect(answered).toBe(true)
  })

  it('counts a dialog with a limit as gone after it, and no other', async () => {
    vi.useFakeTimers()
    const typing = openPrompt()
    let done = false
    void promptsAnswered().then(() => {
      done = true
    })
    const late = openPrompt(1000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(done).toBe(false)
    typing()
    late()
    await vi.advanceTimersByTimeAsync(LATE_SHEET_DELAY_MS)
    expect(done).toBe(true)
    openPrompt(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(hasOpenPrompts()).toBe(false)
  })

  it('resolves at once when none is open', async () => {
    await expect(promptsAnswered()).resolves.toBeUndefined()
  })
})
