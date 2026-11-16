/**
 * Whether the reader has chosen one of the accessibility text sizes (AX1 and
 * up), from React Native's `fontScale`.
 *
 * iOS steps body text 17 → 19 → 21 → 23 pt through XL, XXL and XXXL (a scale
 * of at most about 1.35), and AX1 is 28 pt (about 1.65). The line between
 * them is where a horizontal layout of large text has to stack instead.
 */
export const ACCESSIBILITY_TEXT_SCALE = 1.5

export function isAccessibilityTextSize(fontScale: number): boolean {
  return fontScale >= ACCESSIBILITY_TEXT_SCALE
}
