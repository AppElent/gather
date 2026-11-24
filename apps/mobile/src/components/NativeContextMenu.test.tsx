// @vitest-environment jsdom
/**
 * The menu host keeps the size it measured on mount, so a menu follows its
 * slot by remounting: when the measured width changes, and after a font scale
 * change (APP-738).
 */
import { act, createElement, type ReactNode, useEffect } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { NativeContextMenu } from './NativeContextMenu'

type LayoutHandler = (event: { nativeEvent: { layout: { width: number } } }) => void

const state = vi.hoisted(() => ({
  fontScale: 1,
  mounts: 0,
  slots: [] as { onLayout?: LayoutHandler }[],
}))

vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: state.fontScale }),
  View: ({
    children,
    onLayout,
    style,
  }: {
    children?: ReactNode
    onLayout?: LayoutHandler
    style?: unknown
  }) => {
    if (onLayout) state.slots.push({ onLayout })
    const flat = Object.assign({}, ...[style].flat(2)) as { width?: number }
    return createElement('div', { 'data-width': String(flat.width) }, children)
  },
}))
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: ({ children }: { children?: ReactNode }) => {
    useEffect(() => {
      state.mounts += 1
    }, [])
    return createElement('section', { 'data-testid': 'menu' }, children)
  },
}))
vi.mock('../feedback/haptics', () => ({ haptics: { menuOpened: () => {} } }))

const layout = (width: number) =>
  act(() =>
    state.slots.at(-1)?.onLayout?.({ nativeEvent: { layout: { width } } }),
  )

const menu = () => (
  <NativeContextMenu actions={[]} onAction={() => {}}>
    <span>Row</span>
  </NativeContextMenu>
)

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  unmount = undefined
  state.fontScale = 1
  state.mounts = 0
  state.slots.length = 0
})

describe('NativeContextMenu', () => {
  test('mounts the menu only once the slot is measured, at that width', () => {
    const view = mount(menu())
    unmount = view.unmount
    expect(state.mounts).toBe(0)

    layout(300)
    expect(state.mounts).toBe(1)
    expect(view.container.querySelector('[data-width="300"]')).not.toBeNull()
  })

  test('remounts at the new width when the slot width changes', () => {
    const view = mount(menu())
    unmount = view.unmount
    layout(300)
    layout(300)
    expect(state.mounts).toBe(1)

    layout(420)
    expect(state.mounts).toBe(2)
    expect(view.container.querySelector('[data-width="420"]')).not.toBeNull()
  })

  test('measures the slot again after the font scale changes', () => {
    const view = mount(menu())
    unmount = view.unmount
    layout(300)
    expect(state.mounts).toBe(1)

    state.fontScale = 1.5
    view.rerender(menu())
    // The stale width is not handed to the new host: the bare row is back
    // until the slot reports its width at the new text size.
    expect(view.container.querySelector('[data-testid="menu"]')).toBeNull()

    layout(360)
    expect(state.mounts).toBe(2)
    expect(view.container.querySelector('[data-width="360"]')).not.toBeNull()
  })
})
