import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  markQuickSheetOpen,
  onQuickSheetRequest,
  QUICK_SHEET_PATH,
  quickSheetAction,
  quickSheetHref,
  requestQuickSheet,
  requestQuickSheetInPlace,
  takeQuickSheetRequest,
} from './quickSheetRequest'

let unmark = () => {}

afterEach(() => {
  unmark()
  takeQuickSheetRequest()
})

describe('the quick-actions deep link (APP-206)', () => {
  test('holds a request made before the tabs mount, and gives it once', () => {
    requestQuickSheet()
    expect(takeQuickSheetRequest()).toEqual({})
    expect(takeQuickSheetRequest()).toBeNull()
  })

  test('nothing asked is nothing to open', () => {
    expect(takeQuickSheetRequest()).toBeNull()
  })

  test('carries the action whose form opens with the sheet (APP-207)', () => {
    requestQuickSheet({ action: 'task-new' })
    expect(takeQuickSheetRequest()).toEqual({ action: 'task-new' })
  })

  /**
   * `?action=` arrives from outside the app, so only an action whose form
   * opens inside the sheet is taken; anything else opens the plain sheet.
   */
  test('takes only a row action from a link', () => {
    expect(quickSheetAction('task-new')).toBe('task-new')
    expect(quickSheetAction('recipe-import')).toBeUndefined()
    expect(quickSheetAction('cheese-tasting')).toBeUndefined()
    expect(quickSheetAction('nonsense')).toBeUndefined()
    expect(quickSheetAction(['task-new'])).toBeUndefined()
    expect(quickSheetAction(undefined)).toBeUndefined()
  })

  test('is the route, with the action as its query (APP-207)', () => {
    expect(quickSheetHref({})).toEqual({ pathname: '/quick', params: {} })
    expect(quickSheetHref({ action: 'task-new' })).toEqual({
      pathname: '/quick',
      params: { action: 'task-new' },
    })
  })

  /**
   * Navigating to the route changes the root stack, which dismisses a sheet
   * that is up; so a request then is answered where it is (APP-207).
   */
  test('is answered in place only while the sheet is up', () => {
    const listener = vi.fn()
    const stop = onQuickSheetRequest(listener)
    expect(requestQuickSheetInPlace({ action: 'task-new' })).toBe(false)
    expect(listener).not.toHaveBeenCalled()

    unmark = markQuickSheetOpen()
    expect(requestQuickSheetInPlace({ action: 'task-new' })).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(takeQuickSheetRequest()).toEqual({ action: 'task-new' })

    unmark()
    unmark() // Twice is once.
    expect(requestQuickSheetInPlace({})).toBe(false)
    stop()
  })

  test('reaches tabs that are already listening, until they stop', () => {
    const listener = vi.fn(() => takeQuickSheetRequest())
    const stop = onQuickSheetRequest(listener)
    requestQuickSheet()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(takeQuickSheetRequest()).toBeNull()
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
