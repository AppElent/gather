import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Search } from 'lucide-react'
import { type ReactNode, useId } from 'react'
import { api } from '../../../convex/_generated/api'
import type { NavItem } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { linkTo, ROUTES } from '../../lib/links'
import { useDayIn } from '../../lib/useDayIn'
import { AccountMenu } from './AccountMenu'
import { AddMenu } from './AddMenu'
import { GroupSwitcher } from './GroupSwitcher'
import { ModuleTile } from './ModuleTile'
import { Pill } from './ShellPrimitives'
import { useCurrentGroup } from './useCurrentGroup'
import { useNavigation } from './useNavigation'

export interface SidebarProps {
  onOpenPalette: () => void
  onOpenGather: () => void
  onReportIssue: () => void
}

const ROW =
  'flex h-11 items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-[15px] text-[var(--ink)] no-underline hover:bg-[var(--surface)]'
/** The current item: a `surface` pill, never a group colour. */
const CURRENT = 'bg-[var(--surface)] font-semibold'

/**
 * The desktop shell, 248 px on `ground`: the Group, a search field that opens
 * the jump-to palette, Start and Add, your pins as tiles in their group's
 * colour, All modules, and at the foot your Settings and the account menu.
 *
 * Not the full Module catalog, so a household with fourteen Modules does not
 * scroll past ten it never opens. Nothing is switched off: All modules is one
 * click away under the pins.
 *
 * On Settings, Account and the Groups list the list is still drawn for the
 * Current Group, so stepping out to pick a Group does not blank the shell on
 * the way. Only somebody with no Current Group gets the sentence instead, and
 * the switcher above it says the same thing.
 *
 * Groups are reached from the switcher ("Manage groups"), and a Group's own
 * settings through the Group on Groups — not from here, a row from yours under
 * almost the same word.
 *
 * Below 768 px none of this is drawn: the phone's tab bar (`MobileDock`) and
 * the round buttons at the top of the page take over.
 */
export function Sidebar({
  onOpenPalette,
  onOpenGather,
  onReportIssue,
}: SidebarProps) {
  const { pathname } = useLocation()
  const { sidebar, nav, marks } = useMessages().shell
  const { items, activeId } = useNavigation()
  const counts = useOpenCounts(items)
  const pinnedLabel = useId()
  const home = items.find((item) => item.id === 'home')
  const all = items.find((item) => item.id === 'all')
  const pins = items.filter((item) => item !== home && item !== all)
  // Settings is no item of the Group's list, so it answers for itself.
  const onSettings = pathname.replace(/\/$/, '') === ROUTES.settings

  return (
    <aside
      className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col gap-1 overflow-y-auto bg-[var(--ground)] px-3 py-4 md:flex"
      aria-label={sidebar.label}
    >
      <GroupSwitcher />

      <button
        type="button"
        onClick={onOpenPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="mt-2.5 mb-2 flex h-10 items-center gap-2.5 rounded-full bg-[var(--surface-2)] px-3 text-left text-[15px] text-[var(--muted)]"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1">{sidebar.search}</span>
        <kbd
          aria-hidden="true"
          className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-sans text-xs font-semibold"
        >
          ⌘K
        </kbd>
      </button>

      {items.length === 0 ? (
        <p className="m-0 px-2.5 text-sm leading-6 text-[var(--muted)]">
          {sidebar.noGroup}
        </p>
      ) : (
        <nav className="flex flex-col gap-1" aria-label={sidebar.primary}>
          {home ? <Row item={home} activeId={activeId} /> : null}
          <AddMenu variant="sidebar" />

          {pins.length > 0 ? (
            <div role="group" aria-labelledby={pinnedLabel}>
              <p
                id={pinnedLabel}
                className="mx-2.5 mt-3.5 mb-1 text-[13px] font-semibold text-[var(--muted)]"
              >
                {sidebar.pinned}
              </p>
              <div className="flex flex-col gap-1">
                {pins.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    count={counts[item.id]}
                    soon={item.placeholder ? <Pill>{marks.soon}</Pill> : null}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {all ? (
            <Row
              item={{ ...all, label: nav.allModules }}
              activeId={activeId}
            />
          ) : null}
        </nav>
      )}

      <nav className="mt-auto flex flex-col gap-1" aria-label={sidebar.footer}>
        <Link
          {...linkTo('settings')}
          aria-current={onSettings ? 'page' : undefined}
          className={`${ROW} ${onSettings ? CURRENT : ''}`}
        >
          <ModuleTile icon="Settings" />
          <span className="flex-1">{nav.settings}</span>
        </Link>
        <AccountMenu
          variant="sidebar"
          onOpenGather={onOpenGather}
          onReportIssue={onReportIssue}
        />
      </nav>
    </aside>
  )
}

function Row({
  item,
  activeId,
  count,
  soon,
}: {
  item: NavItem
  activeId: string | null
  count?: number
  soon?: ReactNode
}) {
  const current = item.id === activeId
  return (
    <Link
      {...item.link}
      // The router also marks a link `aria-current` when its address
      // prefixes this page; see `activeNavItemId` for why the two agree.
      aria-current={current ? 'page' : undefined}
      className={`${ROW} ${current ? CURRENT : ''}`}
    >
      <ModuleTile icon={item.icon} group={item.group} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {soon}
      {/* A space, so the link's name reads "Tasks 16", not "Tasks16". */}
      {count ? ' ' : null}
      {count ? (
        <span className="text-[13px] font-normal text-[var(--muted)] tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  )
}

/**
 * The open count beside a pin, where its Module has one: Tasks counts its
 * open tasks over every local list (`tasks.openCounts`, the phone's own
 * answer). Asked only while Tasks is pinned; no other Module counts yet.
 */
function useOpenCounts(items: readonly NavItem[]): Record<string, number> {
  const { current } = useCurrentGroup()
  const tasksPinned = items.some((item) => item.id === 'tasks')
  const today = useDayIn(current?.timeZone)
  const tasks = useQuery(
    api.tasks.openCounts,
    current && tasksPinned ? { groupSlug: current.slug, today } : 'skip',
  )
  if (!tasks) return {}
  return { tasks: tasks.reduce((sum, list) => sum + list.open, 0) }
}
