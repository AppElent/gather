// @vitest-environment jsdom
import { act, useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { SHOPPING_IDLE_MS, useIdleTimeout } from '../modules/tasks/shopping'
import { mount } from '../testing/dom'
import { useHideTabBarWhile, useTabBarHidden } from './tabBarVisibility'

vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}))

/** What the tabs layout passes to `NativeTabs`'s `hidden`. */
const bar = { hidden: false }
function TabsLayout() {
  bar.hidden = useTabBarHidden()
  return null
}

function FullScreen({ focused }: { focused: boolean }) {
  useHideTabBarWhile(focused)
  return null
}

let views: ReturnType<typeof mount>[] = []
const render = (element: Parameters<typeof mount>[0]) => {
  const view = mount(element)
  views.push(view)
  return view
}

beforeEach(() => {
  render(<TabsLayout />)
})
afterEach(() => {
  for (const view of views) view.unmount()
  views = []
  vi.useRealTimers()
})

test('the bar hides while the screen is focused and comes back when it is not', () => {
  expect(bar.hidden).toBe(false)
  const screen = render(<FullScreen focused />)
  expect(bar.hidden).toBe(true)
  // Another tab, or a screen pushed on top: mounted, but not focused.
  screen.rerender(<FullScreen focused={false} />)
  expect(bar.hidden).toBe(false)
  screen.rerender(<FullScreen focused />)
  expect(bar.hidden).toBe(true)
})

test('leaving the screen (Done, Back) brings the bar back', () => {
  const screen = render(<FullScreen focused />)
  expect(bar.hidden).toBe(true)
  screen.unmount()
  views = views.filter((view) => view !== screen)
  expect(bar.hidden).toBe(false)
})

test('one screen letting go does not show the bar under another that holds it', () => {
  const first = render(<FullScreen focused />)
  render(<FullScreen focused />)
  first.rerender(<FullScreen focused={false} />)
  expect(bar.hidden).toBe(true)
})

/**
 * Shopping mode's idle timeout calls `leave`, which goes back; going back
 * unmounts the screen. Standing in for the router: `leave` drops the screen.
 */
function Shopping({ onLeave }: { onLeave: () => void }) {
  useHideTabBarWhile(true)
  useIdleTimeout(true, SHOPPING_IDLE_MS, onLeave)
  return null
}
function Route() {
  const [open, setOpen] = useState(true)
  return open ? <Shopping onLeave={() => setOpen(false)} /> : null
}

test('the idle timeout ends shopping mode and the bar comes back', () => {
  vi.useFakeTimers()
  render(<Route />)
  expect(bar.hidden).toBe(true)
  act(() => vi.advanceTimersByTime(SHOPPING_IDLE_MS - 1))
  expect(bar.hidden).toBe(true)
  act(() => vi.advanceTimersByTime(1))
  expect(bar.hidden).toBe(false)
})
