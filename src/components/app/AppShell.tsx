import { useLocation } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { getRouteContext } from '../../lib/appNavigation'
import { CommandPalette } from './CommandPalette'
import { GatherPanel } from './GatherPanel'
import { IssueReporterModal } from './IssueReporterModal'
import { MobileDock } from './MobileDock'
import { IconButton } from './ShellPrimitives'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const context = getRouteContext(location.pathname)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [gatherOpen, setGatherOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className="grid min-h-svh md:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_336px]">
        <Sidebar />
        <div className="flex min-w-0 flex-col pb-20 md:pb-0">
          <Topbar
            context={context}
            onOpenNavigation={() => setNavigationOpen(true)}
            onOpenGather={() => setGatherOpen(true)}
          />
          <div className="min-w-0 flex-1 px-3 py-4 md:px-5 md:py-5">
            {children}
          </div>
        </div>
        <div className="hidden border-l border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_86%,transparent)] p-4 xl:block">
          <div id="group-inspector-slot" />
        </div>
      </div>

      {navigationOpen ? (
        <div className="fixed inset-0 z-50 bg-black/20 md:hidden">
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="h-full w-[min(22rem,92vw)] border-r border-[var(--app-border)] bg-[var(--app-surface)]"
          >
            <div className="flex justify-end p-3">
              <IconButton
                label="Close navigation"
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

      <MobileDock pathname={location.pathname} />
      <GatherPanel
        open={gatherOpen}
        activeGroupName="Oak House"
        routeTitle={context.title}
        onClose={() => setGatherOpen(false)}
      />
      <CommandPalette />
      <IssueReporterModal />
    </div>
  )
}
