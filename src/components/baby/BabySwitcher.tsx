import { Link } from '@tanstack/react-router'
import type { Id } from '../../../convex/_generated/dataModel'

interface BabySwitcherProps {
  babies: { _id: Id<'babies'>; name: string }[]
  activeId: Id<'babies'>
}

export function BabySwitcher({ babies, activeId }: BabySwitcherProps) {
  if (babies.length < 2) return null

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Switch child">
      {babies.map((b) => (
        <Link
          key={b._id}
          to="/baby/$babyId"
          params={{ babyId: b._id }}
          className={`inline-flex min-h-8 items-center rounded-[var(--app-radius)] border px-3 text-sm font-semibold no-underline ${
            b._id === activeId
              ? 'border-[var(--app-fg)] bg-[var(--app-surface)] text-[var(--app-fg)]'
              : 'border-[var(--app-border)] text-[var(--app-muted)]'
          }`}
        >
          {b.name}
        </Link>
      ))}
    </nav>
  )
}
