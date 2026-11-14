import { BARCODE_FORMATS, type BarcodeFormat } from '@gather/core/barcodes'
import { describe, expect, test } from 'vitest'
import { barcodeOptions, renderBarcodeSvg, svgDataUrl } from './barcodeImage'

/**
 * Every format the core accepts must draw, through the real bwip-js, so a card
 * Convex let through never shows "could not draw" at the till.
 */
const SAMPLES: Record<BarcodeFormat, string> = {
  EAN_13: '2620187342052',
  EAN_8: '96385074',
  UPC_A: '036000291452',
  UPC_E: '01234565',
  CODE_128: 'Ab-12 #x',
  CODE_39: 'DG-4217',
  CODE_93: 'DG-4217',
  CODABAR: '12345-$',
  ITF: '123456',
  QR: 'https://example.nl/kaart?id=1',
  PDF417: '2620187342052',
  AZTEC: '2620187342052',
  DATA_MATRIX: '2620187342052',
}

describe('drawing a barcode', () => {
  test.each(BARCODE_FORMATS)('draws %s as SVG', async (format) => {
    const svg = await renderBarcodeSvg(format, SAMPLES[format])
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/)
  })

  test('draws black on white with no printed text, whatever the theme', () => {
    expect(barcodeOptions('EAN_13', '2620187342052')).toMatchObject({
      bcid: 'ean13',
      backgroundcolor: 'FFFFFF',
      barcolor: '000000',
      includetext: false,
    })
  })

  test('gives Codabar start and stop characters only when it has none', () => {
    expect(barcodeOptions('CODABAR', '12345').text).toBe('A12345A')
    expect(barcodeOptions('CODABAR', 'B12345C').text).toBe('B12345C')
  })

  test('refuses a number its encoder cannot draw', async () => {
    await expect(renderBarcodeSvg('EAN_13', 'not a number')).rejects.toThrow()
  })

  test('wraps SVG as an image source, not as markup', () => {
    expect(svgDataUrl('<svg a="1"/>')).toBe(
      'data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%221%22%2F%3E',
    )
  })
})
