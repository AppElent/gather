/**
 * Home Assistant as an Energy source (APP-495): which channels its Energy
 * dashboard proposes, and how its hourly statistics become hourly amounts.
 * Pure and dependency-free (ADR-0016). Everything that arrives from Home
 * Assistant is untrusted JSON, so each reader here takes `unknown`.
 */

const HOUR_MS = 3_600_000

export type EnergyChannelKind =
  | 'gridImport'
  | 'gridExport'
  | 'solar'
  | 'batteryCharge'
  | 'batteryDischarge'
  | 'batterySoc'
  | 'gas'
export type EnergyTariff = 't1' | 't2'
export type EnergyUnit = 'kWh' | 'm3' | 'percent'

export const ENERGY_CHANNEL_ORDER: readonly EnergyChannelKind[] = [
  'gridImport',
  'gridExport',
  'solar',
  'batteryCharge',
  'batteryDischarge',
  'batterySoc',
  'gas',
]

export function energyChannelUnit(kind: EnergyChannelKind): EnergyUnit {
  if (kind === 'gas') return 'm3'
  return kind === 'batterySoc' ? 'percent' : 'kWh'
}

/**
 * Two channels of one kind measure the same thing when their tariffs are
 * equal or when either counts every tariff.
 */
export function energyChannelsOverlap(
  a: { kind: EnergyChannelKind; tariff?: EnergyTariff },
  b: { kind: EnergyChannelKind; tariff?: EnergyTariff },
): boolean {
  return (
    a.kind === b.kind && (!a.tariff || !b.tariff || a.tariff === b.tariff)
  )
}

/**
 * Whether a typed meter is overdue: no reading for two weeks. Shown in
 * `danger` words under Sources.
 */
export const ENERGY_READING_OVERDUE_DAYS = 14
export function energyReadingOverdue(
  lastReadingAt: number | null,
  now: number,
): boolean {
  return (
    lastReadingAt === null ||
    now - lastReadingAt > ENERGY_READING_OVERDUE_DAYS * 24 * HOUR_MS
  )
}

// -- Errors ---------------------------------------------------------------------

/**
 * Why a source is not up to date. Stored as a code in `lastError`, said in
 * words in the reader's language.
 */
export const ENERGY_SOURCE_PROBLEMS = [
  /** Nothing answers at the address, or not in time. */
  'unreachable',
  /** Something answers, but it is not Home Assistant. */
  'notHomeAssistant',
  /** Home Assistant refuses the token. */
  'badToken',
  /** Reading or storing went wrong on Gather's side. */
  'syncFailed',
  /** One or more chosen statistics no longer exist. */
  'statisticMissing',
  /** An admin disconnected it. */
  'disconnected',
] as const
export type EnergySourceProblem = (typeof ENERGY_SOURCE_PROBLEMS)[number]

/** Reads a stored `lastError`; an unknown value reads as `unreachable`. */
export function readEnergySourceProblem(
  stored: string | undefined,
): { problem: EnergySourceProblem; statistics: string[] } | null {
  if (!stored) return null
  const [code, rest = ''] = splitOnce(stored, '|')
  const problem =
    ENERGY_SOURCE_PROBLEMS.find((each) => each === code) ?? 'unreachable'
  return { problem, statistics: rest ? rest.split(',') : [] }
}

export function energySourceProblemValue(
  problem: EnergySourceProblem,
  statistics: readonly string[] = [],
): string {
  return statistics.length ? `${problem}|${statistics.join(',')}` : problem
}

function splitOnce(text: string, separator: string): [string, string?] {
  const at = text.indexOf(separator)
  return at < 0 ? [text] : [text.slice(0, at), text.slice(at + 1)]
}

// -- Statistics -----------------------------------------------------------------

export interface HaStatistic {
  id: string
  name: string | null
  /** What it measures, as far as Energy can use it. */
  measure: 'energy' | 'volume' | 'percent'
}

const ENERGY_UNITS = /^(m|k|M|G|T)?Wh$|^(k|M|G)?J$|^(k|M|G)?cal$/
const VOLUME_UNITS = /^(m³|m3|ft³|CCF|MCF|L)$/

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

/** The longest statistic id and name kept; Home Assistant's own cap is 255. */
const TEXT_LIMIT = 255

/**
 * The statistics of `recorder/list_statistic_ids` that a channel can read:
 * counters of energy or volume, and averages of a percentage.
 */
export function readHaStatistics(raw: unknown): HaStatistic[] {
  if (!Array.isArray(raw)) return []
  const found: HaStatistic[] = []
  for (const each of raw) {
    const row = record(each)
    const id = text(row?.statistic_id)
    if (!row || !id || id.length > TEXT_LIMIT) continue
    const unit =
      text(row.statistics_unit_of_measurement) ??
      text(row.display_unit_of_measurement) ??
      ''
    const unitClass = text(row.unit_class)
    const name = text(row.name)?.slice(0, TEXT_LIMIT) ?? null
    const mean =
      row.has_mean === true ||
      (typeof row.mean_type === 'number' && row.mean_type > 0)
    if (row.has_sum === true) {
      if (unitClass === 'energy' || ENERGY_UNITS.test(unit)) {
        found.push({ id, name, measure: 'energy' })
      } else if (unitClass === 'volume' || VOLUME_UNITS.test(unit)) {
        found.push({ id, name, measure: 'volume' })
      }
    } else if (mean && unit === '%') {
      found.push({ id, name, measure: 'percent' })
    }
  }
  return found
}

/** Whether a statistic measures what a channel of this kind holds. */
export function haStatisticFits(
  statistic: Pick<HaStatistic, 'measure'>,
  kind: EnergyChannelKind,
): boolean {
  const wanted =
    kind === 'gas' ? 'volume' : kind === 'batterySoc' ? 'percent' : 'energy'
  return statistic.measure === wanted
}

// -- The Energy dashboard's preferences -------------------------------------------

export interface HaProposal {
  kind: EnergyChannelKind
  tariff?: EnergyTariff
  statisticId: string
  /** False when Home Assistant keeps no usable statistic under this id. */
  available: boolean
  /** False for a guess the dashboard did not name (a battery's charge level). */
  fromDashboard: boolean
}

const T1 = /(?:^|[._-])(?:tariff?|tarief|t)[_-]?1(?:[._-]|$)|(?:^|[._-])(?:low|laag|dal|off_?peak)(?:[._-]|$)/i
const T2 = /(?:^|[._-])(?:tariff?|tarief|t)[_-]?2(?:[._-]|$)|(?:^|[._-])(?:high|hoog|normaal|normal|peak)(?:[._-]|$)/i

function tariffOf(id: string): EnergyTariff | undefined {
  if (T1.test(id)) return 't1'
  return T2.test(id) ? 't2' : undefined
}

/** A pair of counters is a split meter only when one is T1 and one is T2. */
function withTariffs(
  kind: 'gridImport' | 'gridExport',
  ids: readonly string[],
): { kind: EnergyChannelKind; tariff?: EnergyTariff; id: string }[] {
  const tariffs = ids.map(tariffOf)
  const split =
    ids.length === 2 && tariffs.includes('t1') && tariffs.includes('t2')
  return ids
    .map((id, index) => ({ kind, id, tariff: split ? tariffs[index] : undefined }))
    .sort((a, b) => (a.tariff ?? '').localeCompare(b.tariff ?? ''))
}

/** Never proposes more than this, whatever the preferences say. */
const PROPOSAL_LIMIT = 30

/**
 * The channels `energy/get_prefs` proposes. Reads both shapes of the grid
 * source: `flow_from`/`flow_to` lists, and one source per counter pair.
 */
export function energyProposals(
  prefs: unknown,
  statistics: readonly HaStatistic[],
): HaProposal[] {
  const sources = record(prefs)?.energy_sources
  if (!Array.isArray(sources)) return []
  const imports: string[] = []
  const exports: string[] = []
  const rest: { kind: EnergyChannelKind; id: string }[] = []
  let battery = false
  let soc: string | null = null

  const add = (list: string[], value: unknown) => {
    const id = text(value)
    if (id && id.length <= TEXT_LIMIT) list.push(id)
  }
  const addRest = (kind: EnergyChannelKind, value: unknown) => {
    const id = text(value)
    if (id && id.length <= TEXT_LIMIT) rest.push({ kind, id })
  }
  for (const each of sources) {
    const source = record(each)
    if (!source) continue
    switch (source.type) {
      case 'grid':
        for (const flow of list(source.flow_from)) {
          add(imports, record(flow)?.stat_energy_from)
        }
        for (const flow of list(source.flow_to)) {
          add(exports, record(flow)?.stat_energy_to)
        }
        add(imports, source.stat_energy_from)
        add(exports, source.stat_energy_to)
        break
      case 'solar':
        addRest('solar', source.stat_energy_from)
        break
      case 'battery':
        battery = true
        // Into the home is out of the battery.
        addRest('batteryDischarge', source.stat_energy_from)
        addRest('batteryCharge', source.stat_energy_to)
        soc = soc ?? text(source.stat_soc)
        break
      case 'gas':
        addRest('gas', source.stat_energy_from)
        break
    }
  }

  const byId = new Map(statistics.map((each) => [each.id, each]))
  const seen = new Set<string>()
  const proposals: HaProposal[] = []
  const propose = (
    channel: { kind: EnergyChannelKind; tariff?: EnergyTariff; id: string },
    fromDashboard: boolean,
  ) => {
    if (seen.has(channel.id) || proposals.length >= PROPOSAL_LIMIT) return
    seen.add(channel.id)
    const statistic = byId.get(channel.id)
    proposals.push({
      kind: channel.kind,
      ...(channel.tariff ? { tariff: channel.tariff } : {}),
      statisticId: channel.id,
      available: Boolean(statistic && haStatisticFits(statistic, channel.kind)),
      fromDashboard,
    })
  }
  for (const channel of withTariffs('gridImport', unique(imports))) {
    propose(channel, true)
  }
  for (const channel of withTariffs('gridExport', unique(exports))) {
    propose(channel, true)
  }
  for (const channel of rest) propose(channel, true)
  if (battery) {
    const guess = soc ?? guessSoc(statistics)
    if (guess) propose({ kind: 'batterySoc', id: guess }, soc !== null)
  }
  return proposals.sort(
    (a, b) =>
      ENERGY_CHANNEL_ORDER.indexOf(a.kind) -
        ENERGY_CHANNEL_ORDER.indexOf(b.kind) ||
      (a.tariff ?? '').localeCompare(b.tariff ?? ''),
  )
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const unique = (ids: readonly string[]) => [...new Set(ids)]

function guessSoc(statistics: readonly HaStatistic[]): string | null {
  return (
    statistics.find(
      (each) =>
        each.measure === 'percent' &&
        /(?:^|[._])(?:soc|state_of_charge|laadstand|laadtoestand)(?:[._]|$)/i.test(
          each.id,
        ),
    )?.id ?? null
  )
}

// -- Hourly amounts ---------------------------------------------------------------

export interface HaHour {
  hourStart: number
  sum: number | null
  mean: number | null
}

/** One statistic's rows, oldest first; a row without a usable hour is dropped. */
export function readHaHours(raw: unknown): HaHour[] {
  const hours = new Map<number, HaHour>()
  for (const each of list(raw)) {
    const row = record(each)
    if (!row) continue
    const start =
      typeof row.start === 'number'
        ? row.start
        : typeof row.start === 'string'
          ? Date.parse(row.start)
          : Number.NaN
    if (!Number.isFinite(start)) continue
    const hourStart = Math.floor(start / HOUR_MS) * HOUR_MS
    hours.set(hourStart, {
      hourStart,
      sum: finite(row.sum),
      mean: finite(row.mean),
    })
  }
  return [...hours.values()].sort((a, b) => a.hourStart - b.hourStart)
}

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * Hourly amounts from a counter's running `sum`: each hour is the difference
 * with the hour before it. `baseline` is the sum before the first row, or
 * null to let the first row be the baseline itself.
 *
 * Home Assistant already carries `sum` across a meter that restarts at zero.
 * Should it drop anyway (a corrected or re-imported statistic), that hour
 * counts nothing and the next one counts from there: usage is never negative.
 * Hours Home Assistant missed land on the next hour it has, as they do in its
 * own dashboard. Hours are UTC, so a day of 23 or 25 of them needs no care
 * here.
 */
export function hourlyAmountsFromSums(
  hours: readonly HaHour[],
  baseline: number | null,
): { amounts: { hourStart: number; amount: number }[]; baseline: number | null } {
  let previous = baseline
  const amounts: { hourStart: number; amount: number }[] = []
  for (const hour of hours) {
    if (hour.sum === null) continue
    if (previous !== null) {
      const amount = Math.max(0, hour.sum - previous)
      // Six decimals: a thousandth of a watt-hour, without the float noise.
      amounts.push({
        hourStart: hour.hourStart,
        amount: Math.round(amount * 1e6) / 1e6,
      })
    }
    previous = hour.sum
  }
  return { amounts, baseline: previous }
}

/** Hourly averages of a level (a battery's charge), kept as they are. */
export function hourlyLevels(
  hours: readonly HaHour[],
): { hourStart: number; amount: number }[] {
  return hours.flatMap((hour) =>
    hour.mean === null ? [] : [{ hourStart: hour.hourStart, amount: hour.mean }],
  )
}
