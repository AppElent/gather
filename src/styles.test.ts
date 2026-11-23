import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_TINTS } from '@gather/core/module-tints'
import { MODULE_GROUPS } from '@gather/core/modules'
import { describe, expect, test } from 'vitest'
import { NEUTRALS } from '../apps/mobile/src/theme/palette'

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
 * old `--app-*` tokens once lived only in the first, so the sign-in pages
 * stayed light for everyone whose phone or laptop was in dark mode.
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

/** The custom properties a rule head declares, in source order. */
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

const LIGHT = ':root {\n  --ground'
const AUTH = ':root {\n  --auth-bg'
const DARK_CHOICE = ':root[data-theme="dark"] {'
const DARK_SYSTEM = ':root:not([data-theme="light"]) {'

/** Every token a theme resolves to, with `var()` chains followed to a hex. */
function theme(scheme: 'light' | 'dark'): Record<string, string> {
  const raw = {
    ...block(LIGHT),
    ...block(AUTH),
    ...(scheme === 'dark' ? block(DARK_CHOICE) : {}),
  }
  const resolve = (value: string, depth = 0): string => {
    const ref = value.match(/^var\((--[\w-]+)\)$/)?.[1]
    // Radii and fonts live in `@theme`; only colours need resolving.
    if (!ref || raw[ref] === undefined) return value
    expect(depth).toBeLessThan(8)
    return resolve(raw[ref], depth + 1)
  }
  return Object.fromEntries(
    Object.entries(raw).map(([name, value]) => [name, resolve(value)]),
  )
}

const kebab = (name: string) => name.replace(/[A-Z0-9]/g, (c) => `-${c}`.toLowerCase())

/**
 * The web wears the phone's tokens (APP-637): the neutrals from the phone's
 * palette and the four group tints from `@gather/core`. Both clients read the
 * same values, so a change on one side that misses the other fails here.
 */
describe('tokens shared with the phone', () => {
  const expected = (scheme: 'light' | 'dark') => {
    const tokens: Record<string, string> = {}
    for (const [name, value] of Object.entries(NEUTRALS[scheme]))
      tokens[`--${kebab(name)}`] = value.toLowerCase()
    for (const group of MODULE_GROUPS)
      for (const [part, value] of Object.entries(MODULE_TINTS[scheme][group]))
        tokens[`--${group}-${part}`] = value.toLowerCase()
    return tokens
  }

  test.each([
    ['light', LIGHT],
    ['dark, chosen', DARK_CHOICE],
    ['dark, from the system', DARK_SYSTEM],
  ] as const)('%s equals the phone', (label, head) => {
    const declared = block(head)
    const want = expected(label === 'light' ? 'light' : 'dark')
    for (const [name, value] of Object.entries(want))
      expect(declared[name]?.toLowerCase(), name).toBe(value)
  })
})

/**
 * The two older web looks are gone: the sea/lagoon palette with its hero
 * gradients, grid backdrop and Fraunces display face, and the `--app-*` shell
 * with its blue accent and Manrope. Nothing may bring them back, in the
 * stylesheet or in a component (APP-637, APP-597).
 */
describe('the older looks stay gone', () => {
  const retired = [
    /--sea-ink/,
    /--lagoon/,
    /--palm\b/,
    /--sand\b/,
    /--foam\b/,
    /--hero-[ab]\b/,
    /--bg-base\b/,
    /--app-[a-z]/,
    /Fraunces/,
    /Manrope/,
    /fonts\.googleapis/,
    /#246f76/i,
    /demo-(panel|card)/,
    /island-shell/,
  ]

  test('the stylesheet has no gradients, grid backdrop or retired tokens', () => {
    expect(css).not.toMatch(/gradient\(/)
    expect(css).not.toMatch(/body::(before|after)/)
    for (const pattern of retired) expect(css).not.toMatch(pattern)
  })

  test('no component names a retired token or colour', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const text = readFileSync(path, 'utf8')
          for (const pattern of retired)
            if (pattern.test(text)) offenders.push(`${path}: ${pattern}`)
        }
      }
    }
    // MCP views render in the host's frame with their own palette.
    for (const dir of ['components', 'lib', 'routes'])
      walk(join(__dirname, dir))
    expect(offenders.filter((o) => !o.includes(join('lib', 'mcp', 'views')))).toEqual([])
  })
})

const rgb = (hex: string) => {
  expect(hex, hex).toMatch(/^#[0-9a-f]{6}$/i)
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
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

/**
 * The auth screens: text at 4.5:1 (WCAG 1.4.3) and the edges of cards, fields
 * and buttons at 3:1 (WCAG 1.4.11), on the page, the card and a field, in both
 * themes. The primary button's label keeps 4.5:1 also at `hover:opacity-90`
 * over the card (APP-578).
 */
describe('auth contrast', () => {
  test.each(['light', 'dark'] as const)('%s', (scheme) => {
    const t = theme(scheme)
    const grounds = ['--auth-bg', '--auth-card-bg', '--auth-field-bg']
    for (const fg of ['--auth-fg', '--auth-muted', '--auth-error'])
      for (const bg of grounds)
        expect(ratio(rgb(t[fg]), rgb(t[bg])), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    for (const bg of grounds)
      expect(ratio(rgb(t['--auth-border']), rgb(t[bg])), `border on ${bg}`).toBeGreaterThanOrEqual(3)
    expect(ratio(rgb(t['--auth-fg']), rgb(t['--auth-hover-bg'])), 'fg on hover').toBeGreaterThanOrEqual(4.5)
    const fill = rgb(t['--auth-accent'])
    const label = rgb(t['--auth-accent-fg'])
    expect(ratio(fill, label)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(over(fill, rgb(t['--auth-card-bg']), 0.9), label)).toBeGreaterThanOrEqual(4.5)
  })
})

/**
 * Links are body-size text, so they need 4.5:1 on every ground they sit on
 * (APP-595): `ink` outside a Module, the group's `text` inside one. Primary
 * buttons put `on` over `fill`, and neutral ones `on-ink` over `ink`.
 */
describe('link and action contrast', () => {
  const linkToken = css.match(/\ba\s*\{[^}]*?color:\s*var\((--[\w-]+)\)/)?.[1]

  test('links take the accent text, which is ink by default', () => {
    expect(linkToken).toBe('--accent-text')
    expect(block(LIGHT)['--accent-text']).toBe('var(--ink)')
    for (const group of MODULE_GROUPS)
      expect(css).toMatch(
        new RegExp(`\\[data-group="${group}"\\]\\s*\\{[^}]*--accent-text:\\s*var\\(--${group}-text\\)`),
      )
  })

  test.each(['light', 'dark'] as const)('%s text stays above 4.5:1', (scheme) => {
    const t = theme(scheme)
    const grounds = ['--ground', '--surface', '--surface-2']
    for (const fg of ['--ink', '--muted', '--danger'])
      for (const bg of grounds)
        expect(ratio(rgb(t[fg]), rgb(t[bg])), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    for (const group of MODULE_GROUPS) {
      for (const bg of ['--ground', '--surface'])
        expect(ratio(rgb(t[`--${group}-text`]), rgb(t[bg])), `${group} text on ${bg}`).toBeGreaterThanOrEqual(4.5)
      expect(ratio(rgb(t[`--${group}-on`]), rgb(t[`--${group}-fill`])), `${group} on fill`).toBeGreaterThanOrEqual(4.5)
    }
    expect(ratio(rgb(t['--on-ink']), rgb(t['--ink']))).toBeGreaterThanOrEqual(4.5)
  })
})
