import {
  type BarcodeFormat,
  barcodeRenderOptions,
} from '@gather/core/barcodes'

/** A drawn barcode: the SVG document and its intrinsic size. */
export interface DrawnBarcode {
  svg: string
  width: number
  height: number
}

/**
 * Draw a card's barcode as SVG, with the options the web draws with
 * (`barcodeRenderOptions` in `@gather/core/barcodes`), so the bars on the
 * phone are the bars on the web.
 *
 * `bwip-js/generic` is the library's platform-free build: its React Native
 * build pulls in a PNG encoder the phone never needs. It is ~2 MB of
 * JavaScript, so it is imported on first use rather than at launch.
 *
 * Throws when bwip-js cannot encode the value; the screen shows the number
 * instead.
 */
export async function drawCardBarcode(
  format: BarcodeFormat,
  value: string,
): Promise<DrawnBarcode> {
  const { toSVG } = await import('bwip-js/generic')
  const svg = toSVG(barcodeRenderOptions(format, value))
  const size = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  const width = Number(size?.[1])
  const height = Number(size?.[2])
  if (!(width > 0 && height > 0)) throw new Error('Barcode has no size')
  return { svg, width, height }
}
