import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { isDockItemActive, MOBILE_DOCK_ITEMS } from '../../lib/appNavigation'

function Icon({ name }: { name: string }) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className="h-4 w-4" aria-hidden="true" />
}

export function MobileDock({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-2 bottom-2 z-30 grid grid-cols-4 gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 md:hidden"
    >
      {MOBILE_DOCK_ITEMS.map((item) => (
        <Link
          key={item.id}
          to={item.path as LinkProps['to']}
          aria-current={isDockItemActive(pathname, item) ? 'page' : undefined}
          className="grid min-h-11 place-items-center rounded-[7px] text-xs text-[var(--app-muted)] no-underline aria-[current=page]:bg-[var(--app-surface-muted)] aria-[current=page]:text-[var(--app-fg)]"
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
