import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { SVIX_TOLERANCE_SECONDS, verifySvix } from './svix'

/**
 * Signatures here are made with Node's own HMAC, so `verifySvix` (Web Crypto)
 * is checked against an independent implementation of the Svix scheme
 * (https://docs.svix.com/receiving/verifying-payloads/how-manual).
 *
 * Secrets are generated per run: a literal signing secret in the repo reads
 * as a leaked one to secret scanning, even a published test value.
 */
function randomSecret() {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(24)))
  return { key, secret: ['whsec', key.toString('base64')].join('_') }
}

const { key: KEY, secret: SECRET } = randomSecret()
const ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
const TIMESTAMP = '1614265330'
const BODY = '{"test": 2432232314}'
const AT = Number(TIMESTAMP) * 1000

function sign(body: string, key: Buffer = KEY) {
  const digest = createHmac('sha256', key)
    .update(`${ID}.${TIMESTAMP}.${body}`)
    .digest('base64')
  return `v1,${digest}`
}

const SIGNATURE = sign(BODY)

const headers = (signature: string | null = SIGNATURE) => ({
  id: ID,
  timestamp: TIMESTAMP,
  signature,
})

describe('verifySvix', () => {
  test('accepts a body signed with the secret', async () => {
    expect(await verifySvix(SECRET, headers(), BODY, AT)).toBe(true)
  })

  test('accepts the bare base64 key as well as the prefixed secret', async () => {
    expect(
      await verifySvix(KEY.toString('base64'), headers(), BODY, AT),
    ).toBe(true)
  })

  test('accepts a matching entry among several (a secret being rotated)', async () => {
    const rotating = `v1,bm90IHRoaXMgb25l ${SIGNATURE} v2,whatever`
    expect(await verifySvix(SECRET, headers(rotating), BODY, AT)).toBe(true)
  })

  test('refuses a changed body', async () => {
    expect(
      await verifySvix(SECRET, headers(), '{"test": 2432232315}', AT),
    ).toBe(false)
  })

  test('refuses another secret', async () => {
    const other = randomSecret()
    expect(await verifySvix(other.secret, headers(), BODY, AT)).toBe(false)
    expect(
      await verifySvix(SECRET, headers(sign(BODY, other.key)), BODY, AT),
    ).toBe(false)
  })

  test('refuses a missing header', async () => {
    expect(await verifySvix(SECRET, headers(null), BODY, AT)).toBe(false)
    expect(
      await verifySvix(SECRET, { ...headers(), id: null }, BODY, AT),
    ).toBe(false)
    expect(
      await verifySvix(SECRET, { ...headers(), timestamp: null }, BODY, AT),
    ).toBe(false)
  })

  test('refuses garbage where the signature goes', async () => {
    const bare = SIGNATURE.slice(3)
    for (const signature of ['', 'v1,', 'v1,%%%', bare, `v2,${bare}`])
      expect(await verifySvix(SECRET, headers(signature), BODY, AT)).toBe(false)
  })

  test('refuses a timestamp outside five minutes, either way', async () => {
    const tolerance = SVIX_TOLERANCE_SECONDS * 1000
    expect(await verifySvix(SECRET, headers(), BODY, AT + tolerance)).toBe(
      true,
    )
    expect(
      await verifySvix(SECRET, headers(), BODY, AT + tolerance + 1000),
    ).toBe(false)
    expect(
      await verifySvix(SECRET, headers(), BODY, AT - tolerance - 1000),
    ).toBe(false)
  })

  test('refuses a secret that is not base64, or is empty', async () => {
    expect(await verifySvix(['whsec', '%%%'].join('_'), headers(), BODY, AT)).toBe(
      false,
    )
    expect(await verifySvix('whsec_', headers(), BODY, AT)).toBe(false)
  })
})
