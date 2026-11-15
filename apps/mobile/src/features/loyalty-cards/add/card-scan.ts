/**
 * What a camera scan means for a new Loyalty card (APP-142).
 *
 * The one place expo-camera's barcode type names meet `@gather/core/barcodes`.
 * The scanner is asked only for the types a card can carry (`SCAN_TYPES`), and
 * what it reports is mapped back here, so a type the core does not know never
 * reaches the form.
 *
 * Pure, so the mapping is tested without a camera: the runtime proof for
 * scanning is `card-scan.test.ts` with a mocked scanner result, plus a device
 * check at a real till.
 */
import {
  BARCODE_FORMATS,
  type BarcodeFormat,
  checkCardNumber,
} from '@gather/core/barcodes'
import { retailersMatchingNumber } from '@gather/core/loyalty-cards'
import type { BarcodeType } from 'expo-camera'

/** The expo-camera type each core format is scanned as. */
const SCAN_TYPE: Record<BarcodeFormat, BarcodeType> = {
  EAN_13: 'ean13',
  EAN_8: 'ean8',
  UPC_A: 'upc_a',
  UPC_E: 'upc_e',
  CODE_128: 'code128',
  CODE_39: 'code39',
  CODE_93: 'code93',
  CODABAR: 'codabar',
  ITF: 'itf14',
  QR: 'qr',
  PDF417: 'pdf417',
  AZTEC: 'aztec',
  DATA_MATRIX: 'datamatrix',
}

/** What the scanner is told to look for: every format a card can carry. */
export const SCAN_TYPES: readonly BarcodeType[] = BARCODE_FORMATS.map(
  (format) => SCAN_TYPE[format],
)

/**
 * A reported type, folded so the spellings each platform uses meet: expo's
 * own (`upc_e`), AVFoundation's (`org.gs1.EAN-13`, `interleaved2of5`) and
 * Vision's (`VNBarcodeSymbologyEAN13`).
 */
function foldType(type: string): string {
  return type
    .toLowerCase()
    .replace(/^vnbarcodesymbology/, '')
    .replace(/^org\.(?:gs1|iso|ansi)\./, '')
    .replace(/[^a-z0-9]/g, '')
}

const FORMAT_BY_TYPE: ReadonlyMap<string, BarcodeFormat> = new Map([
  ...BARCODE_FORMATS.map(
    (format) => [foldType(SCAN_TYPE[format]), format] as const,
  ),
  // Other names the platforms report for the same symbologies.
  ['interleaved2of5', 'ITF'],
  ['i2of5', 'ITF'],
  ['itf', 'ITF'],
  ['code39mod43', 'CODE_39'],
  ['qrcode', 'QR'],
  ['microqr', 'QR'],
  ['micropdf417', 'PDF417'],
])

/** The core format for a scanner's type name, or null for one Gather does not draw. */
export function formatFromScanType(type: string): BarcodeFormat | null {
  return FORMAT_BY_TYPE.get(foldType(type)) ?? null
}

/** A scanner result, as `CameraView`'s `onBarcodeScanned` reports it. */
export interface ScannedCode {
  type: string
  data: string
}

/** The form's starting point after a good scan. */
export interface ScannedCard {
  barcodeFormat: BarcodeFormat
  cardNumber: string
}

/**
 * The format and number a scan prefills, or null when the scan is not
 * something a card can carry (an unknown type, or nothing in it).
 *
 * iOS reports a UPC-A as an EAN-13 and strips its leading zero, so a twelve
 * digit "EAN-13" is read as the UPC-A it is. A number its format refuses is
 * still handed over: the form names the problem, and the person can correct
 * it, which beats a scan that silently does nothing.
 */
export function cardFromScan(scan: ScannedCode): ScannedCard | null {
  const format = formatFromScanType(scan.type)
  const data = scan.data.trim()
  if (!format || !data) return null
  if (format === 'EAN_13' && /^\d{12}$/.test(data)) {
    return { barcodeFormat: 'UPC_A', cardNumber: data }
  }
  const check = checkCardNumber(format, data)
  return { barcodeFormat: format, cardNumber: check.ok ? check.value : data }
}

/**
 * The retailer a scanned number points at, when exactly one Catalog entry's
 * pattern hint fits it. Two candidates is no suggestion: the picker is the
 * honest answer then.
 */
export function suggestedRetailer<
  T extends { numberLength?: number; numberPrefix?: string },
>(retailers: readonly T[] | undefined, cardNumber: string): T | null {
  if (!retailers) return null
  const matches = retailersMatchingNumber(retailers, cardNumber)
  return matches.length === 1 ? matches[0] : null
}
