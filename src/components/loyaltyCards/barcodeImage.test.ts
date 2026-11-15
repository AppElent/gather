import {
  BARCODE_FORMATS,
  type BarcodeFormat,
  checkCardNumber,
  MAX_CARD_NUMBER_LENGTH,
  MAX_LINEAR_CARD_NUMBER_LENGTH,
} from '@gather/core/barcodes'
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

  /**
   * The longest and oddest value the core lets through for each format, so a
   * limit there that is looser than the encoder's shows up here.
   */
  const LINEAR_MAX = MAX_LINEAR_CARD_NUMBER_LENGTH
  const EDGES: Record<BarcodeFormat, string> = {
    EAN_13: '2620187342052',
    EAN_8: '96385074',
    UPC_A: '036000291452',
    UPC_E: '01234565',
    // Alternating letters and digits makes Code 128 switch code sets, its
    // densest case.
    CODE_128: 'x1'.repeat(LINEAR_MAX / 2),
    CODE_39: '%'.repeat(LINEAR_MAX),
    CODE_93: '%'.repeat(LINEAR_MAX),
    // Typed in lower case and without start and stop letters, both of which
    // the encoder would refuse as typed.
    CODABAR: `a${'1'.repeat(LINEAR_MAX - 2)}d`,
    ITF: '1'.repeat(LINEAR_MAX),
    QR: 'é'.repeat(MAX_CARD_NUMBER_LENGTH / 2),
    // Three-byte characters are PDF417's hardest input.
    PDF417: '漢'.repeat(Math.floor(MAX_CARD_NUMBER_LENGTH / 3)),
    AZTEC: '漢'.repeat(Math.floor(MAX_CARD_NUMBER_LENGTH / 3)),
    DATA_MATRIX: '漢'.repeat(Math.floor(MAX_CARD_NUMBER_LENGTH / 3)),
  }

  test.each(BARCODE_FORMATS)(
    'draws the longest %s the core accepts',
    async (format) => {
      const check = checkCardNumber(format, EDGES[format])
      expect(check.ok).toBe(true)
      if (!check.ok) return
      const svg = await renderBarcodeSvg(format, check.value)
      expect(svg).toMatch(/^<svg/)
    },
  )

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
