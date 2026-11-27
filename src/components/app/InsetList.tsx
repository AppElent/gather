import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppLink } from '../../lib/links'

/**
 * The grouped list every collection uses, the phone's `InsetList` on the web
 * (web-shell_final.md, "Lists"): a `surface` card with the 22 px corner on
 * `ground`, rows at least 52 px, and a 0.5 px `hair` between rows that starts
 * at the text column rather than under the leading tile.
 *
 * Never a tinted row or a group fill behind a section: colour lives only in a
 * row's leading tile. Selection is `surface-2`.
 */
export function InsetList({
  children,
  label,
  className = '',
}: {
  children: ReactNode
  /** Names the list for assistive technology when no heading does. */
  label?: string
  className?: string
}) {
  return (
    <ul
      aria-label={label}
      className={`m-0 list-none rounded-[var(--radius-card)] bg-[var(--surface)] p-0 ${className}`.trim()}
    >
      {children}
    </ul>
  )
}

/**
 * A section's label above its list: footnote, 600, `muted`, sentence case.
 * A heading, so a screen reader can move between sections.
 */
export function SectionLabel({
  children,
  id,
  action,
  level = 2,
}: {
  children: ReactNode
  id?: string
  /** A small control at the label's end ("Reorder"). */
  action?: ReactNode
  level?: 2 | 3
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className="mx-1 mb-2 flex min-h-6 items-end justify-between gap-3">
      <Heading
        id={id}
        className="m-0 text-footnote font-semibold text-[var(--muted)]"
      >
        {children}
      </Heading>
      {action}
    </div>
  )
}

/** A line under a list, in `muted` footnote: what the section is for. */
export function SectionFooter({ children }: { children: ReactNode }) {
  return (
    <p className="mx-1 mt-2 mb-0 text-footnote text-[var(--muted)]">
      {children}
    </p>
  )
}

export interface InsetRowProps {
  /** The row's name: a record's own words or a Module's label. */
  title: ReactNode
  /** One footnote line under the title. */
  footnote?: ReactNode
  /** `danger` (600) when the footnote says something is overdue. */
  footnoteTone?: 'muted' | 'danger'
  /** A check ring, a `tile-s`, a thumbnail, or nothing. */
  leading?: ReactNode
  /** A count, a coin, a pill — before the chevron and the menu. */
  trailing?: ReactNode
  /** Where the row goes. The whole row is the link's target. */
  link?: AppLink
  /** What the row does, when it is a button rather than a link. */
  onClick?: () => void
  /** Runs alongside `link` (a Group switch before following it). */
  onLinkClick?: () => void
  /** Overrides the link's or button's name, which is otherwise its text. */
  accessibleName?: string
  /** Draws the disclosure chevron. Defaults to true for a link. */
  chevron?: boolean
  /** The `⋯` RowMenu, beside the row's target rather than inside it. */
  menu?: ReactNode
  /** Controls drawn in place of the menu (Reorder mode's arrows). */
  controls?: ReactNode
  /** `aria-pressed`/selected look for a choice row (a language). */
  selected?: boolean
  /**
   * Makes the row an on/off choice: with `onClick`, its target is a switch
   * and the track is drawn at the row's end.
   */
  switchedOn?: boolean
  /** Dims an `onClick` row and ignores it; it stays focusable and is read out. */
  disabled?: boolean
  /** Extra content under the footnote, inside the text column. */
  children?: ReactNode
}

/**
 * One row. Its target — a link or a button — stretches over the whole row
 * (the leading tile included), and the menu sits above it, so a row is one
 * tab stop for its target and one for its menu, never a link inside a link.
 */
export function InsetRow({
  title,
  footnote,
  footnoteTone = 'muted',
  leading,
  trailing,
  link,
  onClick,
  onLinkClick,
  accessibleName,
  chevron = Boolean(link),
  menu,
  controls,
  selected,
  switchedOn,
  disabled = false,
  children,
}: InsetRowProps) {
  const stretched =
    'text-inherit no-underline outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[""] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-[var(--ink)]'
  const titleNode = (
    <span className="block text-body text-[var(--ink)] break-words">
      {title}
    </span>
  )
  const target = link ? (
    <Link
      {...link}
      aria-label={accessibleName}
      onClick={onLinkClick}
      className={stretched}
    >
      {titleNode}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      aria-label={accessibleName}
      aria-pressed={selected}
      {...(switchedOn === undefined
        ? {}
        : { role: 'switch', 'aria-checked': switchedOn })}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={`w-full ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} border-0 bg-transparent p-0 text-left font-[inherit] ${stretched}`}
    >
      {titleNode}
    </button>
  ) : (
    titleNode
  )
  const interactive = Boolean(link || onClick)

  return (
    <li
      className={`group/row relative flex min-h-[var(--size-row-min)] items-stretch gap-3 pl-4 first:rounded-t-[var(--radius-card)] last:rounded-b-[var(--radius-card)] ${
        interactive && !controls && !disabled ? 'hover:bg-[var(--surface-2)]' : ''
      } ${selected ? 'bg-[var(--surface-2)]' : ''}`}
    >
      {leading ? (
        <span className="flex shrink-0 items-center py-2">{leading}</span>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 [li+li>&]:border-t-[0.5px] [li+li>&]:border-[var(--hair)]">
        <div className="min-w-0 flex-1">
          {target}
          {footnote ? (
            <span
              className={`mt-0.5 block text-footnote ${
                footnoteTone === 'danger'
                  ? 'font-semibold text-[var(--danger)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              {footnote}
            </span>
          ) : null}
          {children}
        </div>
        {trailing ? (
          <span className="flex shrink-0 items-center gap-2 text-subhead text-[var(--muted)] tabular-nums">
            {trailing}
          </span>
        ) : null}
        {switchedOn === undefined ? null : (
          <SwitchTrack on={switchedOn} dimmed={disabled} />
        )}
        {controls ? (
          <span className="relative z-[1] flex shrink-0 items-center gap-1">
            {controls}
          </span>
        ) : null}
        {menu && !controls ? (
          // An open menu rises above the rows after it, whose own menu
          // buttons sit on the same layer.
          <span className="relative z-[1] flex shrink-0 has-[[aria-expanded=true]]:z-20">
            {menu}
          </span>
        ) : null}
        {chevron && !controls ? (
          <ChevronRight
            className="size-4 shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </li>
  )
}

/** A switch row's track; the row itself is the control. */
function SwitchTrack({ on, dimmed }: { on: boolean; dimmed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-7 w-12 shrink-0 items-center rounded-[var(--radius-pill)] transition-colors motion-reduce:transition-none ${
        on ? 'bg-[var(--accent-text)]' : 'bg-[var(--hair-strong)]'
      } ${dimmed ? 'opacity-60' : ''}`}
    >
      <span
        className={`size-6 rounded-[var(--radius-pill)] bg-white transition-transform motion-reduce:transition-none ${
          on ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </span>
  )
}

/**
 * A record's picture in a row: 46 px, the thumbnail corner. A record without
 * a picture shows its group tile instead, centred in the same box, never a
 * placeholder picture.
 */
export function RowThumb({
  src,
  fallback,
}: {
  src?: string | null
  /** The group tile shown when there is no picture. */
  fallback: ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      className="flex size-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-thumb)]"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        fallback
      )}
    </span>
  )
}
