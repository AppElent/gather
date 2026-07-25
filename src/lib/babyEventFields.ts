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

export const TEMPERATURE_METHOD_LABELS: Record<string, string> = {
  oral: 'Oral',
  rectal: 'Rectal',
  axillary: 'Armpit',
  ear: 'Ear',
  forehead: 'Forehead',
}

export const FEEDING_METHOD_LABELS: Record<string, string> = {
  breast: 'Breastfeeding',
  bottle: 'Bottle',
  solid: 'Solid food',
}

export const FEEDING_SIDE_LABELS: Record<string, string> = {
  left: 'Left',
  right: 'Right',
  both: 'Both',
}

export const DIAPER_KIND_LABELS: Record<string, string> = {
  wet: 'Wet',
  dirty: 'Dirty',
  both: 'Both',
}

export const EVENT_TYPE_ICONS: Record<string, string> = {
  temperature: 'Thermometer',
  feeding: 'Milk',
  diaper: 'Baby',
  sleep: 'Moon',
  growth: 'Ruler',
  medication: 'Pill',
  vaccination: 'Syringe',
  note: 'NotebookPen',
}
