/**
 * PROTOTYPE (#146) — throwaway. Delete with the rest of `proto/`.
 *
 * The palette is direction C from #144's accepted artifact, transcribed so the
 * navigation prototype does not reopen a settled look. ADR-0017's accent rule
 * is the only logic here: the accent is the colour of what you are looking at;
 * where you are looking at everything, it is ink.
 */
import { useColorScheme } from 'react-native'

export type ModuleGroup = 'kitchen' | 'money' | 'home' | 'tasting'

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

const TINTS = {
  light: {
    kitchen: ['#e2f2f0', '#2b7f86'],
    money: ['#e4efe6', '#2f6a4a'],
    home: ['#f2ece0', '#8a6a33'],
    tasting: ['#f0e6ec', '#7d3f5f'],
  },
  dark: {
    kitchen: ['#13302f', '#67cfc8'],
    money: ['#16301f', '#6ec89a'],
    home: ['#2e2718', '#d3b477'],
    tasting: ['#2c1b25', '#d693b3'],
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
  tintOf(group: ModuleGroup): { bg: string; fg: string }
}

export function useTokens(group?: ModuleGroup): Tokens {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const base = BASE[scheme]
  return {
    scheme,
    ...base,
    accent: group ? TINTS[scheme][group][1] : base.fg,
    onAccent: group ? base.surface : base.onAccent,
    tintOf: (g) => ({ bg: TINTS[scheme][g][0], fg: TINTS[scheme][g][1] }),
  }
}

export const RADIUS = { tile: 13, card: 16, control: 12 }
