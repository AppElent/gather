import type { NavigateOptions } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MODULES } from '../../lib/modules'

const ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  ...MODULES.map((m) => ({ label: m.label, path: m.path })),
  { label: 'Settings', path: '/settings' },
  { label: 'Groups', path: '/groups' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null
  const results = ITEMS.filter((i) =>
    i.label.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-white p-2 shadow-lg dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to…"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {results.map((i) => (
            <li key={i.path}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  setOpen(false)
                  setQ('')
                  navigate({ to: i.path } as NavigateOptions)
                }}
              >
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
