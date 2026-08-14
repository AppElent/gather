import type { ModuleGroup } from './modules'

export type { ModuleGroup } from './modules'

export type ColorScheme = 'light' | 'dark'
export type ModuleTint = readonly [background: string, foreground: string]

export const MODULE_TINTS = {
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
} as const satisfies Record<ColorScheme, Record<ModuleGroup, ModuleTint>>
