/**
 * SPIKE (APP-652, do not merge): stub watch endpoints, local backend only.
 *
 * No table, no Group: the Bearer key is compared with `WATCH_SPIKE_KEY` and
 * the rows are fixed. The barcodes are encoded here with bwip-js and the same
 * options the phone and web draw a Loyalty card with (`barcodeRenderOptions`),
 * and sent as bars / a matrix, because watchOS has no Core Image.
 */
import { barcodeRenderOptions } from '@gather/core/barcodes'
import bwipjs from 'bwip-js/generic'
import { httpAction } from './_generated/server'

function authorized(request: Request): boolean {
  const expected = process.env.WATCH_SPIKE_KEY
  const header = request.headers.get('Authorization') ?? ''
  return !!expected && header === `Bearer ${expected}`
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const groceries = httpAction(async (_ctx, request) => {
  if (!authorized(request)) return json({ error: 'unauthorized' }, 401)
  return json({
    rows: [
      { id: '1', name: 'Milk', amount: '2 L', checked: false },
      { id: '2', name: 'Bananas', amount: '6', checked: false },
      { id: '3', name: 'Sourdough bread', amount: null, checked: true },
      { id: '4', name: 'Eggs', amount: '12', checked: false },
      { id: '5', name: 'Coffee beans', amount: '500 g', checked: false },
    ],
  })
})

type RawLinear = { sbs: number[]; bhs: number[]; bbs: number[] }
type RawMatrix = { pixs: number[]; pixx: number; pixy: number }

export const barcodes = httpAction(async (_ctx, request) => {
  if (!authorized(request)) return json({ error: 'unauthorized' }, 401)
  const eanText = '8712345678906'
  const qrText = 'GATHER-CARD-0042-7731'
  const [ean] = bwipjs.raw(barcodeRenderOptions('EAN_13', eanText)) as RawLinear[]
  const [qr] = bwipjs.raw(barcodeRenderOptions('QR', qrText)) as RawMatrix[]
  return json({
    // GS1: 11 modules quiet zone left of an EAN-13, 7 right.
    ean13: { sbs: ean.sbs, bhs: ean.bhs, bbs: ean.bbs, quietLeft: 11, quietRight: 7 },
    ean13Text: eanText,
    qr: { size: qr.pixx, pixs: qr.pixs, quiet: 4 },
    qrText,
  })
})
