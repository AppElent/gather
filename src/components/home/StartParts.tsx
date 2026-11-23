import type { ModuleGroup } from '@gather/core/modules'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppLink } from '../../lib/links'
import { Icon } from '../app/Icon'

/**
 * The pieces of Start, drawn from the phone's Home components
 * (`apps/mobile/src/ui/now-card.tsx`, `today-rail.tsx`, `pinned-card.tsx`,
 * `inset-list.tsx`) in the web's tokens. Group colour sits only on tiles, the
 * Now card's wash and button, and the pinned cards (DESIGN_SYSTEM.md, Web).
 */

/**
 * A group's fill comes from the stylesheet: `data-group` points `--accent` and
 * `--on-accent` at that group's `fill` and `on` (src/styles.css), so no
 * component names a fill itself. The wash is spelled out whole per group so
 * Tailwind's scanner finds it.
 */
const FILL =
  'bg-[var(--accent)] text-[var(--on-accent)] hover:text-[var(--on-accent)]'

const WASH = {
  kitchen: 'bg-[var(--kitchen-wash)]',
  home: 'bg-[var(--home-wash)]',
  tasting: 'bg-[var(--tasting-wash)]',
  money: 'bg-[var(--money-wash)]',
} as const satisfies Record<ModuleGroup, string>

const TILE = {
  s: 'h-[var(--size-tile-s)] w-[var(--size-tile-s)] rounded-[var(--radius-tile-s)]',
  m: 'h-[var(--size-tile-m)] w-[var(--size-tile-m)] rounded-[var(--radius-tile-m)]',
} as const

/**
 * A Module's squircle in its group fill. A past rail item's tile is quiet
 * instead: `surface-2` with a `muted` glyph, never faded.
 */
export function Tile({
  group,
  icon,
  size = 's',
  past = false,
}: {
  group: ModuleGroup
  icon: string
  size?: keyof typeof TILE
  past?: boolean
}) {
  const colours = past
    ? 'bg-[var(--surface-2)] text-[var(--muted)]'
    : FILL
  return (
    <span
      aria-hidden="true"
      data-group={past ? undefined : group}
      className={`grid shrink-0 place-items-center ${TILE[size]} ${colours}`}
    >
      <Icon name={icon} className={size === 'm' ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  )
}

/** A section's title-2 heading, as on the phone's Home. */
export function StartHeading({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <h2
      id={id}
      className="mx-1 my-0 font-rounded text-title-2 font-bold text-[var(--ink)]"
    >
      {children}
    </h2>
  )
}

/**
 * A `surface` card holding rows separated by hairlines inset to the text.
 * Local until APP-639's shared inset list lands in `src/components/app/`.
 */
export function InsetList({
  children,
  label,
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 list-none overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] p-0 [&>li+li>*]:border-t [&>li+li>*]:border-[var(--hair)]"
    >
      {children}
    </ul>
  )
}

/**
 * The one fact the household opened Start for, with the action that answers
 * it: shown only while something is due or overdue, and never more than one.
 * The value stays `ink`; the group's colour is the wash, the tile and the
 * button.
 */
export function NowCard({
  group,
  icon,
  caption,
  value,
  detail,
  action,
}: {
  group: ModuleGroup
  icon: string
  caption: string
  value: string
  detail?: string
  action: { label: string; link: AppLink }
}) {
  return (
    <section
      aria-label={caption}
      data-testid="start-now"
      className={`grid gap-2.5 rounded-[26px] ${WASH[group]} p-4 text-[var(--ink)] lg:px-[18px] lg:pt-[18px] lg:pb-4`}
    >
      <p className="m-0 flex items-center gap-3 text-subhead font-semibold">
        <Tile group={group} icon={icon} size="m" />
        {caption}
      </p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-rounded text-[44px] leading-[48px] font-extrabold tabular-nums">
          {value}
        </span>
        {detail ? (
          <span className="min-w-0 text-subhead text-[var(--muted)] wrap-anywhere">
            {detail}
          </span>
        ) : null}
      </p>
      <div>
        <Link
          {...action.link}
          data-group={group}
          className={`inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-pill)] ${FILL} px-[22px] text-[17px] font-semibold no-underline lg:min-h-11 lg:w-auto`}
        >
          {action.label}
        </Link>
      </div>
    </section>
  )
}

export interface RailItem {
  id: string
  timestamp: number
  /** `HH:MM`, 24-hour. */
  time: string
  group: ModuleGroup
  icon: string
  title: string
}

export type RailRow =
  | { kind: 'item'; item: RailItem; past: boolean }
  | { kind: 'now' }

/**
 * The rail's order: everything oldest first, past items before the Now
 * capsule and upcoming items after it. The capsule is always there, even on a
 * rail with nothing before it, because it is where the reader stands.
 */
export function railRows(items: readonly RailItem[], now: number): RailRow[] {
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp)
  const past = sorted.filter((item) => item.timestamp <= now)
  const upcoming = sorted.filter((item) => item.timestamp > now)
  return [
    ...past.map((item): RailRow => ({ kind: 'item', item, past: true })),
    { kind: 'now' },
    ...upcoming.map((item): RailRow => ({ kind: 'item', item, past: false })),
  ]
}

/**
 * Today's timed events on one axis: past items muted on quiet tiles, the
 * "Now · HH:MM" ink capsule, then upcoming items in ink 600 on their group's
 * tile. The capsule is decorative for a screen reader: the header already
 * says what day it is.
 */
export function TodayRail({
  items,
  now,
  nowLabel,
}: {
  items: readonly RailItem[]
  now: number
  nowLabel: string
}) {
  return (
    <ol
      data-testid="start-rail"
      className="m-0 list-none rounded-[var(--radius-card)] bg-[var(--surface)] px-0 py-1.5"
    >
      {railRows(items, now).map((row) =>
        row.kind === 'now' ? (
          <li
            key="now"
            aria-hidden="true"
            data-rail="now"
            className="px-4 py-1.5"
          >
            <span className="inline-block rounded-[var(--radius-pill)] bg-[var(--ink)] px-2.5 py-[3px] text-footnote font-bold text-[var(--on-ink)] tabular-nums">
              {nowLabel}
            </span>
          </li>
        ) : (
          <li
            key={row.item.id}
            data-rail={row.past ? 'past' : 'upcoming'}
            className={`flex min-h-11 items-center gap-3 px-4 ${
              row.past
                ? 'text-[var(--muted)]'
                : 'font-semibold text-[var(--ink)]'
            }`}
          >
            <time
              dateTime={new Date(row.item.timestamp).toISOString()}
              className="w-11 shrink-0 text-footnote font-normal text-[var(--muted)] tabular-nums"
            >
              {row.item.time}
            </time>
            <Tile
              group={row.item.group}
              icon={row.item.icon}
              past={row.past}
            />
            <span className="min-w-0 py-2 text-subhead wrap-anywhere">
              {row.item.title}
            </span>
          </li>
        ),
      )}
    </ol>
  )
}

/** One row of an inset list that opens somewhere: at least 52 px tall. */
export function LinkRow({
  link,
  leading,
  title,
  meta,
}: {
  link: AppLink
  leading: ReactNode
  title: ReactNode
  meta?: ReactNode
}) {
  return (
    <li>
      <Link
        {...link}
        className="mx-4 flex min-h-[var(--size-row-min)] items-center gap-3 py-1.5 text-[var(--ink)] no-underline hover:text-[var(--ink)]"
      >
        {leading}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-subhead wrap-anywhere">{title}</span>
          {meta ? (
            <span className="text-footnote text-[var(--muted)]">{meta}</span>
          ) : null}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[var(--hair-strong)]"
        />
      </Link>
    </li>
  )
}

/**
 * A photo-less pinned card in its group fill: the glyph at the top, the
 * Module's name in `card-label` at the bottom.
 */
export function PinnedCard({
  group,
  icon,
  label,
  link,
}: {
  group: ModuleGroup
  icon: string
  label: string
  link: AppLink
}) {
  return (
    <li className="min-w-0">
      <Link
        {...link}
        data-group={group}
        className={`flex h-32 flex-col justify-between rounded-[var(--radius-card)] ${FILL} p-3 no-underline`}
      >
        <Icon name={icon} className="h-[22px] w-[22px]" />
        <span className="font-rounded text-[17px] leading-[21px] font-bold wrap-anywhere">
          {label}
        </span>
      </Link>
    </li>
  )
}
