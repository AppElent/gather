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

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 0.5 },
  View: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'tile' }, children),
  Text: ({ children }: { children?: ReactNode }) =>
    createElement('span', { 'data-testid': 'monogram' }, children),
}))
vi.mock('expo-image', () => ({
  Image: ({
    source,
    onError,
  }: {
    source: number
    onError: () => void
  }) =>
    createElement('img', {
      'data-testid': 'logo',
      'data-source': String(source),
      onError,
    }),
}))
vi.mock('../../../theme/tokens', () => ({
  RADIUS: { tile: 13 },
  TYPE: { title: {}, lead: {} },
  useTokens: () => ({ border: '#e8e7e3' }),
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

test('a Catalog store with a shipped logo shows it', () => {
  render('albert-heijn')
  expect(logo()?.getAttribute('data-source')).toBe('101')
  expect(monogram()).toBeNull()
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
