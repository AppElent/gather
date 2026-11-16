import type { ModuleGroup } from './modules'

export type { ModuleGroup } from './modules'

export type ColorScheme = 'light' | 'dark'

/**
 * A Module group's four colours in one theme (Tiles & Today).
 *
 * - `fill` is the tile: the glyph squircle, a photo-less pinned card, the
 *   Module's primary button. Never a row, a list, a screen or the tab bar.
 * - `on` is the glyph or label on `fill`.
 * - `text` is group-coloured text or a check ring on the screen ground or a
 *   surface. Never on `wash`.
 * - `wash` is the soft ground behind a Module screen's large title and the Now
 *   card. It carries the neutral ink and muted text only.
 */
export interface ModuleTint {
  fill: string
  on: string
  text: string
  wash: string
}

export const MODULE_TINTS = {
  light: {
    kitchen: {
      fill: '#0B7C75',
      on: '#FFFFFF',
      text: '#0B7C75',
      wash: '#DDEFEC',
    },
    home: { fill: '#F2B233', on: '#2B1F06', text: '#8A5C08', wash: '#FBEBC6' },
    tasting: {
      fill: '#8A2D5A',
      on: '#FFFFFF',
      text: '#8A2D5A',
      wash: '#F1DFE8',
    },
    money: { fill: '#2F6BD8', on: '#FFFFFF', text: '#2459BD', wash: '#E1EAFB' },
  },
  dark: {
    kitchen: {
      fill: '#0B7C75',
      on: '#FFFFFF',
      text: '#6FD6CD',
      wash: '#133230',
    },
    home: { fill: '#D99B2B', on: '#2B1F06', text: '#F2C060', wash: '#2E2611' },
    tasting: {
      fill: '#B4487F',
      on: '#FFFFFF',
      text: '#E59AC0',
      wash: '#2E1A25',
    },
    money: { fill: '#2F6BD8', on: '#FFFFFF', text: '#8FB4F5', wash: '#16223A' },
  },
} as const satisfies Record<ColorScheme, Record<ModuleGroup, ModuleTint>>
