// @vitest-environment jsdom
/**
 * The chooser is one screen however it is reached: a second share or
 * `gather-dev://drop` while it is open reuses it (APP-734). The router's own
 * singular handling is Expo Router's; what is ours, and tested here, is that the
 * chooser route asks for it.
 */
import { Children, createElement, isValidElement, type ReactNode } from 'react'
import { expect, test, vi } from 'vitest'

import DropLayout from '../../app/(app)/drop/_layout'
import { mount } from '../testing/dom'

const screens = vi.hoisted(
  () => [] as { name: string; dangerouslySingular?: unknown }[],
)

vi.mock('expo-router', () => {
  const Screen = () => null
  const Stack = ({ children }: { children?: ReactNode }) => {
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === Screen)
        screens.push(child.props as (typeof screens)[number])
    })
    return null
  }
  Stack.Screen = Screen
  return { Stack }
})
vi.mock('../theme/tokens', () => ({ useTokens: () => ({ ground: '#fff' }) }))

test('the chooser route is singular, so it is never stacked twice', () => {
  mount(createElement(DropLayout)).unmount()
  const chooser = screens.find((screen) => screen.name === 'index')
  expect(chooser?.dangerouslySingular).toBe(true)
})
