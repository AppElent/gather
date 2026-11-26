/**
 * How many channels one Home Assistant connection may have (APP-724).
 */
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { measuredSpan } from './energyUsage'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** How far back a history import reads, from when it was asked for. */
export const HISTORY_MS = 365 * DAY_MS
/** How long after that it may still be running. */
export const IMPORT_MS = 15 * DAY_MS
/** The longest month, with the hour the clock goes back. */
const MONTH_MS = 31 * DAY_MS + HOUR_MS

/**
 * Channels with hours in any one month. A query scans at most 32,000
 * documents and reads 4,096 index ranges
 * (https://docs.convex.dev/production/state/limits). The most a month
 * (`computeEnergyRange`) scans:
 *
 *   intervals   30 channels × 745 hours                          22,350
 *   prices      (market + account) × 745 × 4 quarters + gas 745   6,705
 *   channels    330, and the first and last hour of each            990
 *   solar       first hour of each solar and battery channel,
 *               twice for solar (`energySolar.month`)               120
 *                                                          total 30,165
 *
 * 330 is every channel a connection can ever have: a choice takes up a retired
 * channel of its kind and tariff before one is added, so each of the 11 kinds
 * and tariffs stays at 30. They cost three index ranges each, about 1,000,
 * and solar's first hours one each, 120 more. A document is some 200 bytes,
 * so this is about 6 of the 16 MiB allowed. The rest (typed readings,
 * contracts, the manual source, solar assets, the Group) has no hard bound
 * and the 1,835 left, far more than a household types. `day` reads its month
 * or itself, never both. A realistic site, seven channels and one price feed,
 * scans about 9,000.
 *
 * Payback reads one `energySolar.month` per past month (APP-921). None of
 * them reads the Home Assistant source the hourly sync patches
 * (`siteChannels`), so a past month re-runs only when its own rows change.
 */
export const MAX_CHANNELS = 30

/**
 * The most channels that can have hours in one month, whichever month it is.
 *
 * A retired channel is given no more hours, so it has those between its first
 * and last. A channel in use may be given any from where its sync or a history
 * import can start, on until it is retired. Call it after every change to a
 * connection's channels: nothing between two of them widens these spans.
 */
export async function mostChannelsInAMonth(
  ctx: QueryCtx,
  channels: readonly Doc<'energyChannels'>[],
  now: number,
): Promise<number> {
  // An import may have been asked for `IMPORT_MS` ago; a day of slack covers
  // its baseline hour and the rounding to whole hours.
  const importFrom = now - HISTORY_MS - IMPORT_MS - DAY_MS
  const spans = (
    await Promise.all(
      channels.map(async (channel) => {
        const measured = await measuredSpan(ctx, channel._id)
        if (channel.retiredAt !== undefined) return measured
        return {
          from: Math.min(
            measured?.from ?? Number.POSITIVE_INFINITY,
            // Without hours yet, a sync starts where the channel was made.
            channel._creationTime - 2 * HOUR_MS,
            importFrom,
          ),
          to: Number.POSITIVE_INFINITY,
        }
      }),
    )
  ).filter((span) => span !== null)
  // Spans that touch one month share a moment once each lasts a month longer,
  // and most of them do at the moment one of them starts.
  return Math.max(
    0,
    ...spans.map(
      ({ from }) =>
        spans.filter((each) => each.from <= from && from < each.to + MONTH_MS)
          .length,
    ),
  )
}
