import {
  BARCODE_FORMATS,
  type BarcodeFormat,
  barcodeRenderOptions,
} from '@gather/core/barcodes'
import { toSVG as browserToSVG } from 'bwip-js/browser'
import { describe, expect, test } from 'vitest'

import { drawCardBarcode } from './card-barcode-svg'

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

describe('drawCardBarcode', () => {
  test.each(BARCODE_FORMATS)(
    'draws %s exactly as the web does',
    async (format) => {
      const drawn = await drawCardBarcode(format, SAMPLES[format])
      expect(drawn.svg).toBe(
        browserToSVG(barcodeRenderOptions(format, SAMPLES[format])),
      )
      expect(drawn.width).toBeGreaterThan(0)
      expect(drawn.height).toBeGreaterThan(0)
    },
  )

  test('draws linear codes wider than tall and matrix codes square', async () => {
    const ean = await drawCardBarcode('EAN_13', SAMPLES.EAN_13)
    const qr = await drawCardBarcode('QR', SAMPLES.QR)
    expect(ean.width).toBeGreaterThan(ean.height)
    expect(qr.width).toBe(qr.height)
  })

  test('refuses a number its encoder cannot draw', async () => {
    await expect(drawCardBarcode('EAN_13', 'not a number')).rejects.toThrow()
  })
})
