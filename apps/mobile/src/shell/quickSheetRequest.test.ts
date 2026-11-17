import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  onQuickSheetRequest,
  QUICK_SHEET_PATH,
  requestQuickSheet,
  takeQuickSheetRequest,
} from './quickSheetRequest'

afterEach(() => {
  takeQuickSheetRequest()
})

describe('the quick-actions deep link (APP-206)', () => {
  test('holds a request made before the tabs mount, and gives it once', () => {
    requestQuickSheet()
    expect(takeQuickSheetRequest()).toBe(true)
    expect(takeQuickSheetRequest()).toBe(false)
  })

  test('nothing asked is nothing to open', () => {
    expect(takeQuickSheetRequest()).toBe(false)
  })

  test('reaches tabs that are already listening, until they stop', () => {
    const listener = vi.fn(() => takeQuickSheetRequest())
    const stop = onQuickSheetRequest(listener)
    requestQuickSheet()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(takeQuickSheetRequest()).toBe(false)
    stop()
    requestQuickSheet()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  /**
   * APP-207's Home Screen quick action and Control Center control open this
   * address on installed apps, so it must stay a route file outside `(app)`
   * that a signed-out link can reach.
   */
  test('is a stable route outside the signed-in group', () => {
    expect(QUICK_SHEET_PATH).toBe('/quick')
    // Vite's `import.meta.glob` names the route files without importing them.
    const routes = Object.keys(import.meta.glob('../../app/**/*.tsx'))
    expect(routes).toContain(`../../app${QUICK_SHEET_PATH}.tsx`)
  })
})
