import { Navigate, useLocation } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { getRouteContext } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { linkTo, needsCurrentGroup } from '../../lib/links'
import { CommandPalette } from './CommandPalette'
import { GatherPanel } from './GatherPanel'
import { IssueReporterModal } from './IssueReporterModal'
import { MobileDock } from './MobileDock'
import { IconButton } from './ShellPrimitives'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CurrentGroupProvider, useCurrentGroup } from './useCurrentGroup'
import { useModalFocus } from './useModalFocus'
import { useNavigation } from './useNavigation'

/**
 * The provider sits outside the shell rather than inside it because the shell
 * itself asks for the navigation — it reserves the dock's space from the same
 * list the dock renders — so the memory has to exist above that call.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentGroupProvider>
      <AppShellBody>{children}</AppShellBody>
    </CurrentGroupProvider>
  )
}

function AppShellBody({ children }: { children: ReactNode }) {
  const location = useLocation()
  const messages = useMessages()
  const context = getRouteContext(location.pathname, messages)
  const { current: currentGroup, groups } = useCurrentGroup()
  // A Group page reads the Group with `useRequiredCurrentGroup`, so it is held
  // here until the Groups arrive, and somebody in no Group is sent to make or
  // join one. Personal pages need neither.
  const groupPage = needsCurrentGroup(location.pathname)
  // The dock is only on screen when there is a navigation to put in it, and the
  // room reserved for it has to go when it does — asked of the same list the
  // dock renders, so the space and the bar cannot disagree.
  const { items: navigation } = useNavigation()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [gatherOpen, setGatherOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [reporterOpen, setReporterOpen] = useState(false)
  const drawer = useModalFocus<HTMLElement>({
    open: navigationOpen,
    onClose: () => setNavigationOpen(false),
  })

  return (
    <div className="app-shell">
      {/* Two columns at every width above a phone. No rail about the Group
          beside them: Home is the Group's surface (#22), and a rail would be a
          second copy to keep in step with it. */}
      <div className="grid min-h-svh md:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar />
        <div
          className={`flex min-w-0 flex-col md:pb-0 ${
            navigation.length > 0 ? 'pb-20' : ''
          }`}
        >
          <Topbar
            context={context}
            groupName={currentGroup?.name}
            onOpenNavigation={() => setNavigationOpen(true)}
            onOpenGather={() => setGatherOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            onReportIssue={() => setReporterOpen(true)}
          />
          <main className="min-w-0 flex-1 px-3 py-4 md:px-5 md:py-5">
            {!groupPage || currentGroup ? (
              children
            ) : groups === undefined ? (
              <p className="text-sm opacity-60">
                {messages.common.errors.loading}
              </p>
            ) : (
              <Navigate {...linkTo('groups')} replace />
            )}
          </main>
        </div>
      </div>

      {navigationOpen ? (
        <div
          data-testid="navigation-backdrop"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/20 md:hidden"
          onClick={() => setNavigationOpen(false)}
        >
          <aside
            ref={drawer.ref}
            role="dialog"
            aria-modal="true"
            aria-label={messages.shell.drawer.label}
            onKeyDown={drawer.onKeyDown}
            onClick={(event) => event.stopPropagation()}
            className="min-h-full w-[min(22rem,92vw)] overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-surface)]"
          >
            <div className="flex justify-end p-3">
              <IconButton
                label={messages.shell.drawer.close}
                onClick={() => setNavigationOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
            <Sidebar
              variant="drawer"
              onNavigate={() => setNavigationOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <MobileDock />
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
