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
    // `@appelent/auth/tokens.css`, which is imported unlayered itself.
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
