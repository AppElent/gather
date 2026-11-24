// @vitest-environment jsdom
/** The chooser opens once nothing is in front of it (APP-618, APP-672). */
import { act, createElement } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import {
  openPrompt,
  openSheet,
  PROMPT_SETTLE_MS,
} from '../components/openSheets'
import { linkAfterSheets } from '../shell/linkAfterSheets'
import { mount } from '../testing/dom'
import { DropGate } from './DropGate'

const state = vi.hoisted(() => ({
  push: vi.fn(),
  pending: null as null | { sequence: number },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('./DropProvider', () => ({ useDrop: () => ({ pending: state.pending }) }))
vi.mock('./paths', () => ({ dropHref: () => '/drop' }))

beforeEach(() => {
  state.push.mockClear()
  state.pending = null
  vi.useFakeTimers()
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
