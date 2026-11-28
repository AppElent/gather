// @vitest-environment jsdom
/**
 * Back from a Drop's import goes to the chooser, and a reselect of the tab
 * still pops to the tab's root (APP-972).
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { useBackToChooser } from './useBackToChooser'

type Prevented = { repeat: () => void }

const state = vi.hoisted(() => ({
  dismissedTo: [] as unknown[],
  active: [] as boolean[],
  onPrevented: undefined as ((event: Prevented) => void) | undefined,
  disabled: 0,
  tabPress: undefined as (() => void) | undefined,
  focused: true,
}))

vi.mock('expo-router', () => ({
  useRouter: () => ({
    dismissTo: (href: unknown) => state.dismissedTo.push(href),
  }),
  useNavigation: () => ({
    isFocused: () => state.focused,
    getParent: () => ({
      addListener: (_event: string, listener: () => void) => {
        state.tabPress = listener
        return () => {
          state.tabPress = undefined
        }
      },
    }),
  }),
  usePreventRemove: (active: boolean, callback: (e: Prevented) => void) => {
    state.active.push(active)
    state.onPrevented = callback
    return () => {
      state.disabled += 1
    }
  },
}))

let leave: (() => void) | undefined
function Probe({ active }: { active: boolean }) {
  leave = useBackToChooser(active)
  return null
}

let view: ReturnType<typeof mount> | undefined
beforeEach(() => {
  state.dismissedTo = []
  state.active = []
  state.onPrevented = undefined
  state.disabled = 0
  state.tabPress = undefined
  state.focused = true
})
afterEach(() => view?.unmount())

test('guards removal only while the Drop is pending', () => {
  view = mount(<Probe active={false} />)
  expect(state.active.at(-1)).toBe(false)
  expect(state.tabPress).toBeUndefined()

  view.unmount()
  view = mount(<Probe active />)
  expect(state.active.at(-1)).toBe(true)
  expect(state.tabPress).toBeDefined()
})

test('Back lifts the guard and goes down to the chooser', () => {
  view = mount(<Probe active />)
  const repeat = vi.fn()
  state.onPrevented?.({ repeat })

  expect(repeat).not.toHaveBeenCalled()
  expect(state.disabled).toBe(1)
  expect(state.dismissedTo).toEqual(['/drop'])
})

test('a reselect of the focused tab is let through to its root', () => {
  view = mount(<Probe active />)
  state.tabPress?.()
  const repeat = vi.fn()
  state.onPrevented?.({ repeat })

  expect(repeat).toHaveBeenCalledOnce()
  expect(state.dismissedTo).toEqual([])

  // Only that one: the next Back goes to the chooser again.
  state.onPrevented?.({ repeat })
  expect(repeat).toHaveBeenCalledOnce()
  expect(state.dismissedTo).toEqual(['/drop'])
})

test('a press of the tab while another screen is focused is not a reselect', () => {
  view = mount(<Probe active />)
  state.focused = false
  state.tabPress?.()
  const repeat = vi.fn()
  state.onPrevented?.({ repeat })

  expect(repeat).not.toHaveBeenCalled()
  expect(state.dismissedTo).toEqual(['/drop'])
})

test('leave() is the save: guard lifted, down to the chooser', () => {
  view = mount(<Probe active />)
  leave?.()

  expect(state.disabled).toBe(1)
  expect(state.dismissedTo).toEqual(['/drop'])
})
