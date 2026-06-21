import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MODULE_GROUPS, modulesByGroup } from '../../lib/modules'

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <C className={className} aria-hidden="true" />
}

export function Sidebar() {
  const byGroup = modulesByGroup()
  return (
    <aside className="hidden w-60 shrink-0 border-r p-4 sm:block">
      <Link to="/dashboard" className="mb-4 flex items-center gap-2 px-2 font-semibold no-underline">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        gather
      </Link>

      <Link
        to="/dashboard"
        className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm no-underline"
        activeProps={{ className: 'bg-black/5 dark:bg-white/10' }}
      >
        <Icon name="LayoutDashboard" className="h-4 w-4" />
        Dashboard
      </Link>

      {MODULE_GROUPS.map((group) => (
        <div key={group} className="mb-3">
          <p className="px-3 pb-1 text-[11px] uppercase tracking-wide opacity-50">{group}</p>
          {byGroup[group].map((m) => (
            <Link
              key={m.id}
              to={m.path as LinkProps['to']}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm no-underline opacity-90"
              activeProps={{ className: 'bg-black/5 dark:bg-white/10 opacity-100' }}
            >
              <Icon name={m.icon} className="h-4 w-4" />
              {m.label}
            </Link>
          ))}
        </div>
      ))}

      <div className="mt-4 border-t pt-3">
        <Link to="/settings" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm no-underline opacity-90" activeProps={{ className: 'bg-black/5 dark:bg-white/10' }}>
          <Icon name="Settings" className="h-4 w-4" /> Settings
        </Link>
        <Link to="/groups" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm no-underline opacity-90" activeProps={{ className: 'bg-black/5 dark:bg-white/10' }}>
          <Icon name="Users" className="h-4 w-4" /> Groups
        </Link>
      </div>
    </aside>
  )
}
