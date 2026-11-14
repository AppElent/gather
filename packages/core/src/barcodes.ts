/**
 * The barcode formats a Loyalty card can carry, and what each will accept.
 *
 * Shared because the web draws a card's barcode, the phone draws it and will
 * scan it, and Convex refuses a number its format cannot encode — three places
 * that must agree on "is this a valid EAN-13" (ADR-0016). Dependency-free: the
 * renderer is the client's business; this is only the rules.
 *
 * The names are the ZXing / Catima spellings (`EAN_13`, `QR_CODE` is spelled
 * `QR` here as the issue asked), because those are what loyalty-card exports
 * and scanners speak, so an import or a scan maps across without a table.
 */

export const BARCODE_FORMATS = [
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'CODABAR',
  'ITF',
  'QR',
  'PDF417',
  'AZTEC',
  'DATA_MATRIX',
] as const
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number]

/** Linear barcodes are drawn wide and short; matrix codes square. */
export type BarcodeShape = 'linear' | 'matrix'

/**
 * Whether a Catalog entry's format came from a public source or is the
 * fallback. A guess is CODE_128, which can encode any number a card prints.
 * It is an editable fallback, not a promise the till accepts it: the form says
 * the type was guessed, and the person can change it on the card.
 */
export const FORMAT_CONFIDENCES = ['sourced', 'guess'] as const
export type FormatConfidence = (typeof FORMAT_CONFIDENCES)[number]

export function isBarcodeFormat(value: string): value is BarcodeFormat {
  return (BARCODE_FORMATS as readonly string[]).includes(value)
}

const MATRIX: ReadonlySet<BarcodeFormat> = new Set([
  'QR',
  'PDF417',
  'AZTEC',
  'DATA_MATRIX',
])

export function barcodeShape(format: BarcodeFormat): BarcodeShape {
  return MATRIX.has(format) ? 'matrix' : 'linear'
}

/** Formats whose content is digits only, where spaces a person types are noise. */
const NUMERIC: ReadonlySet<BarcodeFormat> = new Set([
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'ITF',
])

export type BarcodeProblem = 'empty' | 'characters' | 'length' | 'checkDigit'

export type BarcodeCheck =
  | { ok: true; value: string }
  | { ok: false; problem: BarcodeProblem }

/**
 * The most a card can carry, in UTF-8 bytes, which is what a matrix code
 * stores. 512 bytes fits every matrix format the renderer draws, PDF417 with
 * multi-byte text included.
 */
export const MAX_CARD_NUMBER_LENGTH = 512

/**
 * The longest linear barcode Gather accepts, in characters. The renderer can
 * draw longer ones (Code 128 and Code 39 to 500), but a linear code that long
 * no longer fits a phone screen at a width a till can read, and no loyalty card
 * prints one. Kept well inside every encoder's own limit, so a number that
 * passes here always draws.
 */
export const MAX_LINEAR_CARD_NUMBER_LENGTH = 80

/** Bytes in the UTF-8 encoding of a string, without TextEncoder. */
function utf8Length(value: string): number {
  let bytes = 0
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

/**
 * The GS1 mod-10 check digit for a run of digits without its check digit:
 * weights 3 and 1 alternate from the rightmost digit. EAN-13, EAN-8, UPC-A
 * and ITF-14 all use it.
 */
export function gs1CheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i])
    sum += i % 2 === 0 ? digit * 3 : digit
  }
  return (10 - (sum % 10)) % 10
}

function hasValidGs1Check(digits: string): boolean {
  return (
    gs1CheckDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1])
  )
}

/** UPC-E → UPC-A, for the check digit (GS1 General Specifications 5.2.2.4.2). */
function expandUpcE(code: string): string {
  const system = code[0]
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7)
  const check = code[7]
  let body: string
  switch (d6) {
    case '0':
    case '1':
    case '2':
      body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`
      break
    case '3':
      body = `${d1}${d2}${d3}00000${d4}${d5}`
      break
    case '4':
      body = `${d1}${d2}${d3}${d4}00000${d5}`
      break
    default:
      body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  }
  return `${system}${body}${check}`
}

const CODE_39_CHARS = /^[0-9A-Z \-.$/+%]+$/
const CODABAR_BODY = /^[0-9\-$:/.+]+$/
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/

function digitsOfLength(value: string, length: number): BarcodeCheck | null {
  if (!/^\d+$/.test(value)) return { ok: false, problem: 'characters' }
  if (value.length !== length) return { ok: false, problem: 'length' }
  return null
}

/**
 * Normalize what a person typed for a format, then say whether that format
 * can encode it.
 *
 * Normalizing is deliberately small: numeric formats drop spaces and dashes
 * (people copy "2620 0123 4567 8" off the card), Code 39, Code 93 and
 * Codabar are upper-cased because they have no lower case (Codabar's start and
 * stop letters are A–D), and everything is trimmed. Nothing else is
 * rewritten — a card number is what the till scans, so a validator that
 * "fixed" it would be inventing one.
 */
export function checkCardNumber(
  format: BarcodeFormat,
  raw: string,
): BarcodeCheck {
  let value = raw.trim()
  if (NUMERIC.has(format)) value = value.replace(/[\s-]/g, '')
  if (format === 'CODE_39' || format === 'CODE_93' || format === 'CODABAR') {
    value = value.toUpperCase()
  }
  if (!value) return { ok: false, problem: 'empty' }
  if (
    barcodeShape(format) === 'linear'
      ? value.length > MAX_LINEAR_CARD_NUMBER_LENGTH
      : utf8Length(value) > MAX_CARD_NUMBER_LENGTH
  ) {
    return { ok: false, problem: 'length' }
  }

  switch (format) {
    case 'EAN_13':
    case 'EAN_8':
    case 'UPC_A': {
      const length = format === 'EAN_13' ? 13 : format === 'EAN_8' ? 8 : 12
      const shape = digitsOfLength(value, length)
      if (shape) return shape
      return hasValidGs1Check(value)
        ? { ok: true, value }
        : { ok: false, problem: 'checkDigit' }
    }
    case 'UPC_E': {
      const shape = digitsOfLength(value, 8)
      if (shape) return shape
      if (value[0] !== '0' && value[0] !== '1') {
        return { ok: false, problem: 'characters' }
      }
      return hasValidGs1Check(expandUpcE(value))
        ? { ok: true, value }
        : { ok: false, problem: 'checkDigit' }
    }
    case 'ITF': {
      if (!/^\d+$/.test(value)) return { ok: false, problem: 'characters' }
      // Interleaved 2 of 5 encodes digits in pairs.
      if (value.length % 2 !== 0) return { ok: false, problem: 'length' }
      // ITF-14 carries a GS1 check digit; other lengths have none to check.
      if (value.length === 14 && !hasValidGs1Check(value)) {
        return { ok: false, problem: 'checkDigit' }
      }
      return { ok: true, value }
    }
    case 'CODE_39':
    case 'CODE_93':
      return CODE_39_CHARS.test(value)
        ? { ok: true, value }
        : { ok: false, problem: 'characters' }
    case 'CODABAR': {
      // Optional A–D start and stop characters around the body.
      const body = /^[A-D].*[A-D]$/.test(value) ? value.slice(1, -1) : value
      return body && CODABAR_BODY.test(body)
        ? { ok: true, value }
        : { ok: false, problem: 'characters' }
    }
    case 'CODE_128':
      return PRINTABLE_ASCII.test(value)
        ? { ok: true, value }
        : { ok: false, problem: 'characters' }
    case 'QR':
    case 'PDF417':
    case 'AZTEC':
    case 'DATA_MATRIX':
      // Matrix codes carry any text; the length cap above is the only rule.
      return { ok: true, value }
  }
}
