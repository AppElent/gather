export const DEFAULT_TEMPERATURE_CELSIUS = '37.5'

/** Shared input styling for every baby-log form control. */
export const BABY_INPUT_CLASS =
  'w-full min-w-0 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

// 34.0–42.0°C in 0.1° steps — a select instead of free text: fewer taps,
// no keyboard popup, and it can't produce an out-of-range typo.
export const TEMPERATURE_OPTIONS: string[] = Array.from(
  { length: 81 },
  (_, i) => (34 + i * 0.1).toFixed(1),
)

// The option *labels* — how a temperature was taken, which side a feed was
// on, what was in the diaper — used to live here as four records. They are
// read by a person, so they are translated, and they now live under
// `baby.log.options` in each locale's `baby.ts` (ADR-0011). The keys they are
// stored under are unchanged and remain the schema's business.

/** The option keys, in the order the selects offer them. */
export const TEMPERATURE_METHODS = [
  'oral',
  'rectal',
  'axillary',
  'ear',
  'forehead',
] as const
export const FEEDING_METHODS = ['breast', 'bottle', 'solid'] as const
export const DIAPER_KINDS = ['wet', 'dirty', 'both'] as const

export const EVENT_TYPE_ICONS: Record<string, string> = {
  temperature: 'Thermometer',
  feeding: 'Milk',
  diaper: 'Baby',
  sleep: 'Moon',
  growth: 'Ruler',
  medication: 'Pill',
  vaccination: 'Syringe',
  note: 'NotebookPen',
  memory: 'Sparkles',
}
