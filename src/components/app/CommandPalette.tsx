import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { jumpTargets } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { useCurrentGroup } from './useCurrentGroup'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const messages = useMessages()
  // Jumping from inside a Group keeps you in it, exactly as the sidebar and the
  // dock do — the palette is on screen under both route trees too.
  const { current } = useCurrentGroup()
  const groupSlug = current?.slug ?? null

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
  const results = jumpTargets(groupSlug, messages).filter((target) =>
    target.label.toLowerCase().includes(q.toLowerCase()),
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
          placeholder={messages.shell.palette.placeholder}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {results.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  setOpen(false)
                  setQ('')
                  navigate(target.link)
                }}
              >
                {target.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
