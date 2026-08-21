/**
 * What the quick-log sheet asks, per event type, and what it sends.
 *
 * The sheet is a row of chips and steppers rather than a form: a phone at 3am
 * wants one tap per decision, not a keyboard. So every field has a **pre-filled
 * default drawn from the last event of that type** — a person who always gives
 * 120 ml sees 120 ml already there and taps Save.
 *
 * Pre-filling from the last event, rather than logging instantly with it, is
 * the deliberate middle: almost every type needs *something* (a diaper needs
 * wet or dirty), so an instant log would guess on most of them. Pre-filling
 * makes the guess visible and correctable instead of silent.
 *
 * **A preset never closes the door.** The quick values on a numeric row are
 * shortcuts sitting above a stepper whose value can also be typed, so 120 ml is
 * one tap and 137 ml is still reachable. Only genuinely closed sets — which
 * breast, what was in the diaper — are chips-only, because those have no
 * seventh answer to reach for.
 *
 * **A unit belongs to a method, not to a type.** Breastfeeding is measured in
 * minutes, a bottle in millilitres and solid food in grams, so the second row
 * of a feed depends on the first: `fieldsFor` resolves that, and nothing asks
 * for millilitres of breast milk nobody poured.
 *
 * Pure and message-free: labels arrive as a parameter (ADR-0011's third rule),
 * which is what lets this be tested with no React tree and no device.
 */
import type { BabyEventType } from '@gather/core/domain'

export interface SheetField {
  /** Where the chosen value lands in the event's `data`. */
  key: string
  /** The message key for the row's label, under `baby.log.fields`. */
  labelKey: string
  /**
   * `chips` for a closed set, `number` for a stepper with quick presets,
   * `text` for a name nobody can enumerate.
   */
  input: 'chips' | 'text' | 'number'
  /** The closed set (`chips`) or the quick values above the stepper (`number`). */
  options: string[]
  /** Used when nothing of this type has been logged before. */
  fallback: string
  /** What one press of − or + changes a `number` field by. */
  step?: number
  min?: number
  max?: number
  /** How many decimals the stepper renders and rounds to. */
  decimals?: number
  /** The unit shown beside the value. Not translated: `ml`, `g`, `°C`. */
  unit?: string
  /** Shown only while a sibling field holds one of these values. */
  when?: { key: string; is: string[] }
  /**
   * Starts empty rather than at the last value. For measurements: repeating
   * last month's weight is a wrong reading, not a helpful default.
   */
  blankStart?: boolean
  /** UI-only — carried in picks but never written into `data`. */
  transient?: boolean
}

export type SheetSpec = readonly SheetField[]

/**
 * What each type asks for.
 *
 * `note` asks nothing — a note is its text, and the sheet's notes box already
 * carries that. Sleep asks for a duration in hours and minutes, which is not
 * part of `data` at all: it becomes the entry's `endTimestamp`, because that is
 * where the schema keeps the end of a sleep.
 */
export const SHEET_SPECS: Record<BabyEventType, SheetSpec> = {
  temperature: [
    {
      key: 'celsius',
      labelKey: 'temperature',
      input: 'number',
      options: ['36.5', '37.0', '37.5', '38.0', '38.5'],
      fallback: '37.0',
      step: 0.1,
      min: 34,
      max: 42,
      decimals: 1,
      unit: '°C',
    },
    {
      key: 'method',
      labelKey: 'method',
      input: 'chips',
      options: ['oral', 'ear', 'forehead', 'axillary', 'rectal'],
      fallback: 'ear',
    },
  ],
  feeding: [
    {
      key: 'method',
      labelKey: 'method',
      input: 'chips',
      options: ['breast', 'bottle', 'solid'],
      fallback: 'bottle',
    },
    // Per side rather than one total: "both sides, 20 minutes" cannot be split
    // into two numbers without inventing one of them, and `side` is derived
    // from whichever sides got minutes.
    {
      key: 'leftMin',
      labelKey: 'leftMin',
      input: 'number',
      options: [],
      fallback: '0',
      step: 1,
      min: 0,
      max: 180,
      decimals: 0,
      unit: 'min',
      when: { key: 'method', is: ['breast'] },
    },
    {
      key: 'rightMin',
      labelKey: 'rightMin',
      input: 'number',
      options: [],
      fallback: '0',
      step: 1,
      min: 0,
      max: 180,
      decimals: 0,
      unit: 'min',
      when: { key: 'method', is: ['breast'] },
    },
    {
      key: 'amountMl',
      labelKey: 'amountMl',
      input: 'number',
      options: ['60', '90', '120', '150', '180'],
      fallback: '120',
      step: 10,
      min: 0,
      max: 1000,
      decimals: 0,
      unit: 'ml',
      when: { key: 'method', is: ['bottle'] },
    },
    {
      key: 'amountG',
      labelKey: 'amountG',
      input: 'number',
      options: ['25', '50', '75', '100'],
      fallback: '50',
      step: 5,
      min: 0,
      max: 1000,
      decimals: 0,
      unit: 'g',
      when: { key: 'method', is: ['solid'] },
    },
  ],
  diaper: [
    {
      key: 'kind',
      labelKey: 'kind',
      input: 'chips',
      options: ['wet', 'dirty', 'both'],
      fallback: 'wet',
    },
  ],
  sleep: [
    {
      key: 'durationH',
      labelKey: 'durationHours',
      input: 'number',
      options: [],
      fallback: '0',
      step: 1,
      min: 0,
      max: 23,
      decimals: 0,
      unit: 'h',
      transient: true,
    },
    {
      key: 'durationM',
      labelKey: 'durationMinutes',
      input: 'number',
      options: [],
      fallback: '0',
      step: 5,
      min: 0,
      max: 59,
      decimals: 0,
      unit: 'min',
      transient: true,
    },
  ],
  note: [],
  growth: [
    {
      key: 'weightKg',
      labelKey: 'weightKg',
      input: 'number',
      options: [],
      fallback: '',
      step: 0.05,
      min: 0,
      max: 100,
      decimals: 2,
      unit: 'kg',
      blankStart: true,
    },
    {
      key: 'heightCm',
      labelKey: 'heightCm',
      input: 'number',
      options: [],
      fallback: '',
      step: 0.5,
      min: 0,
      max: 150,
      decimals: 1,
      unit: 'cm',
      blankStart: true,
    },
    {
      key: 'headCircumferenceCm',
      labelKey: 'headCm',
      input: 'number',
      options: [],
      fallback: '',
      step: 0.1,
      min: 0,
      max: 80,
      decimals: 1,
      unit: 'cm',
      blankStart: true,
    },
  ],
  medication: [
    {
      key: 'name',
      labelKey: 'medicationName',
      input: 'text',
      options: [],
      fallback: '',
    },
    {
      key: 'doseAmount',
      labelKey: 'doseAmount',
      input: 'number',
      options: [],
      fallback: '',
      step: 0.5,
      min: 0,
      max: 1000,
      decimals: 2,
      blankStart: true,
    },
    {
      key: 'doseUnit',
      labelKey: 'doseUnit',
      input: 'text',
      options: [],
      fallback: '',
    },
  ],
  vaccination: [
    {
      key: 'name',
      labelKey: 'vaccineName',
      input: 'text',
      options: [],
      fallback: '',
    },
  ],
  // One sentence, and it starts empty every time: "first laugh" is exactly
  // the value you must never inherit from the last memory.
  memory: [
    {
      key: 'what',
      labelKey: 'what',
      input: 'text',
      options: [],
      fallback: '',
      blankStart: true,
    },
  ],
}

/**
 * The rows to draw for the values currently picked.
 *
 * Conditional rows are filtered rather than disabled: a greyed-out millilitre
 * row under a breastfeed is a control that answers a question nobody asked.
 */
export function fieldsFor(
  type: BabyEventType,
  picks: Record<string, string>,
): SheetField[] {
  return SHEET_SPECS[type].filter(
    (field) => !field.when || field.when.is.includes(picks[field.when.key]),
  )
}

/**
 * The one required box this type has, when it is still empty.
 *
 * A key rather than a sentence (ADR-0011's fourth rule): the sheet resolves
 * it. These are the three types whose `data` the mutation refuses outright —
 * before this, an empty medication name reached the server and came back as
 * "could not save this entry", which is true and tells nobody which box.
 */
export function missingRequired(
  type: BabyEventType,
  picks: Record<string, string>,
): 'enterMedicationName' | 'enterVaccineName' | 'enterMemoryWhat' | null {
  const blank = (key: string) => (picks[key] ?? '').trim().length === 0
  if (type === 'medication' && blank('name')) return 'enterMedicationName'
  if (type === 'vaccination' && blank('name')) return 'enterVaccineName'
  if (type === 'memory' && blank('what')) return 'enterMemoryWhat'
  return null
}

/**
 * The visible numeric rows holding a value outside their own bounds.
 *
 * The stepper clamps, but the box can be typed into, and that is where the real
 * mistake lives: 4500 typed into a weight in kilograms is a number the schema
 * accepts, the chart plots and nobody notices until a growth curve is nonsense.
 * So the bounds are checked at save rather than silently corrected — a value
 * quietly changed from 4500 to 100 would be a different wrong number.
 */
export function outOfRangeFields(
  type: BabyEventType,
  picks: Record<string, string>,
): SheetField[] {
  return fieldsFor(type, picks).filter((field) => {
    if (field.input !== 'number') return false
    const value = parseNumber(picks[field.key])
    // An empty measurement is not out of range; it is simply not taken.
    if (value === null) return false
    return (
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    )
  })
}

/**
 * Every type, now. Kept as a function rather than inlined `true` because the
 * question ("can this be logged from the sheet?") is the one a caller asks, and
 * it stops being trivially yes the moment a type needs a photo or a timer.
 */
export function sheetHandles(_type: BabyEventType): boolean {
  return true
}

export interface PreviousEvent {
  type: BabyEventType
  timestamp: number
  endTimestamp?: number
  data: unknown
}

/** A finite number, or null for anything that is not one. */
export function parseNumber(text: string | undefined): number | null {
  if (text === undefined) return null
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** The stepper's next value, clamped and rounded to the field's precision. */
export function stepValue(
  field: SheetField,
  current: string,
  direction: 1 | -1,
): string {
  const step = field.step ?? 1
  const decimals = field.decimals ?? 0
  const from = parseNumber(current) ?? parseNumber(field.fallback) ?? 0
  // Rounded through an integer count of steps so 0.1 + 0.2 does not drift, and
  // so a typed 37.34 snaps onto the ladder rather than stepping to 37.44.
  const next = (Math.round(from / step) + direction) * step
  const clamped = Math.min(
    field.max ?? Number.POSITIVE_INFINITY,
    Math.max(field.min ?? Number.NEGATIVE_INFINITY, next),
  )
  return trimZeros(clamped.toFixed(decimals))
}

/** `6.80` → `6.8`, `37.0` → `37.0` when the field asks for a decimal. */
function trimZeros(text: string): string {
  if (!text.includes('.')) return text
  const trimmed = text.replace(/0+$/, '').replace(/\.$/, '')
  return trimmed || '0'
}

/**
 * The values each row starts on: what was recorded last time, or the fallback.
 *
 * A numeric row keeps last time's number exactly — 37.3 stays 37.3 rather than
 * snapping to the nearest preset, because a preset is a shortcut and not the
 * set of legal answers. A chip row still falls back when the stored value is
 * not one it offers, since there is nowhere else for an unknown chip to go.
 */
export function initialPicks(
  type: BabyEventType,
  previous: PreviousEvent | undefined,
): Record<string, string> {
  const spec = SHEET_SPECS[type]
  const data = (previous?.data ?? {}) as Record<string, unknown>
  const picks: Record<string, string> = {}

  for (const field of spec) {
    if (field.input === 'text' || field.blankStart) {
      // A free field starts empty rather than pre-filled: repeating last
      // month's weight is a wrong measurement, not a helpful default, and a
      // medication name you did not retype is a dose you did not check.
      picks[field.key] = ''
      continue
    }

    const last = data[field.key]
    const asText = last === undefined || last === null ? null : String(last)

    if (field.input === 'number') {
      picks[field.key] =
        asText !== null && parseNumber(asText) !== null
          ? asText
          : field.fallback
      continue
    }

    picks[field.key] =
      asText !== null && field.options.includes(asText)
        ? asText
        : field.fallback
  }

  if (type === 'sleep') {
    // Sleep's duration is not in `data` — it is the gap to `endTimestamp` —
    // so it is read back off the previous entry rather than out of its payload.
    const span =
      previous?.endTimestamp && previous.endTimestamp > previous.timestamp
        ? Math.round((previous.endTimestamp - previous.timestamp) / 60_000)
        : 0
    picks.durationH = String(Math.floor(span / 60))
    picks.durationM = String(span % 60)
  }

  return picks
}

/**
 * The rows of an entry that already exists, for editing it.
 *
 * Not `initialPicks`. That one deliberately blanks the free and `blankStart`
 * fields — a new growth entry must not arrive holding last month's weight, and
 * a medication name you did not retype is a dose you did not check. Editing is
 * the opposite case: the weight on the row *is* the weight this entry records,
 * and clearing it would turn "fix the time I typed" into "retype everything".
 *
 * So this reads every field straight back off the entry, and only falls back
 * where the entry has nothing to say.
 */
export function editPicks(
  type: BabyEventType,
  event: PreviousEvent,
): Record<string, string> {
  const picks: Record<string, string> = {}
  const data = (event.data ?? {}) as Record<string, unknown>

  for (const field of SHEET_SPECS[type]) {
    const stored = data[field.key]
    const asText = stored === undefined || stored === null ? '' : String(stored)
    if (field.input === 'chips') {
      picks[field.key] = field.options.includes(asText)
        ? asText
        : field.fallback
      continue
    }
    picks[field.key] = asText
  }

  if (type === 'sleep') {
    // As in `initialPicks`: a sleep's length is the gap to `endTimestamp`, not
    // a value in its payload.
    const span =
      event.endTimestamp && event.endTimestamp > event.timestamp
        ? Math.round((event.endTimestamp - event.timestamp) / 60_000)
        : 0
    picks.durationH = String(Math.floor(span / 60))
    picks.durationM = String(span % 60)
  }

  return picks
}

/** The most recent event of a type, for pre-filling. */
export function lastOfType(
  events: readonly PreviousEvent[],
  type: BabyEventType,
): PreviousEvent | undefined {
  return events
    .filter((e) => e.type === type)
    .reduce<PreviousEvent | undefined>(
      (latest, e) => (!latest || e.timestamp > latest.timestamp ? e : latest),
      undefined,
    )
}

/**
 * When a sleep ended, from the hours and minutes on the sheet.
 *
 * A zero duration is `undefined` and not `timestamp`: no running timer exists
 * in v1, so a sleep with no length means "how long is not recorded" rather than
 * "it lasted no time", and a zero-length nap is what the tile would otherwise
 * add up.
 */
export function endTimestampFor(
  type: BabyEventType,
  picks: Record<string, string>,
  timestamp: number,
): number | undefined {
  if (type !== 'sleep') return undefined
  const hours = parseNumber(picks.durationH) ?? 0
  const minutes = parseNumber(picks.durationM) ?? 0
  const total = Math.round(hours * 60 + minutes)
  return total > 0 ? timestamp + total * 60_000 : undefined
}

/**
 * The `data` payload for `babyEvents.add`.
 *
 * Numbers are numbers: the rows carry text so they can be typed and compared,
 * and the schema wants `celsius: 37.2` rather than `"37.2"`. A payload that
 * does not match its type is refused at the mutation (`isValidEventData`),
 * which is the check that matters — this only has to produce the right shape.
 */
export function buildSheetData(
  type: BabyEventType,
  picks: Record<string, string>,
): Record<string, unknown> {
  if (type === 'temperature') {
    return {
      celsius: parseNumber(picks.celsius) ?? 0,
      method: picks.method,
    }
  }

  if (type === 'feeding') {
    const method = picks.method
    // Each method carries only its own unit. Sending millilitres for a
    // breastfeed would record a figure nobody measured.
    if (method === 'breast') {
      const left = parseNumber(picks.leftMin) ?? 0
      const right = parseNumber(picks.rightMin) ?? 0
      const side =
        left > 0 && right > 0
          ? 'both'
          : left > 0
            ? 'left'
            : right > 0
              ? 'right'
              : undefined
      return {
        method,
        ...(side ? { side } : {}),
        ...(left > 0 ? { leftMin: left } : {}),
        ...(right > 0 ? { rightMin: right } : {}),
      }
    }
    if (method === 'bottle') {
      const ml = parseNumber(picks.amountMl)
      return { method, ...(ml !== null && ml > 0 ? { amountMl: ml } : {}) }
    }
    const grams = parseNumber(picks.amountG)
    return {
      method,
      ...(grams !== null && grams > 0 ? { amountG: grams } : {}),
    }
  }

  if (type === 'diaper') return { kind: picks.kind }
  if (type === 'sleep') return {}
  if (type === 'note') return {}
  if (type === 'memory') return { what: (picks.what ?? '').trim() }

  if (type === 'growth') {
    // Only the measurements that were actually taken. An omitted field must
    // not become a zero — a baby who was not measured did not weigh 0 kg.
    const growth: Record<string, number> = {}
    for (const key of ['weightKg', 'heightCm', 'headCircumferenceCm']) {
      const value = parseNumber(picks[key])
      if (value !== null) growth[key] = value
    }
    return growth
  }

  if (type === 'medication') {
    const amount = parseNumber(picks.doseAmount)
    return {
      name: picks.name?.trim() ?? '',
      ...(amount !== null ? { doseAmount: amount } : {}),
      ...(picks.doseUnit?.trim() ? { doseUnit: picks.doseUnit.trim() } : {}),
    }
  }

  if (type === 'vaccination') return { name: picks.name?.trim() ?? '' }
  return {}
}
