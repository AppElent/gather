// @vitest-environment jsdom
/**
 * An `InsetList` keeps each row mounted while rows come and go around it, so
 * a focused composer under an empty-list note keeps its keyboard when the
 * first item lands and the note goes (APP-521).
 */
import { type ReactNode, useEffect } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { InsetList, useInsetRowFirst } from './inset-list'

vi.mock('react-native', async () => {
  const React = await import('react')
  const box = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children)
  return {
    Platform: { OS: 'ios' },
    Pressable: box,
    Text: box,
    View: box,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  }
})
vi.mock('../components/NativeContextMenu', () => ({ NativeContextMenu: () => null }))
vi.mock('../components/SwipeableRow', () => ({ SwipeableRow: () => null }))
vi.mock('../theme/icons', () => ({ UI_ICONS: {} }))
vi.mock('../theme/tokens', () => ({
  RADIUS: { card: 0 },
  SIZE: { rowMin: 52 },
  SPACE: { 1: 4, 2: 8, 3: 12, 4: 16 },
  TYPE: {},
  useTokens: () => ({}),
}))

const mounts = vi.fn()
const firsts: boolean[] = []

function Composer() {
  firsts.push(useInsetRowFirst())
  useEffect(() => {
    mounts()
  }, [])
  return null
}

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  unmount = undefined
  mounts.mockClear()
  firsts.length = 0
})

describe('InsetList', () => {
  test('a row stays mounted when a row above it goes', () => {
    const list = (empty: boolean) => (
      <InsetList>
        {empty ? <div>Nothing on this list yet.</div> : null}
        <Composer />
      </InsetList>
    )
    const view = mount(list(true))
    unmount = view.unmount
    view.rerender(list(false))

    expect(mounts).toHaveBeenCalledTimes(1)
    // Still told it is first once the note above it has gone.
    expect(firsts.at(-1)).toBe(true)
  })

  test('a keyed row stays mounted when rows are added above it', () => {
    const list = (items: string[]) => (
      <InsetList>
        {items.map((item) => (
          <div key={item}>{item}</div>
        ))}
        <Composer />
      </InsetList>
    )
    const view = mount(list(['Milk']))
    unmount = view.unmount
    view.rerender(list(['Apples', 'Milk']))

    expect(mounts).toHaveBeenCalledTimes(1)
    expect(firsts.at(-1)).toBe(false)
  })
})
