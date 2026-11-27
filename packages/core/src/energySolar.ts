/**
 * Solar and battery (APP-496): what the roof made, what the home used of it,
 * what the battery earned and what each asset has paid back. Pure and
 * dependency-free (ADR-0016). Everything comes from hours; a site with only
 * typed readings has none of it.
 */
import { addDays, parseIsoDate } from './civilDate'
import { energyImportPrice } from './energyPrices'
import {
  addEnergyMonths,
  type EnergyContractTerms,
  type EnergyElectricityPrice,
  energyMonthOf,
  parseMeterReading,
} from './energyUsage'

// -- Assets ------------------------------------------------------------------------

export type EnergyAssetKind = 'solar' | 'battery'

export const ENERGY_ASSET_LIMITS = {
  name: 40,
  /** 100 kWp and 1,000 kWh: far past any home, so a slip of a zero is caught. */
  peakWatt: 100_000,
  capacityKwh: 1_000,
  purchaseCents: 100_000_000,
  perSite: 20,
} as const

export interface EnergyAssetTerms {
  kind: EnergyAssetKind
  name: string
  /** Solar only. */
  peakWatt?: number
  /** Battery only. */
  capacityKwh?: number
  installedOn?: string
  purchaseCents?: number
}

export type EnergyAssetProblem =
  | 'assetNeedsName'
  | 'tooLong'
  | 'assetInvalid'
  | 'assetInFuture'

/**
 * An amount as somebody typed it, NaN when it is no number. Three digits after
 * the last mark are a thousand, not a fraction: `5.200` watts or euros is five
 * thousand two hundred in Dutch, and `5,200` is in English.
 */
function wholeAmount(text: string): number {
  const trimmed = text.trim().replace(/\s/g, '')
  if (/^\d{1,3}([.,]\d{3})+$/.test(trimmed)) {
    return Number(trimmed.replace(/[.,]/g, ''))
  }
  return parseMeterReading(trimmed) ?? Number.NaN
}

/** What a form holds for an asset, as typed. Blank is left out, not zero. */
export function energyAssetFromText(text: {
  kind: EnergyAssetTerms['kind']
  name: string
  peakWatt: string
  capacityKwh: string
  installedOn: string | null
  purchaseEur: string
}): EnergyAssetTerms {
  const typed = (value: string, parse: (text: string) => number) =>
    value.trim() ? parse(value) : undefined
  const euros = typed(text.purchaseEur, wholeAmount)
  return {
    kind: text.kind,
    name: text.name,
    peakWatt:
      text.kind === 'solar' ? typed(text.peakWatt, wholeAmount) : undefined,
    capacityKwh:
      text.kind === 'battery'
        ? typed(
            text.capacityKwh,
            (value) => parseMeterReading(value) ?? Number.NaN,
          )
        : undefined,
    installedOn: text.installedOn || undefined,
    purchaseCents: euros === undefined ? undefined : euros * 100,
  }
}

/** The asset as it is stored, or why it cannot be. */
export function checkEnergyAsset(
  asset: EnergyAssetTerms,
  today: string,
): { asset: EnergyAssetTerms } | { problem: EnergyAssetProblem } {
  const name = asset.name.trim()
  if (!name) return { problem: 'assetNeedsName' }
  if (name.length > ENERGY_ASSET_LIMITS.name) return { problem: 'tooLong' }
  const within = (value: number | undefined, max: number) =>
    value === undefined || (Number.isFinite(value) && value > 0 && value <= max)
  const peakWatt = asset.kind === 'solar' ? asset.peakWatt : undefined
  const capacityKwh = asset.kind === 'battery' ? asset.capacityKwh : undefined
  const purchaseCents =
    asset.purchaseCents === undefined
      ? undefined
      : Math.round(asset.purchaseCents)
  if (
    !within(peakWatt, ENERGY_ASSET_LIMITS.peakWatt) ||
    !within(capacityKwh, ENERGY_ASSET_LIMITS.capacityKwh) ||
    !within(purchaseCents, ENERGY_ASSET_LIMITS.purchaseCents)
  ) {
    return { problem: 'assetInvalid' }
  }
  if (asset.installedOn !== undefined) {
    if (!parseIsoDate(asset.installedOn)) return { problem: 'assetInvalid' }
    if (asset.installedOn > today) return { problem: 'assetInFuture' }
  }
  return {
    asset: {
      kind: asset.kind,
      name,
      peakWatt,
      capacityKwh,
      installedOn: asset.installedOn,
      purchaseCents,
    },
  }
}

// -- Price of an hour ----------------------------------------------------------------

/**
 * What a kWh from the grid costs in an hour, all-in; null while it is not
 * known. A fixed contract's dal price is for hours its meter counts on T1.
 */
export function energyHourImportPrice(
  contract: EnergyContractTerms | undefined,
  price: EnergyElectricityPrice,
  tariff: 't1' | 't2',
): number | null {
  if (!contract) return null
  if (contract.kind === 'fixed') {
    if (!contract.fixedTariffs) return null
    return (
      (contract.fixedTariffs[tariff] + contract.energyTaxEurPerKwh) *
      (1 + contract.vatPercent / 100)
    )
  }
  if (price.allInEurPerKwh !== undefined) return price.allInEurPerKwh
  return price.marketEurPerKwh === null
    ? null
    : energyImportPrice(price.marketEurPerKwh, contract)
}

// -- A day ---------------------------------------------------------------------------

/** One hour as it was measured. Null where the site's meters have no figure. */
export interface EnergySolarHour {
  importKwh: number | null
  exportKwh: number | null
  solarKwh: number | null
  chargeKwh: number | null
  dischargeKwh: number | null
  /** What a kWh from the grid cost, all-in. */
  importPrice: number | null
}

export interface EnergyBatteryDay {
  chargeKwh: number
  dischargeKwh: number
  /** Charged and discharged at each hour's price; null without prices or one of the two. */
  chargeEur: number | null
  dischargeEur: number | null
}

export interface EnergySolarDay {
  day: string
  /** Null where the day's hours have no such figure. */
  producedKwh: number | null
  /** Of what was produced: used at home (or charged), and sent back. */
  selfUsedKwh: number | null
  returnedKwh: number | null
  /** What self-used solar would have cost from the grid; null without prices. */
  selfUsedEur: number | null
  /** What the home used, and how much of it did not come from the grid. */
  consumptionKwh: number | null
  ownKwh: number | null
  battery: EnergyBatteryDay | null
}

/**
 * A day from its hours. Self-use needs solar, import and export measured in
 * the same hour: an hour without one of them counts for none of it, so a
 * meter connected later never reads as a home that sent nothing back.
 */
export function energySolarDay(
  day: string,
  hours: readonly EnergySolarHour[],
): EnergySolarDay {
  const solar = hours.filter((hour) => hour.solarKwh !== null)
  const whole = solar.filter(
    (hour) => hour.importKwh !== null && hour.exportKwh !== null,
  )
  const complete = whole.length > 0
  let returned = 0
  let selfUsed = 0
  let selfUsedEur: number | null = 0
  let consumption = 0
  let imported = 0
  for (const hour of whole) {
    const made = hour.solarKwh ?? 0
    // A battery can send power back too; that is not the roof's.
    const back = Math.min(made, hour.exportKwh ?? 0)
    const used = made - back
    returned += back
    selfUsed += used
    if (used > 0) {
      selfUsedEur =
        selfUsedEur === null || hour.importPrice === null
          ? null
          : selfUsedEur + used * hour.importPrice
    }
    imported += hour.importKwh ?? 0
    consumption +=
      (hour.importKwh ?? 0) -
      (hour.exportKwh ?? 0) +
      made +
      (hour.dischargeKwh ?? 0) -
      (hour.chargeKwh ?? 0)
  }
  return {
    day,
    producedKwh: solar.length
      ? solar.reduce((total, hour) => total + (hour.solarKwh ?? 0), 0)
      : null,
    selfUsedKwh: complete ? selfUsed : null,
    returnedKwh: complete ? returned : null,
    selfUsedEur: complete ? selfUsedEur : null,
    consumptionKwh: complete ? Math.max(0, consumption) : null,
    ownKwh: complete ? Math.max(0, consumption - imported) : null,
    battery: batteryDay(hours),
  }
}

/**
 * Charged and discharged at each hour's own price. The value is one minus the
 * other; a day with an hour that has no price, or with only one of the two
 * measured, has no value, never a guess.
 */
function batteryDay(hours: readonly EnergySolarHour[]): EnergyBatteryDay | null {
  const measured = hours.filter(
    (hour) => hour.chargeKwh !== null || hour.dischargeKwh !== null,
  )
  if (measured.length === 0) return null
  let chargeKwh = 0
  let dischargeKwh = 0
  let chargeEur = 0
  let dischargeEur = 0
  let priced =
    hours.some((hour) => hour.chargeKwh !== null) &&
    hours.some((hour) => hour.dischargeKwh !== null)
  for (const hour of measured) {
    const charge = hour.chargeKwh ?? 0
    const discharge = hour.dischargeKwh ?? 0
    chargeKwh += charge
    dischargeKwh += discharge
    if (charge === 0 && discharge === 0) continue
    if (hour.importPrice === null) {
      priced = false
      continue
    }
    chargeEur += charge * hour.importPrice
    dischargeEur += discharge * hour.importPrice
  }
  return {
    chargeKwh,
    dischargeKwh,
    chargeEur: priced ? chargeEur : null,
    dischargeEur: priced ? dischargeEur : null,
  }
}

// -- A period --------------------------------------------------------------------------

export interface EnergySolarTotals {
  producedKwh: number | null
  selfUsedKwh: number | null
  returnedKwh: number | null
  selfUsedPercent: number | null
  /** How much of the home's use came from its own roof and battery, 0–100. */
  selfSufficiency: number | null
  battery: {
    chargeKwh: number
    dischargeKwh: number
    /** Euros per kWh, over the days with prices. */
    chargePrice: number | null
    dischargePrice: number | null
    /** Discharged minus charged, over the days with prices. */
    valueEur: number | null
    /** Days with battery use and no price for one of their hours. */
    unpricedDays: number
  } | null
}

const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : null

/** Self-sufficiency of one day, 0–100. */
export function energySelfSufficiency(
  day: Pick<EnergySolarDay, 'consumptionKwh' | 'ownKwh'>,
): number | null {
  return day.consumptionKwh === null || day.ownKwh === null
    ? null
    : percentOf(day.ownKwh, day.consumptionKwh)
}

export function energySolarTotals(
  days: readonly EnergySolarDay[],
): EnergySolarTotals {
  const sum = (values: readonly (number | null)[]): number | null => {
    const known = values.filter((value) => value !== null)
    return known.length ? known.reduce((a, b) => a + b, 0) : null
  }
  // The three facts and the share are over the same days, so they add up.
  const complete = days.filter((day) => day.selfUsedKwh !== null)
  const produced = sum(
    complete.length
      ? complete.map((day) => (day.selfUsedKwh ?? 0) + (day.returnedKwh ?? 0))
      : days.map((day) => day.producedKwh),
  )
  const selfUsed = sum(complete.map((day) => day.selfUsedKwh))
  const own = sum(complete.map((day) => day.ownKwh))
  const consumption = sum(complete.map((day) => day.consumptionKwh))
  const batteries = days.flatMap((day) => (day.battery ? [day.battery] : []))
  const priced = batteries.filter(
    (battery) => battery.chargeEur !== null && battery.dischargeEur !== null,
  )
  const chargeEur = sum(priced.map((battery) => battery.chargeEur))
  const dischargeEur = sum(priced.map((battery) => battery.dischargeEur))
  const average = (eur: number | null, kwh: number | null) =>
    eur === null || !kwh ? null : eur / kwh
  return {
    producedKwh: produced,
    selfUsedKwh: selfUsed,
    returnedKwh: sum(complete.map((day) => day.returnedKwh)),
    selfUsedPercent:
      selfUsed === null || produced === null ? null : percentOf(selfUsed, produced),
    selfSufficiency:
      own === null || consumption === null ? null : percentOf(own, consumption),
    battery: batteries.length
      ? {
          chargeKwh: sum(batteries.map((each) => each.chargeKwh)) ?? 0,
          dischargeKwh: sum(batteries.map((each) => each.dischargeKwh)) ?? 0,
          chargePrice: average(chargeEur, sum(priced.map((each) => each.chargeKwh))),
          dischargePrice: average(
            dischargeEur,
            sum(priced.map((each) => each.dischargeKwh)),
          ),
          valueEur:
            chargeEur === null || dischargeEur === null
              ? null
              : dischargeEur - chargeEur,
          unpricedDays: batteries.length - priced.length,
        }
      : null,
  }
}

// -- Payback -----------------------------------------------------------------------------

/** What a day earned, per kind of asset, in euros; null when it is not known. */
export interface EnergyPaybackDay {
  day: string
  solarEur: number | null
  batteryEur: number | null
  /** The day was measured, so a null above is a missing price. */
  solarMeasured: boolean
  batteryMeasured: boolean
}

/** A day of `energySolar.month` as payback counts it. */
export function energyPaybackDayOf(day: {
  day: string
  solarEur: number | null
  batteryEur: number | null
  selfUsedKwh: number | null
  battery: object | null
}): EnergyPaybackDay {
  return {
    day: day.day,
    solarEur: day.solarEur,
    batteryEur: day.batteryEur,
    solarMeasured: day.selfUsedKwh !== null,
    batteryMeasured: day.battery !== null,
  }
}

export interface EnergyPaybackAsset {
  kind: EnergyAssetKind
  peakWatt?: number
  capacityKwh?: number
  installedOn?: string
  purchaseCents?: number
}

export interface EnergyPayback {
  earnedCents: number
  purchaseCents: number
  /**
   * The first day that counts: Gather's first figures, or the installation.
   * With no counted day, the first measured one.
   */
  since: string
  /** Days that earned a known amount. */
  countedDays: number
  /** Measured days left out: no price, or a battery measured one way only. */
  missingDays: number
}

const sizeOf = (asset: EnergyPaybackAsset) =>
  asset.kind === 'solar' ? asset.peakWatt : asset.capacityKwh

/**
 * What an asset has paid back of its price, or null without a price or without
 * one measured day. Measured days without an amount are counted as missing,
 * also when no day has one, so the reason is not lost (APP-920). Assets of one kind share its day by size, or evenly
 * when one has no size; each counts from the day it was installed.
 */
export function energyPayback<T extends EnergyPaybackAsset>(
  asset: T,
  assets: readonly T[],
  days: readonly EnergyPaybackDay[],
): EnergyPayback | null {
  if (asset.purchaseCents === undefined) return null
  let earned = 0
  let since = ''
  let firstMeasured = ''
  let countedDays = 0
  let missingDays = 0
  for (const day of days) {
    if (asset.installedOn && day.day < asset.installedOn) continue
    const measured =
      asset.kind === 'solar' ? day.solarMeasured : day.batteryMeasured
    if (!measured) continue
    if (!firstMeasured || day.day < firstMeasured) firstMeasured = day.day
    const eur = asset.kind === 'solar' ? day.solarEur : day.batteryEur
    if (eur === null) {
      missingDays += 1
      continue
    }
    countedDays += 1
    const running = assets.filter(
      (each) =>
        each.kind === asset.kind &&
        (!each.installedOn || each.installedOn <= day.day),
    )
    const sizes = running.map(sizeOf)
    const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0)
    const share =
      total > 0 && sizes.every((size) => size !== undefined)
        ? (sizeOf(asset) ?? 0) / total
        : 1 / Math.max(1, running.length)
    earned += eur * share
    if (!since || day.day < since) since = day.day
  }
  if (!firstMeasured) return null
  return {
    earnedCents: Math.round(earned * 100),
    purchaseCents: asset.purchaseCents,
    since: since || firstMeasured,
    countedDays,
    missingDays,
  }
}

/**
 * The months a payback adds up, oldest first: from the first day Gather has
 * figures for (or every asset with a price was installed) to this month.
 */
export function energyPaybackMonths(
  assets: readonly EnergyPaybackAsset[],
  firstDay: string | null,
  today: string,
): string[] {
  const priced = assets.filter((asset) => asset.purchaseCents !== undefined)
  if (priced.length === 0 || firstDay === null || firstDay > today) return []
  const installed = priced.map((asset) => asset.installedOn ?? firstDay).sort()
  const from = [firstDay, installed[0] ?? firstDay].sort()[1] ?? firstDay
  const months: string[] = []
  for (
    let month = energyMonthOf(from);
    month <= energyMonthOf(today);
    month = addEnergyMonths(month, 1)
  ) {
    months.push(month)
  }
  return months
}

/** `today` for a month's query: its own last day once it is over, so it is cached. */
export function energyMonthToday(month: string, today: string): string {
  const last = addDays(`${addEnergyMonths(month, 1)}-01`, -1)
  return last < today ? last : today
}

// -- The battery's hours -------------------------------------------------------------------

export type EnergyBatteryMode =
  | 'charging'
  | 'discharging'
  | 'idle'
  /** Still to come. */
  | 'future'
  /** Past, and not measured. */
  | 'unknown'

/** Under this many kWh an hour a battery is resting, not working. */
const IDLE_KWH = 0.05

/** What the battery did each hour, for the strip under its state of charge. */
export function energyBatteryModes(
  hours: readonly {
    hourStart: number
    batteryChargeKwh: number | null
    batteryDischargeKwh: number | null
  }[],
  now: number,
): EnergyBatteryMode[] {
  return hours.map((hour) => {
    if (hour.hourStart > now) return 'future'
    if (hour.batteryChargeKwh === null && hour.batteryDischargeKwh === null) {
      return 'unknown'
    }
    const net = (hour.batteryDischargeKwh ?? 0) - (hour.batteryChargeKwh ?? 0)
    if (Math.abs(net) < IDLE_KWH) return 'idle'
    return net > 0 ? 'discharging' : 'charging'
  })
}

/** The stretches of one mode, as [from, to) indexes, in order. */
export function energyModeRuns(
  modes: readonly EnergyBatteryMode[],
  mode: EnergyBatteryMode,
): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = []
  for (const [index, each] of modes.entries()) {
    if (each !== mode) continue
    const last = runs[runs.length - 1]
    if (last && last.to === index) last.to = index + 1
    else runs.push({ from: index, to: index + 1 })
  }
  return runs
}
