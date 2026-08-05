import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * The app icons are generated, not authored, and nothing at build time notices
 * when one goes missing.
 *
 * `public/favicon.svg` and `public/maskable.svg` are the sources; every PNG and
 * the `.ico` are produced from them by `scripts/generate-icons.mjs` and
 * committed. That means the manifest, the `<head>` links and the files on disk
 * are three lists kept in agreement by hand — rename an icon and the only
 * symptom is a blank tab, or a PWA install prompt that quietly refuses. The
 * previous set drifted exactly this way: `logo192.png` and `logo512.png` sat in
 * `public/` for months after the `manifest.json` that referenced them was
 * deleted.
 *
 * The `.ico` container is checked structurally because it is hand-packed. Node
 * has no ICO decoder, so a malformed directory entry would round-trip through
 * the generator and the build without complaint, and only fail in a browser.
 */

const publicDir = join(__dirname, '..', 'public')
const root = readFileSync(join(__dirname, 'routes', '__root.tsx'), 'utf8')

interface Manifest {
  icons: { src: string; sizes: string; type: string; purpose?: string }[]
  theme_color: string
  background_color: string
}

const manifest: Manifest = JSON.parse(
  readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'),
)

/** Every root-relative asset path referenced by the root route's `links`. */
function headAssetPaths(): string[] {
  const links = root.match(/links:\s*\[([\s\S]*?)\n {4}\],/)?.[1] ?? ''
  return [...links.matchAll(/href:\s*'(\/[^']+)'/g)].map((m) => m[1])
}

describe('app icons', () => {
  test('every manifest icon exists on disk', () => {
    expect(manifest.icons.length).toBeGreaterThan(0)
    for (const icon of manifest.icons) {
      expect(
        existsSync(join(publicDir, icon.src)),
        `${icon.src} is in the manifest but not in public/`,
      ).toBe(true)
    }
  })

  test('every icon the root route links to exists on disk', () => {
    const paths = headAssetPaths()
    expect(paths).toContain('/favicon.ico')
    expect(paths).toContain('/favicon.svg')
    expect(paths).toContain('/apple-touch-icon.png')
    for (const path of paths) {
      expect(
        existsSync(join(publicDir, path)),
        `${path} is linked from __root.tsx but not in public/`,
      ).toBe(true)
    }
  })

  test('the generated sources are still there to regenerate from', () => {
    for (const svg of ['favicon.svg', 'maskable.svg']) {
      expect(existsSync(join(publicDir, svg)), `${svg} is missing`).toBe(true)
    }
  })

  test('favicon.ico is a well-formed multi-size PNG icon', () => {
    const ico = readFileSync(join(publicDir, 'favicon.ico'))
    expect(ico.readUInt16LE(0)).toBe(0) // reserved
    expect(ico.readUInt16LE(2)).toBe(1) // 1 = icon, not cursor

    const count = ico.readUInt16LE(4)
    expect(count).toBe(3)

    const declared: number[] = []
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16
      const width = ico.readUInt8(entry) || 256
      const length = ico.readUInt32LE(entry + 8)
      const offset = ico.readUInt32LE(entry + 12)

      expect(offset + length).toBeLessThanOrEqual(ico.length)
      expect(ico.readUInt8(entry + 1) || 256).toBe(width) // square

      const png = ico.subarray(offset, offset + length)
      expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
      // IHDR width lives at byte 16 and must agree with the directory entry.
      expect(png.readUInt32BE(16)).toBe(width)
      declared.push(width)
    }
    expect(declared).toEqual([16, 32, 48])
  })

  test('apple-touch-icon is opaque', () => {
    // iOS ignores alpha and paints transparency black, so this one is rendered
    // from the full-bleed maskable source rather than the rounded tile.
    const png = readFileSync(join(publicDir, 'apple-touch-icon.png'))
    const colourType = png.readUInt8(25) // IHDR colour type
    expect([0, 2]).toContain(colourType) // greyscale or truecolour, no alpha
  })

  test('the manifest colours match the app background tokens', () => {
    expect(manifest.theme_color).toBe('#e7f3ec')
    expect(manifest.background_color).toBe('#e7f3ec')
  })

  test('both theme-color metas survive the head manager', () => {
    // They live in RootDocument's `<head>`, not the route's `head.meta`: the
    // router dedupes meta by `name`, so putting both there rendered only the
    // dark one and left light-scheme chrome with no colour at all.
    expect(root).not.toMatch(/meta:[\s\S]*?'theme-color'/)
    for (const [scheme, colour] of [
      ['light', '#e7f3ec'],
      ['dark', '#0a1418'],
    ]) {
      expect(root).toMatch(
        new RegExp(
          `media="\\(prefers-color-scheme: ${scheme}\\)"\\s*content="${colour}"`,
        ),
      )
    }
  })
})
