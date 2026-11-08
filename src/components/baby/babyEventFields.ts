import {
  TEMPERATURE_CELSIUS_MAX,
  TEMPERATURE_CELSIUS_MIN,
} from '@gather/core/baby-events'

export const DEFAULT_TEMPERATURE_CELSIUS = '37.5'

/** Shared input styling for every baby-log form control. */
export const BABY_INPUT_CLASS =
  'w-full min-w-0 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

// In 0.1° steps — a select instead of free text: fewer taps, no keyboard popup,
// and it can't produce an out-of-range typo.
export const TEMPERATURE_OPTIONS: string[] = Array.from(
  { length: (TEMPERATURE_CELSIUS_MAX - TEMPERATURE_CELSIUS_MIN) * 10 + 1 },
  (_, i) => (TEMPERATURE_CELSIUS_MIN + i * 0.1).toFixed(1),
)

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
