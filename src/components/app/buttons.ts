/**
 * The web's button shapes, as classes for a `<button>` or a `<Link>`: pills,
 * 44 px tall, like the phone's (web-shell_final.md, "Shape").
 *
 * - `primary`: the Module's primary action, in `--accent` — the group's fill
 *   inside a Module, ink outside one. One per surface.
 * - `secondary`: Cancel and every other neutral action, on `surface-2`.
 * - `onWash`: a neutral action on a wash or a `surface-2` ground, on `surface`.
 * - `danger`: a destructive action as text, never a filled red button.
 * - `round`: a 44 px icon-only control (search, settings, close in a header).
 */
const PILL =
  'inline-flex min-h-[var(--size-control-min)] items-center justify-center gap-2 rounded-[var(--radius-pill)] text-[17px] font-semibold no-underline disabled:cursor-not-allowed disabled:opacity-60'

export const buttonClass = {
  primary: `${PILL} bg-[var(--accent)] px-5 text-[var(--on-accent)] hover:opacity-90`,
  secondary: `${PILL} bg-[var(--surface-2)] px-5 text-[var(--ink)]`,
  /** The confirming half of a destructive dialog, beside `secondary`. */
  secondaryDanger: `${PILL} bg-[var(--surface-2)] px-5 text-[var(--danger)]`,
  onWash: `${PILL} bg-[var(--surface)] px-5 text-[var(--ink)]`,
  danger: `${PILL} bg-transparent px-3 text-[var(--danger)] hover:bg-[var(--surface-2)]`,
  round:
    'inline-grid size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface)] text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]',
  /** A compact pill for a toolbar or a row (36 px): chips, Reorder, Done. */
  small:
    'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--surface)] px-3.5 text-subhead font-semibold text-[var(--ink)] no-underline disabled:opacity-40',
  /** A 36 px icon-only control inside a row, on `surface-2`. */
  smallRound:
    'inline-grid size-9 shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] text-[var(--ink)] disabled:opacity-40',
} as const
