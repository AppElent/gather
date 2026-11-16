/**
 * The phone's design tokens: colour, type, space, radii and sizes
 * (Tiles & Today, ADR-0017).
 *
 * Every value is the Gather design system's `tokens.json`. Do not add one in
 * between: a size or colour the system does not have is a design decision,
 * not a call-site fix. The neutrals live in `./palette` and the four group
 * colours in `@gather/core/module-tints`, so both clients agree on the groups.
 *
 * The mockup-only tokens (`glass*`, `tab-selected`, `tab-label`) are not
 * here: the platform draws that chrome, and the app never paints it.
 */
import {
  MODULE_TINTS,
  type ModuleGroup,
  type ModuleTint,
} from '@gather/core/module-tints'
import { Platform, type TextStyle } from 'react-native'

import { useAppearance } from './appearance'
import { NEUTRALS, type Neutrals } from './palette'

export type { ModuleGroup, ModuleTint }

export interface Tokens extends Neutrals {
  scheme: 'light' | 'dark'
  /**
   * The fill of this screen's primary button: the group's `fill` on a Module
   * screen, `ink` where the screen belongs to no Module (ADR-0017's accent
   * rule). Never a row, a list or the tab bar.
   */
  accent: string
  /** The label and glyph on `accent`. */
  onAccent: string
  /**
   * Group-coloured text on `ground` or `surface`: a check ring, a record's
   * eyebrow, a text button. `ink` where the screen belongs to no Module.
   * Never on a wash.
   */
  accentText: string
  /** A group's four colours, for a tile that is not this screen's group. */
  tintOf(group: ModuleGroup): ModuleTint
}

/**
 * Colours, not conditions: a call site never branches on the scheme, and never
 * learns why its accent is teal. The front door belongs to no Module, so it
 * calls this with no group and gets ink — which is the accent rule, not a
 * default.
 *
 * The scheme comes from `useAppearance()` rather than from `useColorScheme()`
 * directly, because the device is only one of the two things that can decide
 * it: a Member who chose dark on a light phone is in dark everywhere,
 * and a call site must not be able to reach past that choice to the device's.
 */
export function useTokens(group?: ModuleGroup): Tokens {
  const { scheme } = useAppearance()
  const neutrals = NEUTRALS[scheme]
  const tints = MODULE_TINTS[scheme]
  const tint = group ? tints[group] : null
  return {
    scheme,
    ...neutrals,
    accent: tint ? tint.fill : neutrals.ink,
    onAccent: tint ? tint.on : neutrals.onInk,
    accentText: tint ? tint.text : neutrals.ink,
    tintOf: (g) => tints[g],
  }
}

/** `space-1` … `space-6`. The screen gutter is `SPACE[4]`. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 } as const

export const RADIUS = {
  /** The 20 pt eyebrow tile on a record. */
  tileXs: 6,
  /** The 28 pt tile on rail and list rows. */
  tileS: 9,
  /** The 36 pt tile on the Now card. */
  tileM: 11,
  /** The 56 pt tile under a Module screen's large title. */
  tileL: 17,
  /** A 46 pt photo thumbnail. */
  thumb: 13,
  /** Inset lists, cards, the Completed row. */
  card: 22,
  /** The Now card. */
  now: 26,
  /** Buttons, capsules, coins, segmented controls. */
  pill: 999,
} as const

/** Fixed sizes. Tiles are squircles: give them `borderCurve: 'continuous'`. */
export const SIZE = {
  tileXs: 20,
  tileS: 28,
  tileM: 36,
  tileL: 56,
  /**
   * A photo thumbnail beside a row (`radius-thumb`'s "46 pt photo
   * thumbnail"). A photo-less row centres its `tile-s` in the same column.
   */
  thumb: 46,
  /** The minimum height of every control; smaller visuals get hitSlop 12. */
  hitMin: 44,
  /** The minimum height of an inset-list row. */
  rowMin: 52,
  pinnedWidth: 128,
  pinnedMinHeight: 160,
} as const

/**
 * SF Pro Rounded on iOS (`ui-rounded` selects the system font's rounded
 * design). Android has no system rounded face, so it falls back to its own
 * sans-serif honestly rather than bundling a lookalike.
 */
const ROUNDED = Platform.select<TextStyle>({
  ios: { fontFamily: 'ui-rounded' },
  default: {},
})

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] }

/**
 * The text styles. Screens use these, never a literal `fontSize`
 * (`scripts/check-mobile-structure.mjs`).
 *
 * Every style scales with Dynamic Type: `allowFontScaling` stays on, and React
 * Native scales `lineHeight` with the font. `numeralXl` takes
 * `maxFontSizeMultiplier={NUMERAL_XL_MAX_SCALE}` at its call site and wraps
 * rather than truncating. A number that changes or lines up adds `TABULAR`
 * (`numeralXl` and `numeralL` already have it).
 *
 * `large-title` is not here: the native header draws it, never content.
 */
export const TYPE = {
  /** The one in-content title: a record with a photo, under the photo. */
  recordTitle: {
    ...ROUNDED,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
  /** Section headings. */
  title2: { ...ROUNDED, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  /** The label on a photo-less pinned card, on the group fill. */
  cardLabel: { ...ROUNDED, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  /** The one fact on the Now card. */
  numeralXl: {
    ...ROUNDED,
    ...TABULAR,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
  },
  /** Values in a facts strip. */
  numeralL: {
    ...ROUNDED,
    ...TABULAR,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  /** Row titles, ingredient names, field text. */
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  /** Button labels, quantities, an emphasised row title. */
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  /** The summary under a title, captions. */
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  /** Row subtitles, units, times. */
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Group labels inside a section, a record's eyebrow. */
  footnoteStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>

export { TABULAR }

export const NUMERAL_XL_MAX_SCALE = 1.5
