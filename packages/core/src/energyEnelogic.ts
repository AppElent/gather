/**
 * Enelogic as an Energy source (APP-497): which channels a household's
 * measuring points offer, and how Enelogic's meter readings become hourly
 * amounts. Pure and dependency-free (ADR-0016). Everything that arrives from
 * Enelogic is untrusted JSON, so each reader here takes `unknown`.
 *
 * Enelogic gives, per measuring point, meter readings (`quantity`, a running
 * total) per rate, every quarter of an hour for power and every hour for gas,
 * in the point's own time zone. The rate is the meter's OBIS register:
 * 1.8.x is power taken from the grid, 2.8.x power sent back, and x is the
 * tariff (1 off-peak, 2 normal, 0 every tariff). A gas point counts its one
 * register as 180.
 */
import type {
  EnergyChannelKind,
  EnergyTariff,
  HaHour,
  HaStatistic,
} from './energyHomeAssistant'

const HOUR_MS = 3_600_000

export const ENELOGIC_RATES = {
  importTotal: 180,
  importT1: 181,
  importT2: 182,
  exportTotal: 280,
  exportT1: 281,
  exportT2: 282,
} as const

export interface EnelogicPoint {
  id: number
  label: string
  gas: boolean
  timeZone: string
  /** The newest reading's moment, in the point's local time, or null. */
  latest: string | null
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

/** The active measuring points in `GET /measuringpoints/`. */
export function readEnelogicPoints(json: unknown): EnelogicPoint[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((each) => {
    const point = record(each)
    if (!point || !Number.isSafeInteger(point.id)) return []
    if (point.active === false) return []
    return [
      {
        id: point.id as number,
        label: text(point.label) ?? `#${point.id}`,
        // Power points carry no unit type, or 0.
        gas: point.unitType === 1,
        timeZone: text(point.timezone) ?? 'Europe/Amsterdam',
        latest: text(point.dayMax),
      },
    ]
  })
}

/** A channel's `externalRef`: one register of one measuring point. */
export function enelogicRef(pointId: number, rate: number): string {
  return `${pointId}:${rate}`
}

export function parseEnelogicRef(
  ref: string,
): { pointId: number; rate: number } | null {
  const match = /^(\d{1,12}):(\d{3})$/.exec(ref)
  if (!match) return null
  return { pointId: Number(match[1]), rate: Number(match[2]) }
}

/** The kind a register measures, on a power or a gas point. */
export function enelogicRateChannel(
  rate: number,
  gas: boolean,
): { kind: EnergyChannelKind; tariff?: EnergyTariff } | null {
  if (gas) return rate === ENELOGIC_RATES.importTotal ? { kind: 'gas' } : null
  switch (rate) {
    case ENELOGIC_RATES.importTotal:
      return { kind: 'gridImport' }
    case ENELOGIC_RATES.importT1:
      return { kind: 'gridImport', tariff: 't1' }
    case ENELOGIC_RATES.importT2:
      return { kind: 'gridImport', tariff: 't2' }
    case ENELOGIC_RATES.exportTotal:
      return { kind: 'gridExport' }
    case ENELOGIC_RATES.exportT1:
      return { kind: 'gridExport', tariff: 't1' }
    case ENELOGIC_RATES.exportT2:
      return { kind: 'gridExport', tariff: 't2' }
    default:
      return null
  }
}

/**
 * The milliseconds of a local wall time in a time zone, or null when it is
 * not one. A wall time that a clock change skips reads as the hour after; one
 * that happens twice as the first.
 */
export function enelogicMoment(local: string, timeZone: string): number | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match
  const wall = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  )
  if (Number.isNaN(wall)) return null
  // The offsets before and after any clock change near this wall time: each
  // gives a moment, which is right when its own offset agrees.
  let before: number
  let after: number
  try {
    before = wall - offsetAt(wall - CHANGE_MARGIN_MS, timeZone)
    after = wall - offsetAt(wall + CHANGE_MARGIN_MS, timeZone)
  } catch {
    return null
  }
  const fits = [before, after].filter(
    (at) => offsetAt(at, timeZone) === wall - at,
  )
  // None fits a skipped wall time: the offset before carries it past the gap.
  return fits.length > 0 ? Math.min(...fits) : before
}

/** Further from a wall time than any clock change shifts it. */
const CHANGE_MARGIN_MS = 6 * HOUR_MS

const offsetFormats = new Map<string, Intl.DateTimeFormat>()

/** How far a time zone's wall clock is ahead of UTC at an instant. */
function offsetAt(at: number, timeZone: string): number {
  let format = offsetFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    offsetFormats.set(timeZone, format)
  }
  const parts: Record<string, number> = {}
  for (const part of format.formatToParts(new Date(at))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const wall = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  )
  return wall - Math.floor(at / 1000) * 1000
}

/** The local day (`YYYY-MM-DD`) an instant falls on in a time zone. */
export function enelogicDay(at: number, timeZone: string): string {
  return new Date(at + offsetAt(at, timeZone)).toISOString().slice(0, 10)
}

export interface EnelogicReading {
  at: number
  rate: number
  quantity: number
}

/**
 * The readings in a datapoints answer (quarter hours: `datetime`; days and
 * months: `date`), oldest first. What is not a reading is left out.
 */
export function readEnelogicReadings(
  json: unknown,
  timeZone: string,
): EnelogicReading[] {
  if (!Array.isArray(json)) return []
  const readings = json.flatMap((each) => {
    const row = record(each)
    if (!row || !Number.isSafeInteger(row.rate)) return []
    const quantity =
      typeof row.quantity === 'number' ? row.quantity : Number(row.quantity)
    const when = text(row.datetime) ?? text(row.date)
    const at = when === null ? null : enelogicMoment(when, timeZone)
    if (at === null || !Number.isFinite(quantity) || quantity < 0) return []
    return [{ at, rate: row.rate as number, quantity }]
  })
  return readings.sort((a, b) => a.at - b.at || a.rate - b.rate)
}

/** The registers a point's readings carry. */
export function enelogicRates(readings: readonly EnelogicReading[]): number[] {
  return [...new Set(readings.map((each) => each.rate))].sort((a, b) => a - b)
}

/**
 * One register's readings as Home Assistant-shaped hours: the reading at the
 * top of an hour is the running total at the end of the hour before. So
 * `hourlyAmountsFromSums` turns them into amounts, the first as baseline.
 */
export function enelogicHours(
  readings: readonly EnelogicReading[],
  rate: number,
): HaHour[] {
  const byHour = new Map<number, number>()
  for (const reading of readings) {
    if (reading.rate !== rate || reading.at % HOUR_MS !== 0) continue
    // A clock change can repeat an hour; the first reading stands.
    if (!byHour.has(reading.at)) byHour.set(reading.at, reading.quantity)
  }
  return [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, sum]) => ({ hourStart: at - HOUR_MS, sum, mean: null }))
}

const RATE_NAMES: Record<number, string> = {
  180: '1.8.0',
  181: '1.8.1',
  182: '1.8.2',
  280: '2.8.0',
  281: '2.8.1',
  282: '2.8.2',
}

/**
 * What a household's points offer to pick from, in Home Assistant's shape so
 * the connect screens share their sensor picker: one entry per register.
 */
export function enelogicStatistics(
  points: readonly { point: EnelogicPoint; rates: readonly number[] }[],
): HaStatistic[] {
  return points.flatMap(({ point, rates }) =>
    rates.flatMap((rate) => {
      if (!enelogicRateChannel(rate, point.gas)) return []
      return [
        {
          id: enelogicRef(point.id, rate),
          name: `${point.label} · ${RATE_NAMES[rate] ?? rate}`,
          measure: point.gas ? ('volume' as const) : ('energy' as const),
        },
      ]
    }),
  )
}

export interface EnelogicProposal {
  kind: EnergyChannelKind
  tariff?: EnergyTariff
  statisticId: string
}

/**
 * The channels to propose: from the power point read most recently, its two
 * tariffs where it has them and else its total, both ways; from the gas point
 * read most recently, its one register.
 */
export function enelogicProposals(
  points: readonly { point: EnelogicPoint; rates: readonly number[] }[],
): EnelogicProposal[] {
  const newest = (gas: boolean) =>
    points
      .filter((each) => each.point.gas === gas && each.rates.length > 0)
      .sort((a, b) =>
        (b.point.latest ?? '').localeCompare(a.point.latest ?? ''),
      )[0]
  const proposals: EnelogicProposal[] = []
  const power = newest(false)
  if (power) {
    const has = (rate: number) => power.rates.includes(rate)
    const pick = (split: [number, number], total: number) =>
      has(split[0]) && has(split[1]) ? split : has(total) ? [total] : []
    for (const rate of [
      ...pick([ENELOGIC_RATES.importT1, ENELOGIC_RATES.importT2], 180),
      ...pick([ENELOGIC_RATES.exportT1, ENELOGIC_RATES.exportT2], 280),
    ]) {
      const channel = enelogicRateChannel(rate, false)
      if (channel) {
        proposals.push({
          ...channel,
          statisticId: enelogicRef(power.point.id, rate),
        })
      }
    }
  }
  const gas = newest(true)
  if (gas?.rates.includes(ENELOGIC_RATES.importTotal)) {
    proposals.push({
      kind: 'gas',
      statisticId: enelogicRef(gas.point.id, ENELOGIC_RATES.importTotal),
    })
  }
  return proposals
}
