import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { spacePath } from '../../lib/spaceRoutes'
import { useSpaceModules } from '../spaces/SpaceContext'

export function CommandPalette() {
  const { space, role, visibleModules } = useSpaceModules()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const items = [
    { label: 'Home', path: spacePath.home(space.slug) },
    ...visibleModules.map((module) => ({
      label: module.label,
      path: spacePath.module(space.slug, module.pathSegment),
    })),
    { label: 'All modules', path: spacePath.modules(space.slug) },
    ...(role === 'admin'
      ? [
          { label: 'Members', path: spacePath.members(space.slug) },
          { label: 'Settings', path: spacePath.settings(space.slug) },
        ]
      : []),
  ]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null
  const results = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-white p-2 shadow-lg dark:bg-neutral-900"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to…"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {results.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  setOpen(false)
                  setQuery('')
                  void navigate({ to: item.path as never })
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
