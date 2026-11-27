// @vitest-environment jsdom
/** The chooser opens once nothing is in front of it (APP-618, APP-672). */
import { act, createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  openPrompt,
  openSheet,
  PROMPT_SETTLE_MS,
} from '../components/openSheets'
import { linkAfterSheets } from '../shell/linkAfterSheets'
import { mount } from '../testing/dom'
import { DropGate, REOFFER_SETTLE_MS, REOFFER_WINDOW_MS } from './DropGate'

const state = vi.hoisted(() => ({
  push: vi.fn(),
  pending: null as null | { sequence: number },
  pathname: '/all/tasks',
}))
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: state.push }),
  usePathname: () => state.pathname,
}))
vi.mock('./DropProvider', () => ({ useDrop: () => ({ pending: state.pending }) }))
vi.mock('./paths', () => ({ dropHref: () => '/drop' }))

beforeEach(() => {
  state.push.mockClear()
  state.pending = null
  state.pathname = '/all/tasks'
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

function share(sequence: number) {
  state.pending = { sequence }
  return mount(createElement(DropGate))
}
const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

test('nothing open: the chooser opens at once', () => {
  share(1).unmount()
  expect(state.push).toHaveBeenCalledExactlyOnceWith('/drop')
})

test('an open prompt is answered first, then its form closes, then the chooser', async () => {
  const order: string[] = []
  const sheet = openSheet(() => {
    order.push('closed')
    sheet.closed()
  })
  const answered = openPrompt()
  state.push.mockImplementationOnce(() => order.push('chooser'))
  const view = share(1)
  await pass(60_000)
  expect(order).toEqual([])
  order.push('answered')
  answered()
  await pass(PROMPT_SETTLE_MS)
  expect(order).toEqual(['answered', 'closed', 'chooser'])
  view.unmount()
})

test('what an answer opens is closed before the chooser', async () => {
  const answered = openPrompt()
  const view = share(1)
  answered()
  const dismiss = vi.fn(() => sheet.closed())
  const sheet = openSheet(dismiss)
  await pass(PROMPT_SETTLE_MS)
  expect(dismiss).toHaveBeenCalledOnce()
  expect(state.push).toHaveBeenCalledOnce()
  view.unmount()
})

test('a Drop replaced while a prompt is up opens the chooser once', async () => {
  const answered = openPrompt()
  const view = share(1)
  state.pending = { sequence: 2 }
  view.rerender(createElement(DropGate))
  answered()
  await pass(PROMPT_SETTLE_MS)
  expect(state.push).toHaveBeenCalledOnce()
  view.unmount()
})

test('a form opened after the Drop was cleared or left is not closed', async () => {
  for (const leave of ['cleared', 'unmounted']) {
    const answered = openPrompt()
    const view = share(1)
    state.pending = null
    if (leave === 'cleared') view.rerender(createElement(DropGate))
    else view.unmount()
    const dismiss = vi.fn()
    const sheet = openSheet(dismiss)
    answered()
    await pass(60_000)
    expect(dismiss).not.toHaveBeenCalled()
    expect(state.push).not.toHaveBeenCalled()
    sheet.closed()
    if (leave === 'cleared') view.unmount()
  }
})

test('a link that follows a waiting share opens instead of the chooser (APP-774)', async () => {
  const answered = openPrompt()
  const view = share(1)
  const link = linkAfterSheets('gather-dev://all/tasks')
  answered()
  await pass(PROMPT_SETTLE_MS)
  expect(await link).toBe('gather-dev://all/tasks')
  expect(state.push).not.toHaveBeenCalled()
  view.unmount()
})

/** A share waits on a prompt, a link replaces it, and the prompt is answered. */
async function lostToLink() {
  const answered = openPrompt()
  const view = share(1)
  const link = linkAfterSheets('gather-dev://all/notes')
  answered()
  await pass(PROMPT_SETTLE_MS)
  expect(await link).toBe('gather-dev://all/notes')
  expect(state.push).not.toHaveBeenCalled()
  return view
}

test('a share that lost to a link gets its chooser back once that screen is up (APP-817)', async () => {
  const view = await lostToLink()
  state.pathname = '/all/notes'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).toHaveBeenCalledExactlyOnceWith('/drop')
  view.unmount()
})

test('it waits out the notification handoff route', async () => {
  const view = await lostToLink()
  state.pathname = '/open-notification'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).not.toHaveBeenCalled()
  state.pathname = '/all/calendar/e1'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).toHaveBeenCalledOnce()
  view.unmount()
})

test('a sheet the newer screen opened keeps the chooser away, and later moves do not bring it back', async () => {
  const view = await lostToLink()
  // A quick action: through the quick route, back to Home, its sheet open.
  state.pathname = '/quick'
  view.rerender(createElement(DropGate))
  await pass(100)
  state.pathname = '/home'
  view.rerender(createElement(DropGate))
  const sheet = openSheet(() => {})
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).not.toHaveBeenCalled()
  // The person closes it and goes elsewhere, inside the window.
  sheet.closed()
  await pass(1000)
  state.pathname = '/all/tasks'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_WINDOW_MS)
  expect(state.push).not.toHaveBeenCalled()
  view.unmount()
})

test('a link to the screen already in front still brings the chooser back, once', async () => {
  const view = await lostToLink()
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).toHaveBeenCalledExactlyOnceWith('/drop')
  state.pathname = '/all/tasks'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_WINDOW_MS)
  expect(state.push).toHaveBeenCalledOnce()
  view.unmount()
})

test('moving on before the newer screen settles still waits for the sheet check', async () => {
  const view = await lostToLink()
  const sheet = openSheet(() => {})
  state.pathname = '/all/notes'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  sheet.closed()
  state.pathname = '/all/tasks'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_WINDOW_MS)
  expect(state.push).not.toHaveBeenCalled()
  view.unmount()
})

test('a Drop that was cleared or replaced meanwhile is not brought back', async () => {
  const view = await lostToLink()
  state.pending = null
  view.rerender(createElement(DropGate))
  state.pathname = '/all/notes'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).not.toHaveBeenCalled()
  view.unmount()
})

test('a share that never waited, or that no one replaced, is not offered twice', async () => {
  const view = share(1)
  expect(state.push).toHaveBeenCalledOnce()
  state.pathname = '/drop'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_WINDOW_MS)
  state.pathname = '/all/notes'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).toHaveBeenCalledOnce()
  view.unmount()
})

test('a share arriving during the prompt settle window waits and closes what the answer opened (APP-840)', async () => {
  const answered = openPrompt()
  answered()
  await pass(50)
  const view = share(1)
  expect(state.push).not.toHaveBeenCalled()
  const dismiss = vi.fn(() => sheet.closed())
  const sheet = openSheet(dismiss)
  await pass(PROMPT_SETTLE_MS - 51)
  expect(state.push).not.toHaveBeenCalled()
  await pass(1)
  expect(dismiss).toHaveBeenCalledOnce()
  expect(state.push).toHaveBeenCalledExactlyOnceWith('/drop')
  view.unmount()
})

test('a re-offer gives up when a prompt is settling at the settle check (APP-840)', async () => {
  const view = await lostToLink()
  state.pathname = '/all/notes'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS - 50)
  // A prompt on the newer screen was just answered and its answer may open a sheet.
  openPrompt()()
  await pass(50)
  expect(state.push).not.toHaveBeenCalled()
  await pass(PROMPT_SETTLE_MS + REOFFER_WINDOW_MS)
  expect(state.push).not.toHaveBeenCalled()
  view.unmount()
})

test('reaching /drop cancels a waiting re-offer so moving on to /drop/pick or a keepsDrop screen does not push /drop over it (APP-840)', async () => {
  const answered = openPrompt()
  const view = share(1)
  const link = linkAfterSheets('gather-dev://drop')
  answered()
  await pass(PROMPT_SETTLE_MS)
  expect(await link).toBe('gather-dev://drop')
  // The harness link opens the chooser, and the person moves on inside REOFFER_SETTLE_MS.
  state.pathname = '/drop'
  view.rerender(createElement(DropGate))
  await pass(50)
  state.pathname = '/all/recipes/import'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).not.toHaveBeenCalled()
  view.unmount()
})

test('a re-offer armed while already on /drop still returns after a link leaves /drop (APP-840)', async () => {
  state.pathname = '/drop'
  let closeSheet = () => {}
  const sheet = openSheet(() => {
    closeSheet = () => sheet.closed()
  })
  const view = share(1)
  await pass(0)
  const link = linkAfterSheets('gather-dev://all/notes')
  closeSheet()
  expect(await link).toBe('gather-dev://all/notes')
  state.pathname = '/all/notes'
  view.rerender(createElement(DropGate))
  await pass(REOFFER_SETTLE_MS)
  expect(state.push).toHaveBeenCalledExactlyOnceWith('/drop')
  view.unmount()
})
