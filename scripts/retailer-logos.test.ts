import fs from 'node:fs'
import path from 'node:path'
import {
  RETAILER_LOGO_MAX_BYTES,
  RETAILER_LOGO_SIZES,
  RETAILER_LOGOS,
  RETAILER_LOGOS_MAX_TOTAL_BYTES,
  RETAILERS_WITHOUT_LOGO,
  retailerLogoFileName,
} from '@gather/core/retailer-logos'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { RETAILER_CATALOG } from '../convex/lib/seed/retailerCatalog'

/**
 * The committed logo files against their manifest and budgets (APP-154). The
 * files are prepared by `prepare-retailer-logos.mjs`; this holds what it
 * produced, so a hand-edited or forgotten file fails CI.
 */

const directory = path.resolve(
  import.meta.dirname,
  '../packages/core/assets/retailer-logos',
)
const files = fs.readdirSync(directory).sort()
const logoKeys = Object.keys(RETAILER_LOGOS)
const catalogKeys = RETAILER_CATALOG.map((entry) => entry.seedKey)

describe('the manifest', () => {
  it('covers every Catalog entry exactly once', () => {
    for (const key of catalogKeys) {
      const listed = [key in RETAILER_LOGOS, key in RETAILERS_WITHOUT_LOGO]
      expect(listed.filter(Boolean), key).toHaveLength(1)
    }
    expect(
      [...logoKeys, ...Object.keys(RETAILERS_WITHOUT_LOGO)].sort(),
    ).toEqual([...catalogKeys].sort())
  })

  it('ships a logo for at least 70 retailers', () => {
    expect(logoKeys.length).toBeGreaterThanOrEqual(70)
  })

  it('says where every logo came from and under what terms', () => {
    for (const [key, source] of Object.entries(RETAILER_LOGOS)) {
      expect(source.url, key).toMatch(/^https:\/\//)
      expect(source.page, key).toMatch(/^https:\/\//)
      expect(source.licence.trim(), key).not.toBe('')
      if (source.background) expect(source.background, key).toMatch(/^#[0-9a-f]{6}$/i)
      if (source.padding !== undefined) {
        expect(source.padding, key).toBeGreaterThanOrEqual(0)
        expect(source.padding, key).toBeLessThan(0.5)
      }
    }
  })

  it('says why a retailer has no logo', () => {
    for (const [key, reason] of Object.entries(RETAILERS_WITHOUT_LOGO)) {
      expect(reason.trim(), key).not.toBe('')
    }
  })
})

describe('the files', () => {
  it('are exactly one per logo and size', () => {
    const wanted = logoKeys.flatMap((key) =>
      RETAILER_LOGO_SIZES.map((size) => retailerLogoFileName(key, size)),
    )
    expect(files).toEqual(wanted.sort())
  })

  it('each stay within the per-file budget', () => {
    for (const file of files) {
      const { size } = fs.statSync(path.join(directory, file))
      expect(size, file).toBeLessThanOrEqual(RETAILER_LOGO_MAX_BYTES)
    }
  })

  it('together stay within the total budget', () => {
    const total = files.reduce(
      (sum, file) => sum + fs.statSync(path.join(directory, file)).size,
      0,
    )
    expect(total).toBeLessThanOrEqual(RETAILER_LOGOS_MAX_TOTAL_BYTES)
  })

  it('are opaque square WebP images at their named size', async () => {
    for (const file of files) {
      const size = Number(file.match(/-(\d+)\.webp$/)?.[1])
      const meta = await sharp(path.join(directory, file)).metadata()
      expect(
        { format: meta.format, width: meta.width, height: meta.height, alpha: meta.hasAlpha },
        file,
      ).toEqual({ format: 'webp', width: size, height: size, alpha: false })
    }
  })
})
