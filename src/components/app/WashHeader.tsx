import type { ModuleGroup } from '@gather/core/modules'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Plus, Search, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmt, useMessages } from '../../lib/i18n'
import type { AppLink } from '../../lib/links'
import { buttonClass } from './buttons'
import { ModuleTile } from './ModuleTile'

/**
 * The top of a Module page (web-shell_final.md, "Module page"): a 22 px card
 * in the group's `wash` with the Module's `tile-l`, the large title and a
 * one-line summary, and on the right search, settings and the primary action.
 *
 * Text on the wash is `ink` and `muted` only, never a group's `text`; the
 * group's `fill` is on the tile and the primary pill and nowhere else.
 *
 * Below `md` it is the phone's layout: the round buttons in a row on top, then
 * the large title, then the tile beside the summary.
 */
const WASH: Record<ModuleGroup, string> = {
  kitchen: 'bg-[var(--kitchen-wash)]',
  home: 'bg-[var(--home-wash)]',
  tasting: 'bg-[var(--tasting-wash)]',
  money: 'bg-[var(--money-wash)]',
}

export interface WashSummary {
  /** The count, in `ink` 700: "12 recipes", "3 open". */
  count: string
  /** What the count is of, in `muted`: the Group, a list. */
  scope?: string
}

export interface WashAction {
  label: string
  link?: AppLink
  onClick?: () => void
  /** The glyph before the label; a plus unless given. */
  icon?: ReactNode
}

export interface WashHeaderProps {
  group: ModuleGroup
  /** The Module's lucide name (`ModuleDef.icon`). */
  icon: string
  /** The page title: a Module's name or a record's own words. */
  title: string
  summary?: WashSummary
  /** Above the title on a nested page whose trail is one step deep. */
  parent?: { label: string; link: AppLink }
  /**
   * Below `md`: the round back button at the start of the header's buttons, to
   * the page this one belongs to. From `md` the sidebar or the trail does it.
   */
  back?: { label: string; link: AppLink }
  /** "Zoeken in {module}": opens this Module's search. Hidden when absent. */
  onSearch?: () => void
  /**
   * The Module's settings page. Absent where the Module has none, and then the
   * gear is not drawn rather than drawn disabled (APP-611).
   */
  settings?: AppLink
  /** The name `search` and `settings` say they belong to. Defaults to `title`. */
  moduleName?: string
  /** The primary action, a pill in the group's fill. */
  primary?: WashAction
  /** Anything else on the right, before the primary (a `⋯` menu). */
  extra?: ReactNode
}

function Primary({ action }: { action: WashAction }) {
  const content = (
    <>
      {action.icon ?? (
        <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
      )}
      <span className="hidden lg:inline">{action.label}</span>
    </>
  )
  // Icon-only below lg (responsive action controls), so the name is explicit.
  const className = `${buttonClass.primary} max-lg:w-[var(--size-control-min)] max-lg:px-0`
  return action.link ? (
    <Link {...action.link} aria-label={action.label} className={className}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={action.label}
      onClick={action.onClick}
      className={className}
    >
      {content}
    </button>
  )
}

export function WashHeader({
  group,
  icon,
  title,
  summary,
  parent,
  back,
  onSearch,
  settings,
  moduleName = title,
  primary,
  extra,
}: WashHeaderProps) {
  const { breadcrumbs, modulePage } = useMessages().shell

  return (
    <header
      // Points `--accent` at the group's fill for the primary pill.
      data-group={group}
      className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-[var(--radius-card)] px-4 pt-3 pb-4 text-[var(--ink)] [grid-template-areas:'b_b'_'t_t'_'i_s'] md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-4 md:gap-y-0 md:py-5 md:pr-5 md:pl-6 md:[grid-template-areas:'i_t_b'_'i_s_b'] ${WASH[group]}`}
    >
      {/* One set of elements, placed by grid areas: on a phone the buttons
          run along the top and the tile sits beside the summary; from md the
          tile, the title column and the buttons share one row. */}
      <div className="flex items-center justify-end gap-2 [grid-area:b] empty:hidden">
        {back ? (
          <Link
            {...back.link}
            aria-label={fmt(breadcrumbs.backTo, { page: back.label })}
            title={fmt(breadcrumbs.backTo, { page: back.label })}
            className={`${buttonClass.round} mr-auto md:hidden`}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
        {onSearch ? (
          <button
            type="button"
            aria-label={fmt(modulePage.searchIn, { module: moduleName })}
            title={fmt(modulePage.searchIn, { module: moduleName })}
            onClick={onSearch}
            className={buttonClass.round}
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </button>
        ) : null}
        {settings ? (
          <Link
            {...settings}
            aria-label={fmt(modulePage.settingsOf, { module: moduleName })}
            title={fmt(modulePage.settingsOf, { module: moduleName })}
            className={buttonClass.round}
          >
            <Settings className="size-[18px]" aria-hidden="true" />
          </Link>
        ) : null}
        {extra}
        {primary ? <Primary action={primary} /> : null}
      </div>
      <ModuleTile
        group={group}
        icon={icon}
        size="l"
        className="[grid-area:i]"
      />
      <div className="min-w-0 self-end [grid-area:t]">
        {parent ? (
          <Link
            {...parent.link}
            className="inline-flex items-center gap-0.5 text-footnote text-[var(--muted)] no-underline hover:text-[var(--ink)]"
          >
            {parent.label}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
        <h1 className="m-0 font-rounded text-large-title font-bold break-words">
          {title}
        </h1>
      </div>
      {summary ? (
        <p
          data-testid="wash-summary"
          className="m-0 min-w-0 self-center text-subhead text-[var(--muted)] [grid-area:s] md:self-start"
        >
          <b className="font-bold text-[var(--ink)] tabular-nums">
            {summary.count}
          </b>
          {summary.scope ? ` · ${summary.scope}` : null}
        </p>
      ) : null}
    </header>
  )
}
