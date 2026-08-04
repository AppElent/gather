import { useLocation } from '@tanstack/react-router'
import { X } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getRouteContext } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { CommandPalette } from './CommandPalette'
import { GatherPanel } from './GatherPanel'
import { IssueReporterModal } from './IssueReporterModal'
import { MobileDock } from './MobileDock'
import { ShellGroupProvider } from './ShellGroup'
import { IconButton } from './ShellPrimitives'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useCurrentGroup } from './useCurrentGroup'
import { useNavigation } from './useNavigation'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/**
 * The provider sits outside the shell rather than inside it because the shell
 * itself asks for the navigation — it reserves the dock's space from the same
 * list the dock renders — so the memory has to exist above that call.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellGroupProvider>
      <AppShellBody>{children}</AppShellBody>
    </ShellGroupProvider>
  )
}

function AppShellBody({ children }: { children: ReactNode }) {
  const location = useLocation()
  const messages = useMessages()
  const context = getRouteContext(location.pathname, messages)
  const { current: currentGroup } = useCurrentGroup()
  // The dock is only on screen when there is a navigation to put in it, and the
  // room reserved for it has to go when it does — asked of the same list the
  // dock renders, so the space and the bar cannot disagree.
  const { items: navigation } = useNavigation()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [gatherOpen, setGatherOpen] = useState(false)
  const navigationDrawerRef = useRef<HTMLElement>(null)
  const navigationOpenerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!navigationOpen) {
      const opener = navigationOpenerRef.current
      if (opener?.isConnected) opener.focus()
      navigationOpenerRef.current = null
      return
    }

    navigationOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const drawer = navigationDrawerRef.current
    if (drawer) getFocusableElements(drawer)[0]?.focus()
  }, [navigationOpen])

  useEffect(() => {
    if (!navigationOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigationOpen])

  useEffect(() => {
    return () => {
      const opener = navigationOpenerRef.current
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const handleDrawerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(event.currentTarget)
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements.at(-1)

    if (!firstFocusable || !lastFocusable) return

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault()
      lastFocusable.focus()
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault()
      firstFocusable.focus()
    }
  }

  return (
    <div className="app-shell">
      {/* Two columns at every width above a phone. There used to be a third at
          `xl` carrying a "Group overview" rail of invented content — active
          modules, a meal-planning slot, "member details will appear here". Home
          is the Group's surface now (#22) and says all of it for real, so a
          permanent rail beside it would be a second copy to keep in step with
          the first. */}
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
          />
          <main className="min-w-0 flex-1 px-3 py-4 md:px-5 md:py-5">
            {children}
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
            ref={navigationDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={messages.shell.drawer.label}
            onKeyDown={handleDrawerKeyDown}
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
        // The Group the address bar names, or none — the same answer the
        // switcher at the top of the sidebar gives. It used to be the literal
        // string "Preview group" on every route, which told a reader the panel
        // was about a Group that does not exist.
        activeGroupName={currentGroup?.name ?? null}
        routeTitle={context.title}
        onClose={() => setGatherOpen(false)}
      />
      <CommandPalette />
      <IssueReporterModal />
    </div>
  )
}
