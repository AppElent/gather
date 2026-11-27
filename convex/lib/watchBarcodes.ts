/**
 * A Loyalty card's barcode as a watch draws it (APP-653): bars or modules, not
 * an image, so the watch can fit them to its own pixels. Encoded with the
 * options the phone and the web draw with (`@gather/core/barcodes`), through
 * `bwip-js/generic`, which runs in the default Convex runtime.
 *
 * Everything is in modules. Guard bars of the EAN and UPC formats come out
 * flat: the options leave the digits out, and bwip-js only lengthens guards
 * around printed digits.
 */
import {
  type BarcodeFormat,
  barcodeRenderOptions,
  barcodeShape,
} from '@gather/core/barcodes'
import bwipjs from 'bwip-js/generic'

/** Bars and spaces alternating, from the first bar to the last. */
export interface WatchLinear {
  /** Widths: bar, space, bar, … */
  sbs: number[]
  /** Each bar's height, and how far its foot is above the base line. */
  bhs: number[]
  bbs: number[]
  quietLeft: number
  quietRight: number
}

/** Rows of `size` square modules, 1 dark; `pixs.length / size` rows. */
export interface WatchMatrix {
  size: number
  pixs: number[]
  quiet: number
}

export type WatchBarcode = WatchLinear | WatchMatrix

/** The white each format's own standard asks for, in modules. */
const LINEAR_QUIET: Partial<Record<BarcodeFormat, [number, number]>> = {
  EAN_13: [11, 7],
  EAN_8: [7, 7],
  UPC_A: [9, 9],
  UPC_E: [9, 7],
}
/** Code 39, 93, 128, Codabar and ITF: ten. */
const LINEAR_QUIET_DEFAULT: [number, number] = [10, 10]
// Aztec needs none and Data Matrix one; two keeps the bezel off either.
const MATRIX_QUIET: Partial<Record<BarcodeFormat, number>> = { QR: 4 }
const MATRIX_QUIET_DEFAULT = 2

interface RawLinear {
  sbs: ArrayLike<number>
  bhs: ArrayLike<number>
  bbs: ArrayLike<number>
}
interface RawMatrix {
  pixs: ArrayLike<number>
  pixx: number
  pixy: number
}

/** The code, or null when this number does not encode: the number is shown. */
export function watchBarcode(
  format: BarcodeFormat,
  value: string,
): WatchBarcode | null {
  let raw: RawLinear | RawMatrix | undefined
  try {
    raw = bwipjs.raw(barcodeRenderOptions(format, value))[0] as
      | RawLinear
      | RawMatrix
      | undefined
  } catch {
    return null
  }
  if (!raw) return null
  if (barcodeShape(format) === 'linear') {
    if (!('sbs' in raw)) return null
    const [quietLeft, quietRight] = LINEAR_QUIET[format] ?? LINEAR_QUIET_DEFAULT
    return {
      sbs: Array.from(raw.sbs),
      bhs: Array.from(raw.bhs),
      bbs: Array.from(raw.bbs),
      quietLeft,
      quietRight,
    }
  }
  if (!('pixs' in raw)) return null
  return {
    size: raw.pixx,
    pixs: squareModules(raw),
    quiet: MATRIX_QUIET[format] ?? MATRIX_QUIET_DEFAULT,
  }
}

/**
 * PDF417 rows are three modules tall: bwip-js gives each row once and says in
 * `pixy` how many it draws, so a row is repeated until every module is square.
 */
function squareModules({ pixs, pixx, pixy }: RawMatrix): number[] {
  const flat = Array.from(pixs)
  const rows = flat.length / pixx
  const repeat = Math.max(1, Math.round(pixy / rows))
  if (repeat === 1) return flat
  const out: number[] = []
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < repeat; i++)
      out.push(...flat.slice(row * pixx, (row + 1) * pixx))
  return out
}
