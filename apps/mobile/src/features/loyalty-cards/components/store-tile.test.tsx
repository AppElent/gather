// @vitest-environment jsdom
/**
 * The phone's store tile picks the logo or the monogram the way the web's
 * does (APP-159): a Catalog key with a shipped logo shows it; a custom store,
 * a dangling Provenance, a Catalog entry without a logo, or a file that fails
 * to load shows the monogram.
 */
import { act, createElement, type ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { mount } from '../../../testing/dom'
import { StoreTile } from './store-tile'

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten))
  return (style as Record<string, unknown> | undefined) ?? {}
}

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  // Keeps what the tile promises: hidden from screen readers, and the edge
  // colour of a logo tile.
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
        'data-border-color': flatten(style).borderColor,
      },
      children,
    ),
  Text: ({ children }: { children?: ReactNode }) =>
    createElement('span', { 'data-testid': 'monogram' }, children),
}))
vi.mock('expo-image', () => ({
  Image: ({
    source,
    recyclingKey,
    onError,
  }: {
    source: number
    recyclingKey: string
    onError: () => void
  }) =>
    createElement('img', {
      'data-testid': 'logo',
      'data-source': String(source),
      'data-recycling-key': recyclingKey,
      onError,
    }),
}))
vi.mock('../../../theme/tokens', () => ({
  RADIUS: { tileM: 11, tileL: 17 },
  SIZE: { tileM: 36, tileL: 56 },
  TYPE: { title2: {}, bodyStrong: {} },
  useTokens: () => ({ hair: '#DFE2DE' }),
}))
// Stands in for the generated list, whose `require`s only Metro can load.
vi.mock('./retailer-logo-files', () => ({
  RETAILER_LOGO_FILES: { 'albert-heijn': 101, jumbo: 102 },
}))

let mounted: ReturnType<typeof mount> | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

function render(catalogKey?: string) {
  mounted = mount(<StoreTile name="Albert Heijn" catalogKey={catalogKey} />)
  return mounted
}

const logo = () => document.querySelector('[data-testid="logo"]')
const monogram = () => document.querySelector('[data-testid="monogram"]')
const tile = () => document.querySelector('[data-testid="tile"]')

function expectHiddenFromScreenReaders() {
  expect(tile()?.getAttribute('data-important-for-accessibility')).toBe(
    'no-hide-descendants',
  )
  expect(tile()?.getAttribute('data-elements-hidden')).toBe('true')
}

test('a Catalog store with a shipped logo shows it', () => {
  render('albert-heijn')
  expect(logo()?.getAttribute('data-source')).toBe('101')
  expect(logo()?.getAttribute('data-recycling-key')).toBe('albert-heijn')
  expect(tile()?.getAttribute('data-border-color')).toBe('#DFE2DE')
  expect(monogram()).toBeNull()
  expectHiddenFromScreenReaders()
})

test('a shipped logo missing from the generated list keeps the monogram', () => {
  // `lidl` ships a logo, but the mocked list leaves it out.
  render('lidl')
  expect(logo()).toBeNull()
  expect(monogram()?.textContent).toBe('AH')
  expectHiddenFromScreenReaders()
})

test('a custom store, a dangling Provenance or a logo-less entry keeps the monogram', () => {
  for (const key of [undefined, 'a-store-that-closed', 'intratuin', 'constructor']) {
    render(key)
    expect(logo(), String(key)).toBeNull()
    expect(monogram()?.textContent, String(key)).toBe('AH')
    mounted?.unmount()
    mounted = null
  }
})

test('a logo that fails to load falls back to the monogram', () => {
  render('albert-heijn')
  act(() => {
    logo()?.dispatchEvent(new Event('error'))
  })
  expect(logo()).toBeNull()
  expect(monogram()?.textContent).toBe('AH')
})

test("a failed logo does not hide the next store's", () => {
  const { rerender } = render('albert-heijn')
  act(() => {
    logo()?.dispatchEvent(new Event('error'))
  })
  rerender(<StoreTile name="Jumbo" catalogKey="jumbo" />)
  expect(logo()?.getAttribute('data-source')).toBe('102')
})
