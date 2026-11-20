// @vitest-environment jsdom
/**
 * The shake gate (APP-439), ported from Foundry's `shake-to-report.test.tsx`:
 * shake listens only while nothing is presented, and comes back
 * `DISMISS_SETTLE_MS` after the last sheet, modal or alert goes.
 */
import * as Sentry from '@sentry/react-native'
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { mount } from '../testing/dom'
import { Modal } from '../ui/modal'
import {
  DISMISS_SETTLE_MS,
  hasPresentedRoute,
  holdShakeToReport,
  isPresentedRoute,
  resetShakeToReportForTests,
  startShakeToReport,
  useShakeToReportBlocker,
} from './shake-to-report'

vi.mock('@sentry/react-native', () => ({
  enableFeedbackOnShake: vi.fn(),
  disableFeedbackOnShake: vi.fn(),
}))
vi.mock('react-native', async () => {
  const React = await import('react')
  return {
    Platform: { OS: 'ios' },
    Modal: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  }
})

function Blocker({ active }: { active: boolean }) {
  useShakeToReportBlocker(active)
  return null
}

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(DISMISS_SETTLE_MS)
  })
const listening = () => vi.mocked(Sentry.enableFeedbackOnShake)
const paused = () => vi.mocked(Sentry.disableFeedbackOnShake)

beforeEach(() => {
  vi.useFakeTimers()
  resetShakeToReportForTests()
  listening().mockClear()
  paused().mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

it('listens for shakes once started with nothing presented', () => {
  startShakeToReport()
  expect(listening()).toHaveBeenCalledTimes(1)
})

it('stays off outside iOS', async () => {
  const { Platform } = await import('react-native')
  const os = Platform.OS
  Object.assign(Platform, { OS: 'android' })
  try {
    startShakeToReport()
    expect(listening()).not.toHaveBeenCalled()
  } finally {
    Object.assign(Platform, { OS: os })
  }
})

it('pauses while a sheet is presented and resumes after the last one closes', () => {
  startShakeToReport()
  const view = mount(
    <>
      <Blocker active />
      <Blocker active />
    </>,
  )
  expect(paused()).toHaveBeenCalledTimes(1)

  view.rerender(
    <>
      <Blocker active />
      <Blocker active={false} />
    </>,
  )
  settle()
  expect(listening()).toHaveBeenCalledTimes(1)
  expect(paused()).toHaveBeenCalledTimes(1)

  view.rerender(
    <>
      <Blocker active={false} />
      <Blocker active={false} />
    </>,
  )
  // Still paused while the last sheet animates out.
  expect(listening()).toHaveBeenCalledTimes(1)
  settle()
  expect(listening()).toHaveBeenCalledTimes(2)
})

it('never starts listening under a sheet that opened before start', () => {
  mount(<Blocker active />)
  startShakeToReport()
  expect(listening()).not.toHaveBeenCalled()
})

it('treats a visible Modal as presented and a hidden one as not', () => {
  startShakeToReport()
  const view = mount(<Modal visible={false} />)
  expect(paused()).not.toHaveBeenCalled()

  view.rerender(<Modal visible />)
  expect(paused()).toHaveBeenCalledTimes(1)

  view.unmount()
  settle()
  expect(listening()).toHaveBeenCalledTimes(2)
})

it('counts sheets and modals as presented routes, plain pushes as not', () => {
  expect(isPresentedRoute('formSheet')).toBe(true)
  expect(isPresentedRoute('modal')).toBe(true)
  expect(isPresentedRoute('card')).toBe(false)
  expect(isPresentedRoute(undefined)).toBe(false)
})

it('finds a presented route among a stack of plain pushes', () => {
  const state = { routes: [{ key: 'home' }, { key: 'edit' }] }
  const plain = { home: { options: {} }, edit: { options: { presentation: 'card' } } }
  expect(hasPresentedRoute(state, plain)).toBe(false)
  expect(
    hasPresentedRoute(state, {
      ...plain,
      edit: { options: { presentation: 'formSheet' } },
    }),
  ).toBe(true)
  // A route without a descriptor yet is not presented.
  expect(hasPresentedRoute({ routes: [{ key: 'new' }] }, {})).toBe(false)
})

it('treats a presented route in the stack as a blocker', () => {
  startShakeToReport()
  const state = { routes: [{ key: 'home' }, { key: 'sheet' }] }
  const descriptors = {
    home: { options: {} },
    sheet: { options: { presentation: 'formSheet' } },
  }
  const view = mount(<Blocker active={hasPresentedRoute(state, descriptors)} />)
  expect(paused()).toHaveBeenCalledTimes(1)
  view.unmount()
  settle()
  expect(listening()).toHaveBeenCalledTimes(2)
})

it('holds shake imperatively, counting every hold until its own release settles', () => {
  startShakeToReport()
  const first = holdShakeToReport()
  const second = holdShakeToReport()
  expect(paused()).toHaveBeenCalledTimes(1)

  first()
  settle()
  expect(listening()).toHaveBeenCalledTimes(1)

  second()
  expect(listening()).toHaveBeenCalledTimes(1)
  settle()
  expect(listening()).toHaveBeenCalledTimes(2)
})

it('ignores a second release of the same hold', () => {
  startShakeToReport()
  const held = holdShakeToReport()
  const other = holdShakeToReport()
  held()
  held()
  settle()
  // `other` still holds: a double release must not have eaten its count.
  expect(listening()).toHaveBeenCalledTimes(1)
  other()
  settle()
  expect(listening()).toHaveBeenCalledTimes(2)
})
