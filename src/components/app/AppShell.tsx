import { Navigate, useLocation, useMatches } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { getRouteContext, getRouteGroup } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { linkTo, needsCurrentGroup } from '../../lib/links'
import { AccountMenu } from './AccountMenu'
import { CommandPalette } from './CommandPalette'
import { GatherPanel } from './GatherPanel'
import { GroupSwitcher } from './GroupSwitcher'
import { IssueReporterModal } from './IssueReporterModal'
import { MobileDock } from './MobileDock'
import { Sidebar } from './Sidebar'
import { CurrentGroupProvider, useCurrentGroup } from './useCurrentGroup'
import { useNavigation } from './useNavigation'

/**
 * The provider sits outside the shell rather than inside it because the shell
 * itself asks for the navigation — it keeps the page clear of the tab bar
 * from the same list the bar is drawn from — so the memory has to exist above
 * that call.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentGroupProvider>
      <AppShellBody>{children}</AppShellBody>
    </CurrentGroupProvider>
  )
}

/**
 * The sidebar beside the page from 768 px; below it, the page with two round
 * buttons at its top (the Group, the account menu) and the phone's tab bar
 * floating over its foot. There is no topbar: each page draws its own title,
 * once.
 */
function AppShellBody({ children }: { children: ReactNode }) {
  const location = useLocation()
  const messages = useMessages()
  const context = getRouteContext(location.pathname, messages)
  const { current: currentGroup, groups } = useCurrentGroup()
  // A Group page reads the Group with `useRequiredCurrentGroup`, so it is held
  // here until the Groups arrive, and somebody in no Group is sent to make or
  // join one. Personal pages need neither.
  //
  // The address alone is not enough: the router moves the address as soon as
  // a navigation starts but swaps the page on screen only when it commits. On
  // the way from a Group page to /groups the address already says /groups
  // while the old Group page is still the one rendered (APP-815), so the page
  // on screen is asked too.
  const shownPath = useMatches({
    select: (matches) => matches.at(-1)?.pathname,
  })
  const addressIsGroupPage = needsCurrentGroup(location.pathname)
  const groupPage =
    addressIsGroupPage ||
    (shownPath !== undefined && needsCurrentGroup(shownPath))
  // The tab bar is only on screen when there is a navigation to put in it, and
  // the room kept clear for it has to go when it does — asked of the same list
  // the bar asks, so the space and the bar cannot disagree.
  const { items: navigation } = useNavigation()
  const [gatherOpen, setGatherOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [reporterOpen, setReporterOpen] = useState(false)
  const openPalette = () => setPaletteOpen(true)
  const openGather = () => setGatherOpen(true)
  const reportIssue = () => setReporterOpen(true)

  return (
    <div className="app-shell">
      <div className="min-h-svh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar
          onOpenPalette={openPalette}
          onOpenGather={openGather}
          onReportIssue={reportIssue}
        />
        <div
          className={`flex min-w-0 flex-col md:pb-0 ${
            navigation.length > 0
              ? 'pb-[calc(104px+env(safe-area-inset-bottom))]'
              : ''
          }`}
        >
          {/* Phone width: the Group and you, as the phone's round header
              buttons. The sidebar carries both from 768 px. */}
          <div className="flex items-center justify-between px-4 pt-3 md:hidden">
            <GroupSwitcher variant="round" />
            <AccountMenu
              variant="round"
              onOpenGather={openGather}
              onReportIssue={reportIssue}
            />
          </div>
          {/* A Module's page wears its group's colours (`data-group` in
              styles.css); the navigation around it stays neutral. */}
          <main
            data-group={getRouteGroup(location.pathname)}
            className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6"
          >
            {!groupPage || currentGroup ? (
              children
            ) : groups === undefined || !addressIsGroupPage ? (
              // Still loading, or already on the way out of a Group page.
              <p className="text-sm opacity-60">
                {messages.common.errors.loading}
              </p>
            ) : (
              <Navigate {...linkTo('groups')} replace />
            )}
          </main>
        </div>
      </div>

      <MobileDock onOpenPalette={openPalette} />
      <GatherPanel
        open={gatherOpen}
        // The Current Group, or none — the same answer the switcher at the top
        // of the sidebar gives.
        activeGroupName={currentGroup?.name ?? null}
        routeTitle={context.title}
        onClose={() => setGatherOpen(false)}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <IssueReporterModal open={reporterOpen} onOpenChange={setReporterOpen} />
    </div>
  )
}
