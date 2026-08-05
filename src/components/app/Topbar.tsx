import { HeaderUser } from '@appelent/auth'
import { Bug, Menu, MessageSquare, Search } from 'lucide-react'
import type { RouteContext } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { LanguageToggle } from './LanguageToggle'
import { IconButton } from './ShellPrimitives'

export interface TopbarProps {
  context: RouteContext
  /** The Group the URL names, or null off any `/g/<slug>` route. */
  groupName?: string | null
  onOpenNavigation: () => void
  onOpenGather: () => void
}

export function Topbar({
  context,
  groupName,
  onOpenNavigation,
  onOpenGather,
}: TopbarProps) {
  const { topbar } = useMessages().shell

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-bg)_86%,transparent)] px-3 backdrop-blur md:min-h-[72px] md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label={topbar.openNavigation}
          onClick={onOpenNavigation}
          className="md:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <div className="min-w-0">
          <h1 className="m-0 truncate text-xl font-semibold leading-tight md:text-2xl">
            {context.title}
          </h1>
          <p className="mt-1 hidden truncate text-sm text-[var(--app-muted)] md:block">
            {context.subtitle}
          </p>
          {/* The phone has no sidebar on screen, so the Group it would have
              named goes here — it is the one thing a reader cannot otherwise
              see, and the subtitle it replaces only restates the title. */}
          <p className="mt-1 truncate text-sm text-[var(--app-muted)] md:hidden">
            {groupName ?? context.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IconButton
          label={topbar.jumpTo}
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
            )
          }}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={topbar.askGather} onClick={onOpenGather}>
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={topbar.reportIssue}
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'i',
                ctrlKey: true,
                shiftKey: true,
              }),
            )
          }}
        >
          <Bug className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <LanguageToggle />
        <HeaderUser />
      </div>
    </header>
  )
}
