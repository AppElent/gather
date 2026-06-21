import { Link, createFileRoute } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MODULES } from '../../lib/modules'

export const Route = createFileRoute('/_app/dashboard')({ component: Dashboard })

function Dashboard() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Welcome to gather</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon =
            (Icons as unknown as Record<string, LucideIcon>)[m.icon] ?? Icons.Square
          return (
            <Link
              key={m.id}
              to={m.path as LinkProps['to']}
              className="flex flex-col gap-2 rounded-xl border p-4 no-underline transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icon className="h-6 w-6 opacity-80" aria-hidden="true" />
              <span className="font-medium">{m.label}</span>
              <span className="text-xs opacity-60">{m.description}</span>
              {m.status === 'placeholder' && (
                <span className="mt-1 w-fit rounded-full border px-2 text-[10px] uppercase opacity-50">Soon</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
