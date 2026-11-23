import { Link, useLocation } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { activeTab, type Tab } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { type AppLink, linkTo } from '../../lib/links'
import { AddMenu } from './AddMenu'
import { Icon } from './Icon'
import { useNavigation } from './useNavigation'

/**
 * The phone's destinations, below 768 px: Start, Add, Settings and All in a
 * floating bar, and Search as a separate round button (ADR-0018). The web
 * draws this bar itself — there is no Liquid Glass in a browser — and the
 * current tab sits on the neutral selected pill, never a group colour.
 *
 * It replaced a dock of pinned Modules and a hamburger drawer. The bar has no
 * room for pins, so a Module page belongs to All (`activeTab`). Group
 * switching and the account menu are the round buttons at the top of the page.
 *
 * With no Current Group there is nothing for Start, Add or All to point at, so
 * the bar is not drawn; those round buttons still are.
 */
export function MobileDock({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { tabBar, nav } = useMessages().shell
  const { pathname } = useLocation()
  const { items } = useNavigation()
  const current = activeTab(pathname)

  if (items.length === 0) return null

  const tab = (id: Exclude<Tab, 'add'>, link: AppLink, label: string, icon: string) => (
    <Link
      {...link}
      // The router also sets `aria-current` by prefix; no tab's address is a
      // prefix of a page another tab claims, so the two agree.
      aria-current={current === id ? 'page' : undefined}
      className="flex h-[50px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[var(--ink)] no-underline aria-[current=page]:bg-[var(--surface-2)]"
    >
      <Icon name={icon} className="h-5 w-5" />
      <span className="max-w-full truncate px-1 text-[10px] leading-3 font-semibold">
        {label}
      </span>
    </Link>
  )

  return (
    <nav
      aria-label={tabBar.label}
      className="fixed inset-x-4 bottom-[calc(20px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2.5 md:hidden"
    >
      <div className="tab-bar-glass relative flex h-[62px] min-w-0 flex-1 items-center rounded-full px-1.5">
        {tab('home', linkTo('home'), nav.home, 'Home')}
        <div className="min-w-0 flex-1">
          <AddMenu variant="tab" />
        </div>
        {tab('settings', linkTo('settings'), nav.settings, 'Settings')}
        {tab('all', linkTo('all'), nav.all, 'Grid2X2')}
      </div>
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={nav.search}
        className="tab-bar-glass grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full text-[var(--ink)]"
      >
        <Search className="h-[22px] w-[22px]" aria-hidden="true" />
      </button>
    </nav>
  )
}
