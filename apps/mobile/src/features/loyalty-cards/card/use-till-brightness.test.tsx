// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../../testing/dom'
import { useTillBrightness } from './use-till-brightness'

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  brightness: 0.4,
  calls: [] as string[],
  listener: null as null | ((state: string) => void),
}))

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.os
    },
  },
  AppState: {
    addEventListener: (_: string, listener: (next: string) => void) => {
      state.listener = listener
      return { remove: () => (state.listener = null) }
    },
  },
}))

vi.mock('expo-brightness', () => ({
  getBrightnessAsync: async () => state.brightness,
  setBrightnessAsync: async (value: number) => {
    state.calls.push(`set ${value}`)
    state.brightness = value
  },
  restoreSystemBrightnessAsync: async () => {
    state.calls.push('restore system')
  },
}))

function Till() {
  useTillBrightness()
  return null
}

beforeEach(() => {
  state.os = 'ios'
  state.brightness = 0.4
  state.calls = []
})
afterEach(() => vi.restoreAllMocks())

test('iOS: raises to full on open and puts the person’s brightness back on leave', async () => {
  const view = mount(<Till />)
  await settle()
  expect(state.calls).toEqual(['set 1'])
  view.unmount()
  await settle()
  expect(state.calls).toEqual(['set 1', 'set 0.4'])
})

test('iOS: gives the brightness back in the background and raises it again on return', async () => {
  const view = mount(<Till />)
  await settle()
  state.listener?.('background')
  await settle()
  expect(state.brightness).toBe(0.4)
  state.listener?.('active')
  await settle()
  expect(state.brightness).toBe(1)
  view.unmount()
  await settle()
  expect(state.brightness).toBe(0.4)
})

test('iOS: restores what it read even when left before the read finished', async () => {
  const view = mount(<Till />)
  view.unmount()
  await settle()
  expect(state.calls).toEqual(['set 1', 'set 0.4'])
})

test('Android: hands the window back to the system setting', async () => {
  state.os = 'android'
  const view = mount(<Till />)
  await settle()
  view.unmount()
  await settle()
  expect(state.calls).toEqual(['set 1', 'restore system'])
})
