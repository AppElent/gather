import type { BarcodeFormat } from '@gather/core/barcodes'
import { barcodeShape } from '@gather/core/barcodes'
import type { RenderOptions } from 'bwip-js/browser'

/**
 * How a card's barcode is drawn: bwip-js, as SVG (APP-141).
 *
 * One MIT library that covers every format in `@gather/core/barcodes` and
 * produces SVG, which the phone can draw with react-native-svg from the same
 * options (APP-142). It is ~2 MB, so it is imported on demand and only on the
 * pages that draw a barcode, never in the app shell.
 */

/** The bwip-js encoder per format. */
export const BWIP_ENCODERS: Record<BarcodeFormat, string> = {
  EAN_13: 'ean13',
  EAN_8: 'ean8',
  UPC_A: 'upca',
  UPC_E: 'upce',
  CODE_128: 'code128',
  CODE_39: 'code39',
  CODE_93: 'code93',
  CODABAR: 'rationalizedCodabar',
  ITF: 'interleaved2of5',
  QR: 'qrcode',
  PDF417: 'pdf417',
  AZTEC: 'azteccode',
  DATA_MATRIX: 'datamatrix',
}

/**
 * The render options for one card. Black on white whatever the theme, with a
 * quiet zone around it, because a till's scanner needs both. The number is
 * printed by the page under the code rather than by the encoder, so it stays
 * selectable text a cashier can read out or type.
 */
export function barcodeOptions(
  format: BarcodeFormat,
  value: string,
): RenderOptions {
  // Codabar needs start and stop characters; a number typed without them gets
  // the common `A…A` pair.
  const text =
    format === 'CODABAR' && !/^[A-D].*[A-D]$/i.test(value)
      ? `A${value}A`
      : value
  const linear = barcodeShape(format) === 'linear'
  return {
    bcid: BWIP_ENCODERS[format],
    text,
    scale: 3,
    ...(linear ? { height: 18 } : {}),
    includetext: false,
    paddingwidth: linear ? 12 : 4,
    paddingheight: 4,
    backgroundcolor: 'FFFFFF',
    barcolor: '000000',
  }
}

/** The barcode as an SVG document. Throws when bwip-js cannot encode it. */
export async function renderBarcodeSvg(
  format: BarcodeFormat,
  value: string,
): Promise<string> {
  const { toSVG } = await import('bwip-js/browser')
  return toSVG(barcodeOptions(format, value))
}

/**
 * An SVG document as an `<img>` source. An image cannot run anything inside
 * it, which is why the SVG is not injected into the page as markup.
 */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
