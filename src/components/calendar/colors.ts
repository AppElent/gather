import type { CalendarColor } from '@gather/core/calendar'

/** Bars and dots are graphics, so they take the group's `text` (3:1). */
export const COLOR_BAR: Record<CalendarColor, string> = {
  home: 'bg-[var(--home-text)]',
  kitchen: 'bg-[var(--kitchen-text)]',
  money: 'bg-[var(--money-text)]',
  tasting: 'bg-[var(--tasting-text)]',
}

/**
 * A pill: the group's wash, deepened with its text so it also shows on today's
 * `home` wash. Opaque, so that wash does not muddy it.
 */
export const COLOR_TINT: Record<CalendarColor, string> = {
  home: 'bg-[color-mix(in_srgb,var(--home-text)_18%,var(--home-wash))]',
  kitchen: 'bg-[color-mix(in_srgb,var(--kitchen-text)_18%,var(--kitchen-wash))]',
  money: 'bg-[color-mix(in_srgb,var(--money-text)_18%,var(--money-wash))]',
  tasting: 'bg-[color-mix(in_srgb,var(--tasting-text)_18%,var(--tasting-wash))]',
}
