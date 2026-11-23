/**
 * The kitchen's text fields, in one place because of one rule: a field shows
 * at least 16px text on a phone.
 *
 * 16px is load-bearing rather than taste: a mobile browser zooms the page when
 * a field below it takes focus, and the layout never comes back. Fixed by font
 * size, never by disabling user scaling, which would take pinch-zoom away from
 * everybody to spare us one bug.
 */

/** A form field on a page; smaller text once there is room for it. */
export const inputClass =
  'w-full rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] px-3 py-2 text-[16px] outline-none focus:border-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm'

/** A thumb-sized field in the add sheet, which is a phone surface first. */
export const fieldClass =
  'min-h-11 rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] px-3 text-[16px]'
