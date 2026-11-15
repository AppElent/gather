import {
  type BarcodeFormat,
  barcodeRenderOptions,
} from '@gather/core/barcodes'

/**
 * How a card's barcode is drawn on the web: bwip-js, as SVG (APP-141).
 *
 * The encoder table and options are `@gather/core/barcodes`'
 * `barcodeRenderOptions`, which the phone draws from too (APP-142), so both
 * clients put the same bars on the screen. bwip-js is ~2 MB, so it is imported
 * on demand and only on the pages that draw a barcode, never in the app shell.
 */

/** The barcode as an SVG document. Throws when bwip-js cannot encode it. */
export async function renderBarcodeSvg(
  format: BarcodeFormat,
  value: string,
): Promise<string> {
  const { toSVG } = await import('bwip-js/browser')
  return toSVG(barcodeRenderOptions(format, value))
}

/**
 * An SVG document as an `<img>` source. An image cannot run anything inside
 * it, which is why the SVG is not injected into the page as markup.
 */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
