import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CLOSE_SHEETS_TIMEOUT_MS,
  closeOpenSheets,
  hasOpenSheets,
  type OpenSheet,
  openSheet,
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
})
