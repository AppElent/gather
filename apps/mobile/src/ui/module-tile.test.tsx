// @vitest-environment jsdom
/**
 * A Module tile is one of four sizes with its glyph at about 57%, drawn in
 * the group's fill, and hidden from assistive technology because the row or
 * header beside it already names the Module (`components/ModuleTile`).
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import { ModuleTile, moduleTile, TILE_METRICS } from './module-tile'

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten))
  return (style as Record<string, unknown> | undefined) ?? {}
}

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: { ios?: unknown }) => options.ios },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  View: ({
    children,
    importantForAccessibility,
    accessibilityElementsHidden,
    style,
  }: {
    children?: ReactNode
    importantForAccessibility?: string
    accessibilityElementsHidden?: boolean
    style?: unknown
  }) =>
    createElement(
      'div',
      {
        'data-testid': 'tile',
        'data-important-for-accessibility': importantForAccessibility,
        'data-elements-hidden': String(Boolean(accessibilityElementsHidden)),
        'data-width': String(flatten(style).width),
        'data-curve': String(flatten(style).borderCurve),
        'data-fill': String(flatten(style).backgroundColor),
      },
      children,
    ),
}))
vi.mock('../theme/appearance', () => ({
  useAppearance: () => ({ scheme: 'light' }),
}))
vi.mock('../theme/icons', () => ({ MODULE_ICONS: {} }))

const Glyph = ({ size, color }: { size: number; color: string }) =>
  createElement('i', {
    'data-testid': 'glyph',
    'data-size': String(size),
    'data-color': color,
  })

let unmount: (() => void) | undefined
afterEach(() => unmount?.())

describe('TILE_METRICS', () => {
  test('puts the glyph at about 57% of every tile', () => {
    for (const { box, glyph } of Object.values(TILE_METRICS)) {
      expect(glyph / box).toBeGreaterThan(0.52)
      expect(glyph / box).toBeLessThan(0.62)
    }
  })

  test('is the four tile sizes and nothing between them', () => {
    expect(
      Object.values(TILE_METRICS).map((metrics) => metrics.box),
    ).toEqual([20, 28, 36, 56])
  })
})

test('a tile is hidden from VoiceOver and TalkBack, with a continuous corner', () => {
  const view = mount(
    createElement(ModuleTile, {
      group: 'kitchen',
      glyph: Glyph as never,
      size: 'l',
    }),
  )
  unmount = view.unmount
  const tile = view.container.querySelector('[data-testid="tile"]')
  expect(tile?.getAttribute('data-elements-hidden')).toBe('true')
  expect(tile?.getAttribute('data-important-for-accessibility')).toBe(
    'no-hide-descendants',
  )
  expect(tile?.getAttribute('data-width')).toBe('56')
  expect(tile?.getAttribute('data-curve')).toBe('continuous')
  expect(
    view.container.querySelector('[data-testid="glyph"]')?.getAttribute(
      'data-size',
    ),
  ).toBe('30')
})

test('a past tile drops the group fill', () => {
  const now = mount(
    createElement(ModuleTile, {
      group: 'kitchen',
      glyph: Glyph as never,
      size: 's',
    }),
  )
  const fill = now.container
    .querySelector('[data-testid="tile"]')
    ?.getAttribute('data-fill')
  now.unmount()
  const past = mount(
    createElement(ModuleTile, {
      group: 'kitchen',
      glyph: Glyph as never,
      size: 's',
      past: true,
    }),
  )
  unmount = past.unmount
  expect(
    past.container
      .querySelector('[data-testid="tile"]')
      ?.getAttribute('data-fill'),
  ).not.toBe(fill)
})

test('moduleTile reads the group from the shared catalogue', () => {
  expect(moduleTile('recipes')?.group).toBe('kitchen')
  expect(moduleTile('tasks')?.group).toBe('home')
  expect(moduleTile('not-a-module')).toBeNull()
})
