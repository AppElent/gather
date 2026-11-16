/**
 * Every text colour the design system allows on a ground reaches WCAG AA
 * (4.5:1) there, in both themes.
 *
 * The pairs are the colour rules in the design system's README. `*-text` on
 * `*-wash` is deliberately absent: the rules forbid it (Kitchen light measures
 * 4.24:1), so a screen that needs group-coloured text on a wash is wrong, not
 * this test.
 */
import { MODULE_TINTS } from '@gather/core/module-tints'
import { MODULE_GROUPS } from '@gather/core/modules'
import { describe, expect, it } from 'vitest'

import { NEUTRALS } from './palette'

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const [r, g, b] = channels as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}

type Pair = [label: string, text: string, ground: string]

function pairs(scheme: 'light' | 'dark'): Pair[] {
  const n = NEUTRALS[scheme]
  const tints = MODULE_TINTS[scheme]
  const grounds: [string, string][] = [
    ['ground', n.ground],
    ['surface', n.surface],
    ['surface-2', n.surface2],
    ...MODULE_GROUPS.map((g): [string, string] => [
      `${g}-wash`,
      tints[g].wash,
    ]),
  ]
  return [
    ...grounds.flatMap(([name, ground]): Pair[] => [
      [`ink on ${name}`, n.ink, ground],
      [`muted on ${name}`, n.muted, ground],
    ]),
    ...MODULE_GROUPS.flatMap((g): Pair[] => [
      [`${g}-text on ground`, tints[g].text, n.ground],
      [`${g}-text on surface`, tints[g].text, n.surface],
      [`${g}-on on ${g}-fill`, tints[g].on, tints[g].fill],
    ]),
    ['danger on ground', n.danger, n.ground],
    ['danger on surface', n.danger, n.surface],
    ['on-ink on ink', n.onInk, n.ink],
    // The destructive button and swipe action: the design system has no
    // on-danger token, so the label is on-ink, which clears AA on danger.
    ['on-ink on danger', n.onInk, n.danger],
  ]
}

describe.each(['light', 'dark'] as const)('%s theme contrast', (scheme) => {
  it.each(pairs(scheme))('%s reaches 4.5:1', (_label, text, ground) => {
    expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the forbidden pair stays forbidden', () => {
  it('kitchen-text on kitchen-wash is under 4.5:1 in light, which is why no screen may use it', () => {
    const k = MODULE_TINTS.light.kitchen
    expect(contrast(k.text, k.wash)).toBeLessThan(4.5)
  })
})
