import { HeaderUser } from '@appelent/auth'
import { Bug, Menu, Search } from 'lucide-react'
import { useSpace } from '../spaces/SpaceContext'
import { IconButton } from './ShellPrimitives'

export function Topbar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const { space } = useSpace()
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-bg)_86%,transparent)] px-3 backdrop-blur md:min-h-[72px] md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label="Open navigation"
          onClick={onOpenNavigation}
          className="md:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <div className="min-w-0">
          <p className="m-0 truncate text-sm text-[var(--app-muted)]">
            {space.name ?? 'Space'}
          </p>
          <h1 className="m-0 truncate text-xl font-semibold leading-tight md:text-2xl">
            Home
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton
          label="Jump to"
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
            )
          }}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Report an issue"
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
        <HeaderUser />
      </div>
    </header>
  )
}
