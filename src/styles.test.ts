import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * The app's own CSS has to stay inside a cascade layer.
 *
 * `@import "tailwindcss"` puts every Tailwind rule in a layer, and unlayered
 * CSS beats layered CSS outright — specificity is never consulted. So a single
 * top-level `.shell-icon-button { display: inline-grid }` was enough to defeat
 * `md:hidden` on the topbar's hamburger, leaving a control on screen at desktop
 * width that opened a drawer the same breakpoint had already hidden. Nothing
 * about that is visible in the component: the class is there, the utility is
 * there, and the utility silently loses.
 *
 * The failure is quiet enough that it went unnoticed through a whole rebuild,
 * and re-arming it costs one rule written a line too far left. This is the
 * cheap guard against that.
 */

const css = readFileSync(join(__dirname, 'styles.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** Every rule head at depth 0 — what the browser sees as unlayered. */
function topLevelHeads(): string[] {
  const heads: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '{') {
      if (depth === 0) heads.push(css.slice(start, i).trim())
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) start = i + 1
    } else if (c === ';' && depth === 0) {
      start = i + 1
    }
  }
  return heads.filter(Boolean)
}

describe('cascade layers', () => {
  test('no class rule is left unlayered', () => {
    const unlayered = topLevelHeads().filter((head) => head.includes('.'))
    expect(unlayered).toEqual([])
  })

  test('only layers, at-rules and :root live at the top level', () => {
    // `:root` custom properties stay unlayered on purpose — they override
    // `lib/auth/tokens.css`, which is imported unlayered itself.
    const unexpected = topLevelHeads().filter(
      (head) =>
        !/^(@layer|@media|@supports|@keyframes|@theme|:root)/.test(head),
    )
    expect(unexpected).toEqual([])
  })

  test('the layers used are ones Tailwind orders before its utilities', () => {
    const layers = topLevelHeads()
      .filter((head) => head.startsWith('@layer'))
      .map((head) => head.replace('@layer', '').trim())
    expect(layers.length).toBeGreaterThan(0)
    for (const layer of layers) expect(['base', 'components']).toContain(layer)
  })
})

/**
 * Dark mode has two triggers: `data-theme="dark"` (an explicit choice) and the
 * system setting while the choice is "auto", which removes `data-theme`. Both
 * blocks must set the same tokens, or "auto" leaves some of them light: the
 * `--app-*` tokens once lived only in the first, so the sign-in pages stayed
 * light for everyone whose phone or laptop was in dark mode.
 */
describe('dark mode', () => {
  function tokens(head: string): string[] {
    const at = css.indexOf(head)
    expect(at, head).toBeGreaterThan(-1)
    const body = css.slice(at, css.indexOf('}', at))
    return [...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).sort()
  }

  test('the system setting sets every token an explicit choice does', () => {
    expect(tokens(':root:not([data-theme="light"]) {')).toEqual(
      tokens(':root[data-theme="dark"] {'),
    )
  })
})

/**
 * The primary auth buttons fill with `--auth-accent` and label with
 * `--auth-accent-fg`. `--lagoon-deep` gave the light label 3.6:1, below WCAG
 * AA, and `hover:opacity-90` lowers it further over the white card. Check both
 * themes, at rest and at hover, against 4.5:1 (APP-578).
 */
describe('auth button contrast', () => {
  function block(head: string): Record<string, string> {
    const at = css.indexOf(head)
    expect(at, head).toBeGreaterThan(-1)
    const body = css.slice(at, css.indexOf('}', at))
    return Object.fromEntries(
      [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
        m[1],
        m[2].trim(),
      ]),
    )
  }

  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const luminance = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const over = (fg: number[], bg: number[], alpha: number) =>
    fg.map((v, i) => v * alpha + bg[i] * (1 - alpha))

  const auth = block(':root {\n  --auth-bg')
  const fill = auth['--auth-accent'].match(/var\((--[\w-]+)\)/)?.[1]
  const label = auth['--auth-accent-fg'].match(/var\((--[\w-]+)\)/)?.[1]

  test.each([
    ['light', ':root {\n  --app-bg', [255, 255, 255]],
    ['dark', ':root[data-theme="dark"] {', [15, 27, 31]],
  ] as const)('%s labels stay above 4.5:1, also at hover', (_, head, card) => {
    const theme = { ...block(':root {\n  --app-bg'), ...block(head) }
    expect(fill && label).toBeTruthy()
    const bg = rgb(theme[fill as string])
    const fg = rgb(theme[label as string])
    expect(ratio(bg, fg)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(over(bg, [...card], 0.9), fg)).toBeGreaterThanOrEqual(4.5)
  })
})

/**
 * Links use the `a { color }` token as body-size text, so they need 4.5:1 on
 * every light background they sit on: the page, `--surface` cards and
 * `--surface-strong` cards. `--lagoon-deep` gave 3.3:1 on the page (APP-595).
 */
describe('link contrast', () => {
  function block(head: string): Record<string, string> {
    const at = css.indexOf(head)
    expect(at, head).toBeGreaterThan(-1)
    const body = css.slice(at, css.indexOf('}', at))
    return Object.fromEntries(
      [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
        m[1],
        m[2].trim(),
      ]),
    )
  }

  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const rgba = (value: string) => {
    const [r, g, b, a] = (value.match(/[\d.]+/g) ?? []).map(Number)
    return { color: [r, g, b], alpha: a }
  }
  const luminance = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const over = (fg: number[], bg: number[], alpha: number) =>
    fg.map((v, i) => v * alpha + bg[i] * (1 - alpha))

  const linkRule = css.match(/\ba\s*\{[^}]*?color:\s*var\((--[\w-]+)\)/)
  const token = linkRule?.[1]

  test.each([
    ['light', ':root {\n  --app-bg'],
    ['dark', ':root[data-theme="dark"] {'],
  ] as const)('%s links stay above 4.5:1 on page and cards', (_, head) => {
    expect(token).toBeTruthy()
    const theme = { ...block(':root {\n  --app-bg'), ...block(head) }
    const fg = rgb(theme[token as string])
    const page = rgb(theme['--bg-base'])
    expect(ratio(fg, page)).toBeGreaterThanOrEqual(4.5)
    for (const name of ['--surface', '--surface-strong']) {
      const { color, alpha } = rgba(theme[name])
      expect(ratio(fg, over(color, page, alpha)), name).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })
})
