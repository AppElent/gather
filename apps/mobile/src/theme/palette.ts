/**
 * The phone's neutral colours, light and dark (Tiles & Today, ADR-0017).
 *
 * Values are the Gather design system's `tokens.json`, verbatim. The four
 * group colours are not here: they are shared from `@gather/core/module-tints`.
 *
 * Kept free of React Native so the contrast test can read it in Node.
 */
import type { ColorScheme } from '@gather/core/module-tints'

export interface Neutrals {
  /** The screen background behind every inset list and card. */
  ground: string
  /** Inset lists, cards and pinned photo cards on `ground`. */
  surface: string
  /** Quiet fills: past rail items, assignee coins, a segmented track. */
  surface2: string
  /** Titles, body copy and every number. */
  ink: string
  /** Secondary text: captions, dates, summaries. */
  muted: string
  /** 0.5 pt separators. Decorative, never the only edge of a control. */
  hair: string
  /**
   * A stronger rule: a chart's baseline and the dashed outline of a slot
   * still to come (designs/energy, section 11). Decorative like `hair`.
   */
  hairStrong: string
  /** Due or overdue words and destructive actions; always a word. */
  danger: string
  /** Text on an `ink` fill. */
  onInk: string
}

export const NEUTRALS = {
  light: {
    ground: '#F2F3F1',
    surface: '#FFFFFF',
    surface2: '#E9EBE8',
    ink: '#1A1F1D',
    muted: '#5E6764',
    hair: '#DFE2DE',
    hairStrong: '#9AA19D',
    danger: '#A4372C',
    onInk: '#FFFFFF',
  },
  dark: {
    ground: '#0F1110',
    surface: '#1B1E1D',
    surface2: '#262A28',
    ink: '#F1F3F1',
    muted: '#A0A8A4',
    hair: '#2E3331',
    hairStrong: '#5A615E',
    danger: '#F0917F',
    onInk: '#0F1110',
  },
} as const satisfies Record<ColorScheme, Neutrals>
