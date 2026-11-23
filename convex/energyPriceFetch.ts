/**
 * The actions that read day-ahead prices (APP-493), one function per
 * provider. Read-only, to three fixed addresses.
 *
 * A key is sent only to the provider it was typed for. It is in no scheduled
 * argument, return value or log line. ENTSO-E takes its token in the web
 * address, so neither a request nor an error of `fetch` is ever logged or
 * thrown on: every failure becomes a code.
 *
 * Retries are scheduled and bounded, and the next day's cron starts again.
 */
import { addDays } from '@gather/core/civil-date'
import {
  amsterdamDayOf,
  amsterdamDayStart,
  completeElectricityDay,
  EnergyPriceAnswerError,
  type EnergyPriceProblem,
  type EnergyPriceSlot,
  energyTomorrowDue,
  readEnergyZeroPrices,
  readEntsoePrices,
  readTibberPrices,
  TIBBER_PRICE_QUERY,
} from '@gather/core/energy'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { type ActionCtx, internalAction } from './_generated/server'

const MINUTE_MS = 60_000
/** Between two tries: half an hour around publication, then further apart. */
const RETRY_MINUTES = [30, 30, 30, 60, 60, 120, 120, 180] as const
const TIMEOUT_MS = 20_000
/** Three days of quarters in six versions is about 150 kB. */
const MAX_ANSWER_CHARS = 4_000_000

const ENERGYZERO = 'https://public.api.energyzero.nl/public/v1/prices'
const ENTSOE = 'https://web-api.tp.entsoe.eu/api'
/** The Dutch bidding zone. */
const ENTSOE_NL = '10YNL----------L'
const TIBBER = 'https://api.tibber.com/v1-beta/gql'

const triesArgs = {
  /** Left out for a first try. */
  triesLeft: v.optional(v.number()),
}

/** The pause before the next try, or null when there is none left. */
function nextTry(triesLeft: number | undefined) {
  const left = Math.min(triesLeft ?? RETRY_MINUTES.length, RETRY_MINUTES.length)
  const minutes = RETRY_MINUTES[RETRY_MINUTES.length - left]
  return left <= 0 || minutes === undefined
    ? null
    : { after: minutes * MINUTE_MS, triesLeft: left - 1 }
}

/** An answer's status and text. Throws nothing but a code. */
async function ask(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; text: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      // A redirect would carry the key to wherever it points.
      redirect: 'manual',
      signal: controller.signal,
    })
    const text = await response.text()
    if (text.length > MAX_ANSWER_CHARS) {
      throw new EnergyPriceAnswerError('badAnswer')
    }
    return { status: response.status, text }
  } catch (error) {
    if (error instanceof EnergyPriceAnswerError) throw error
    // The caught error can hold the web address, and with it a token.
    throw new EnergyPriceAnswerError('unreachable')
  } finally {
    clearTimeout(timer)
  }
}

function json(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new EnergyPriceAnswerError('badAnswer')
  }
}

function problemOf(error: unknown): EnergyPriceProblem {
  return error instanceof EnergyPriceAnswerError ? error.problem : 'badAnswer'
}

function okOrThrow(status: number) {
  if (status === 401 || status === 403) {
    throw new EnergyPriceAnswerError('keyRejected')
  }
  if (status === 200) return
  throw new EnergyPriceAnswerError(
    status === 429 || status >= 500 ? 'unreachable' : 'badAnswer',
  )
}

const days = (now: number) => {
  const today = amsterdamDayOf(now)
  return { today, tomorrow: addDays(today, 1) }
}

async function askEnergyZero(
  carrier: 'electricity' | 'gas',
  day: string,
): Promise<EnergyPriceSlot[]> {
  const [year, month, date] = day.split('-')
  const query = new URLSearchParams({
    date: `${date}-${month}-${year}`,
    interval: carrier === 'gas' ? 'INTERVAL_DAY' : 'INTERVAL_QUARTER',
    energyType:
      carrier === 'gas' ? 'ENERGY_TYPE_GAS' : 'ENERGY_TYPE_ELECTRICITY',
  })
  const answer = await ask(`${ENERGYZERO}?${query}`)
  // A day that is not published yet.
  if (answer.status === 404) return []
  // It takes no key, so refusing one is simply an odd answer.
  if (answer.status === 401 || answer.status === 403) {
    throw new EnergyPriceAnswerError('unreachable')
  }
  okOrThrow(answer.status)
  return readEnergyZeroPrices(json(answer.text))
}

const entsoeTime = (at: number) =>
  new Date(at).toISOString().replace(/[-T:]/g, '').slice(0, 12)

async function askEntsoe(
  token: string,
  from: number,
  to: number,
): Promise<EnergyPriceSlot[]> {
  const query = new URLSearchParams({
    securityToken: token,
    documentType: 'A44',
    'contract_MarketAgreement.type': 'A01',
    in_Domain: ENTSOE_NL,
    out_Domain: ENTSOE_NL,
    periodStart: entsoeTime(from),
    periodEnd: entsoeTime(to),
  })
  const answer = await ask(`${ENTSOE}?${query}`)
  // No data for the period can come with 400 or 404 and says so in the text.
  if (answer.status !== 400 && answer.status !== 404) okOrThrow(answer.status)
  return readEntsoePrices(answer.text) ?? []
}

async function askTibber(key: string): Promise<EnergyPriceSlot[]> {
  const answer = await ask(TIBBER, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: TIBBER_PRICE_QUERY }),
  })
  // A refused query is a 400 with the reason in the body.
  if (answer.status !== 400) okOrThrow(answer.status)
  return readTibberPrices(json(answer.text))
}

/**
 * Store the days an answer holds whole. `late` when a day that should be out
 * is not in it: today always, tomorrow from the afternoon on.
 */
async function storeElectricity(
  ctx: ActionCtx,
  owner: {
    provider: 'energyzero' | 'entsoe' | 'tibber'
    account?: { feedId: Id<'energyPriceFeeds'>; secret: string }
  },
  slots: readonly EnergyPriceSlot[],
  now: number,
): Promise<{ problem: EnergyPriceProblem | null; whole: boolean }> {
  const { today, tomorrow } = days(now)
  const stored = { [today]: false, [tomorrow]: false }
  for (const day of [today, tomorrow]) {
    const own = completeElectricityDay(day, slots)
    if (!own) continue
    const result = await ctx.runMutation(internal.energyPrices.storeDay, {
      ...owner,
      carrier: 'electricity',
      day,
      slots: own,
    })
    stored[day] = result === 'stored'
  }
  const whole = Boolean(stored[today] && stored[tomorrow])
  const late = !stored[today] || (!stored[tomorrow] && energyTomorrowDue(now))
  return { problem: late ? 'late' : null, whole }
}

/** Today's and tomorrow's prices, electricity and gas, once for all Groups. */
export const fetchEnergyZero = internalAction({
  args: triesArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const now = Date.now()
    const { today, tomorrow } = days(now)
    const wanted = [today, tomorrow]
    let whole = true
    for (const carrier of ['electricity', 'gas'] as const) {
      const missing = await ctx.runQuery(internal.energyPrices.missingMarketDays, {
        provider: 'energyzero',
        carrier,
        days: wanted,
      })
      if (missing.length === 0) continue
      try {
        // Asking for today gives tomorrow with it once that is published.
        const slots = await askEnergyZero(carrier, today)
        for (const day of missing) {
          const result = await ctx.runMutation(internal.energyPrices.storeDay, {
            provider: 'energyzero',
            carrier,
            day,
            slots: slots.filter((slot) => amsterdamDayOf(slot.start) === day),
          })
          if (result !== 'stored') whole = false
        }
      } catch (error) {
        console.warn(`EnergyZero ${carrier}: ${problemOf(error)}`)
        whole = false
      }
    }
    const next = whole ? null : nextTry(args.triesLeft)
    if (next) {
      await ctx.scheduler.runAfter(
        next.after,
        internal.energyPriceFetch.fetchEnergyZero,
        { triesLeft: next.triesLeft },
      )
    }
    return null
  },
})

/**
 * The same prices from ENTSO-E, for the sites that chose it: read once, with
 * the first stored token it accepts. A refused token waits for a new one.
 */
export const fetchEntsoe = internalAction({
  args: triesArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const now = Date.now()
    const { today, tomorrow } = days(now)
    const missing = await ctx.runQuery(internal.energyPrices.missingMarketDays, {
      provider: 'entsoe',
      carrier: 'electricity',
      days: [today, tomorrow],
    })
    if (missing.length === 0) {
      // A key saved today already brought them, for every site.
      await ctx.runMutation(internal.energyPrices.finishMarketFetch, {
        provider: 'entsoe',
        problem: null,
      })
      return null
    }
    const keys = await ctx.runQuery(internal.energyPrices.marketKeys, {
      provider: 'entsoe',
    })
    if (keys.length === 0) return null
    let problem: EnergyPriceProblem | null = 'keyRejected'
    let whole = false
    for (const key of keys) {
      try {
        const slots = await askEntsoe(
          key.secret,
          amsterdamDayStart(today),
          amsterdamDayStart(addDays(tomorrow, 1)),
        )
        ;({ problem, whole } = await storeElectricity(
          ctx,
          { provider: 'entsoe' },
          slots,
          now,
        ))
        break
      } catch (error) {
        problem = problemOf(error)
        if (problem !== 'keyRejected') break
        await ctx.runMutation(internal.energyPrices.finishFetch, {
          feedId: key.feedId,
          secret: key.secret,
          problem,
        })
      }
    }
    // Every key tried was refused and marked; the others were not tried yet.
    if (problem !== 'keyRejected') {
      await ctx.runMutation(internal.energyPrices.finishMarketFetch, {
        provider: 'entsoe',
        problem,
      })
    }
    const next = whole ? null : nextTry(args.triesLeft)
    if (next) {
      await ctx.scheduler.runAfter(
        next.after,
        internal.energyPriceFetch.fetchEntsoe,
        { triesLeft: next.triesLeft },
      )
    }
    return null
  },
})

/**
 * One feed with its own key: a Tibber feed's account prices every day, and
 * any feed right after its key was saved, which is what checks the key.
 */
export const fetchFeed = internalAction({
  args: { feedId: v.id('energyPriceFeeds'), ...triesArgs },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await ctx.runQuery(internal.energyPrices.feedKey, {
      feedId: args.feedId,
    })
    if (!key || key.provider === 'energyzero') return null
    const now = Date.now()
    const { today, tomorrow } = days(now)
    let problem: EnergyPriceProblem | null
    let whole = false
    try {
      if (key.provider === 'tibber') {
        const slots = await askTibber(key.secret)
        ;({ problem, whole } = await storeElectricity(
          ctx,
          {
            provider: 'tibber',
            account: { feedId: key.feedId, secret: key.secret },
          },
          slots,
          now,
        ))
      } else {
        const slots = await askEntsoe(
          key.secret,
          amsterdamDayStart(today),
          amsterdamDayStart(addDays(tomorrow, 1)),
        )
        ;({ problem, whole } = await storeElectricity(
          ctx,
          { provider: 'entsoe' },
          slots,
          now,
        ))
      }
    } catch (error) {
      problem = problemOf(error)
    }
    await ctx.runMutation(internal.energyPrices.finishFetch, {
      feedId: key.feedId,
      secret: key.secret,
      problem,
    })
    // Neither changes until somebody does something.
    const waits = problem === 'keyRejected' || problem === 'noSubscription'
    const next = whole || waits ? null : nextTry(args.triesLeft)
    if (next) {
      await ctx.scheduler.runAfter(
        next.after,
        internal.energyPriceFetch.fetchFeed,
        { feedId: args.feedId, triesLeft: next.triesLeft },
      )
    }
    return null
  },
})
