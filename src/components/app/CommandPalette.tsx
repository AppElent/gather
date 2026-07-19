import type { NavigateOptions } from '@tanstack/react-router'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const STATIC_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Settings', path: '/settings' },
  { label: 'Create or join a Space', path: '/onboarding' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const spaceSlug = /^\/s\/([^/]+)/.exec(location.pathname)?.[1]
  const items = [
    ...STATIC_ITEMS,
    ...(spaceSlug
      ? [{ label: 'Recipes', path: `/s/${spaceSlug}/recipes` }]
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
    item.label.toLowerCase().includes(q.toLowerCase()),
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
          value={q}
          onChange={(event) => setQ(event.target.value)}
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
                  setQ('')
                  navigate({ to: item.path } as NavigateOptions)
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
