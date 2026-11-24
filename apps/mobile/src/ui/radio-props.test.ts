import { afterEach, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ OS: 'ios' }))
vi.mock('react-native', () => ({ Platform: platform }))

import { radioProps } from './radio-props'

afterEach(() => {
  platform.OS = 'ios'
})

it('is a selected button that says it is a radio button on iOS', () => {
  expect(radioProps(true, 'keuzerondje')).toEqual({
    accessibilityRole: 'button',
    accessibilityState: { selected: true },
    accessibilityValue: { text: 'keuzerondje' },
  })
  expect(radioProps(false, 'keuzerondje').accessibilityState).toEqual({
    selected: false,
  })
})

it('is a real radio on Android', () => {
  platform.OS = 'android'
  expect(radioProps(true, 'keuzerondje')).toEqual({
    accessibilityRole: 'radio',
    accessibilityState: { checked: true },
  })
})
