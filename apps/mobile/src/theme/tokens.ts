/**
 * The phone's palette, radii and accent rule (ADR-0017).
 *
 * The neutrals below are the phone's own — the web's `--app-*` tokens are
 * written in `oklch()`, which React Native's colour parser rejects outright, and
 * nothing here is a port of them anyway: the phone owns its look.
 *
 * The four group tints are shared from `@gather/core/module-tints`, so the two
 * clients cannot disagree about the catalogue's visual grouping (ADR-0017).
 */

import { MODULE_TINTS, type ModuleGroup } from '@gather/core/module-tints'
import { useColorScheme } from 'react-native'

export type { ModuleGroup }

const BASE = {
  light: {
    bg: '#faf9f7',
    surface: '#ffffff',
    tile: '#f1f2f0',
    fg: '#1f2421',
    muted: '#79807b',
    border: '#e8e7e3',
    onAccent: '#ffffff',
  },
  dark: {
    bg: '#121413',
    surface: '#1a1d1b',
    tile: '#222623',
    fg: '#eef0ed',
    muted: '#a2a8a4',
    border: '#2f3431',
    onAccent: '#121413',
  },
} as const

export interface Tokens {
  scheme: 'light' | 'dark'
  bg: string
  surface: string
  tile: string
  fg: string
  muted: string
  border: string
  /** Ink on a group-less screen; the group's tint where there is one. */
  accent: string
  onAccent: string
  danger: string
  tintOf(group: ModuleGroup): { bg: string; fg: string }
}

const DANGER = { light: '#a4372c', dark: '#f0917f' } as const

/**
 * Colours, not conditions: a call site never branches on the scheme, and never
 * learns why its accent is teal. The front door belongs to no Module, so it
 * calls this with no group and gets ink — which is the accent rule, not a
 * default.
 */
export function useTokens(group?: ModuleGroup): Tokens {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const base = BASE[scheme]
  return {
    scheme,
    ...base,
    accent: group ? MODULE_TINTS[scheme][group][1] : base.fg,
    onAccent: group ? base.surface : base.onAccent,
    danger: DANGER[scheme],
    tintOf: (g) => ({
      bg: MODULE_TINTS[scheme][g][0],
      fg: MODULE_TINTS[scheme][g][1],
    }),
  }
}

export const RADIUS = { tile: 13, card: 16, control: 12 }
