/** A link opens its screen once nothing is in front of it (APP-747). */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { redirectSystemPath } from '../../app/+native-intent'
import {
  CLOSE_SHEETS_TIMEOUT_MS,
  onSheetsClosing,
  openPrompt,
  openSheet,
  PROMPT_SETTLE_MS,
} from '../components/openSheets'

vi.mock('expo-share-intent', () => ({
  getShareExtensionKey: () => 'gather-devShareKey',
}))

const SHARE = 'gather-dev://dataUrl=gather-devShareKey#text'
const LINK = 'gather-dev://drop'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const opened = (path: string) => redirectSystemPath({ path, initial: false })

test('nothing open: the link goes on at once', () => {
  expect(opened(LINK)).toBe(LINK)
  expect(opened('gather://g/home/notes')).toBe('/')
  expect(opened(SHARE)).toBeNull()
})

test('a link that launched the app is never held', () => {
  const answered = openPrompt()
  expect(redirectSystemPath({ path: LINK, initial: true })).toBe(LINK)
  expect(redirectSystemPath({ path: SHARE, initial: true })).toBe('/')
  answered()
})

test('an open sheet is closed before the link goes on, its draft kept', async () => {
  const order: string[] = []
  const stop = onSheetsClosing(() => order.push('draft kept'))
  const sheet = openSheet(() => {
    order.push('asked')
    setTimeout(() => {
      order.push('closed')
      sheet.closed()
    }, 400)
  })
  const going = Promise.resolve(opened(LINK)).then((path) => {
    order.push('link')
    return path
  })
  await vi.advanceTimersByTimeAsync(399)
  expect(order).toEqual(['draft kept', 'asked'])
  await vi.advanceTimersByTimeAsync(1)
  expect(await going).toBe(LINK)
  expect(order).toEqual(['draft kept', 'asked', 'closed', 'link'])
  stop()
})

test('a prompt is answered first', async () => {
  const answered = openPrompt()
  const done = vi.fn()
  void Promise.resolve(opened(LINK)).then(done)
  await vi.advanceTimersByTimeAsync(60_000)
  expect(done).not.toHaveBeenCalled()
  answered()
  await vi.advanceTimersByTimeAsync(PROMPT_SETTLE_MS)
  expect(done).toHaveBeenCalledExactlyOnceWith(LINK)
})

test('a sheet that never closes does not swallow the link', async () => {
  const sheet = openSheet(() => {})
  const going = opened(LINK)
  await vi.advanceTimersByTimeAsync(CLOSE_SHEETS_TIMEOUT_MS * 2)
  expect(await going).toBe(LINK)
  sheet.closed()
})

test.each([
  ['a newer link', 'gather-dev://all/tasks', 'gather-dev://all/tasks'],
  ['a share', SHARE, null],
])('%s replaces the one that waits', async (_, newer, expected) => {
  const answered = openPrompt()
  const first = opened(LINK)
  const second = opened(newer)
  answered()
  await vi.advanceTimersByTimeAsync(PROMPT_SETTLE_MS)
  expect(await first).toBeNull()
  expect(await second).toBe(expected)
})

test('a form opened after the held link was replaced is not closed for it', async () => {
  const answered = openPrompt()
  const first = opened(LINK)
  opened(SHARE)
  const dismiss = vi.fn()
  const sheet = openSheet(dismiss)
  answered()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(await first).toBeNull()
  expect(dismiss).not.toHaveBeenCalled()
  sheet.closed()
})
