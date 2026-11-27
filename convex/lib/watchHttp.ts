/**
 * `/watch/v1/*`: what a paired Apple Watch calls (APP-653,
 * `docs/contracts/watch-api.md`). Routed in `http.ts`.
 *
 * The key is hashed here and only the hash goes further. A refusal is a status
 * and a keyed body, the same kinds every other refusal of a Group has.
 */
import {
  groupRefusal,
  type WatchRefusalCode,
  watchRefusal,
} from '@gather/core/refusals'
import { ConvexError, type Infer } from 'convex/values'
import { internal } from '../_generated/api'
import { type ActionCtx, httpAction } from '../_generated/server'
import type { watchChangeValidator } from '../watchChanges'
import { GROUP_REFUSAL_MESSAGES } from './groupAccess'
import type { WatchGroupRefusal } from './watchAccess'
import { watchBarcode } from './watchBarcodes'
import { bearerKey, hashWatchKey } from './watchKeys'
import { MAX_CHANGES } from './watchRateLimits'

/** Far above fifty changes; a bigger body is not an outbox, and is not parsed. */
const MAX_BODY_BYTES = 64 * 1024
/** The longest line a watch may dictate as one grocery. */
const MAX_TEXT = 200

type WatchChange = Infer<typeof watchChangeValidator>

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

function groupRefused(reason: WatchGroupRefusal) {
  return json(
    reason === 'not-signed-in' ? 401 : 403,
    groupRefusal(reason, GROUP_REFUSAL_MESSAGES[reason]),
    reason === 'not-signed-in' ? { 'www-authenticate': 'Bearer' } : {},
  )
}

function watchRefused(
  status: number,
  code: WatchRefusalCode,
  headers?: HeadersInit,
) {
  return json(status, watchRefusal(code), headers)
}

/** The hash of the request's key once the watch is let in, or the refusal. */
async function admitted(
  ctx: ActionCtx,
  request: Request,
  changes?: number,
): Promise<{ keyHash: string } | { refusal: Response }> {
  const key = bearerKey(request.headers.get('authorization'))
  if (!key) return { refusal: groupRefused('not-signed-in') }
  const keyHash = await hashWatchKey(key)
  const answer = await ctx.runMutation(internal.watch.admit, {
    keyHash,
    changes,
  })
  if (answer.ok) return { keyHash }
  if (answer.reason === 'rate-limited')
    return {
      refusal: watchRefused(429, 'rate-limited', {
        'retry-after': String(Math.max(1, Math.ceil(answer.retryAfterMs / 1000))),
      }),
    }
  return { refusal: groupRefused(answer.reason) }
}

/** One Module's answer. */
export const read = (module: 'modules' | 'groceries' | 'today' | 'cards') =>
  httpAction(async (ctx, request) => {
    const entry = await admitted(ctx, request)
    if ('refusal' in entry) return entry.refusal
    const { keyHash } = entry
    if (module === 'cards') {
      const answer = await ctx.runQuery(internal.watchReads.cards, { keyHash })
      if (!answer.ok) return groupRefused(answer.reason)
      return json(200, {
        ...answer.data,
        cards: answer.data.cards.map((card) => ({
          ...card,
          barcode: watchBarcode(card.format, card.number),
        })),
      })
    }
    const answer = await ctx.runQuery(internal.watchReads[module], {
      keyHash,
      now: Date.now(),
    })
    return answer.ok ? json(200, answer.data) : groupRefused(answer.reason)
  })

/** The watch's outbox, in the order it was made. */
export const changes = httpAction(async (ctx, request) => {
  // Nothing is read from a caller that did not even bring a key.
  if (!bearerKey(request.headers.get('authorization')))
    return groupRefused('not-signed-in')
  const length = Number(request.headers.get('content-length') ?? 0)
  const body = length > MAX_BODY_BYTES ? '' : await request.text()
  if (length > MAX_BODY_BYTES || body.length > MAX_BODY_BYTES)
    return watchRefused(413, 'bad-request')
  const sent = parseBody(body)
  const entry = await admitted(ctx, request, sent?.length)
  if ('refusal' in entry) return entry.refusal
  if (!sent) return watchRefused(400, 'bad-request')

  const results: unknown[] = []
  for (const each of sent) {
    const parsed = parseChange(each)
    if (!parsed) {
      const key = isRecord(each) && typeof each.key === 'string' ? each.key : null
      results.push({ key, ok: false, ...watchRefusal('bad-request') })
      continue
    }
    const { key, change } = parsed
    try {
      const answer = await ctx.runMutation(internal.watchChanges.apply, {
        keyHash: entry.keyHash,
        key,
        change,
      })
      if (answer.ok) results.push({ key, ok: true, taskId: answer.taskId })
      // Revoked, or out of the Group, half way: the rest goes nowhere either.
      else if ('refused' in answer) return groupRefused(answer.refused)
      else results.push({ key, ok: false, ...watchRefusal(answer.code) })
    } catch (error) {
      // A refusal is permanent: sending the change again would not help.
      if (error instanceof ConvexError) {
        results.push({ key, ok: false, ...watchRefusal('bad-request') })
        continue
      }
      // One bad change must not hold up the rest of the outbox.
      console.error(`watch: ${change.kind} failed`, error)
      results.push({ key, ok: false, ...watchRefusal('failed') })
    }
  }
  return json(200, { version: 1, results })
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `{ changes: [...] }` with one to fifty of them, or null. */
function parseBody(body: string): unknown[] | null {
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    return null
  }
  if (!isRecord(value) || !Array.isArray(value.changes)) return null
  const { changes: sent } = value
  return sent.length >= 1 && sent.length <= MAX_CHANGES ? sent : null
}

function parseChange(
  value: unknown,
): { key: string; change: WatchChange } | null {
  if (!isRecord(value)) return null
  const { key, kind, taskId, text, occurrence } = value
  if (typeof key !== 'string' || key.length < 8 || key.length > 64) return null
  if (kind === 'grocery.add') {
    if (typeof text !== 'string') return null
    const line = text.replace(/\s+/g, ' ').trim()
    if (line.length === 0 || line.length > MAX_TEXT) return null
    return { key, change: { kind, text: line } }
  }
  if (typeof taskId !== 'string' || taskId.length === 0 || taskId.length > 64)
    return null
  if (kind === 'grocery.check' || kind === 'grocery.uncheck')
    return { key, change: { kind, taskId } }
  if (kind !== 'task.done') return null
  if (occurrence === undefined) return { key, change: { kind, taskId } }
  if (
    occurrence !== null &&
    (typeof occurrence !== 'string' || occurrence.length > 10)
  )
    return null
  return { key, change: { kind, taskId, occurrence } }
}
