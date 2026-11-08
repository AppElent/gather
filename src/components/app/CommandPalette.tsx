import { useNavigate } from '@tanstack/react-router'
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { jumpTargets, shellJumpTargets } from '../../lib/appNavigation'
import { useMessages } from '../../lib/i18n'
import { useCurrentGroup } from './useCurrentGroup'
import { useModalFocus } from './useModalFocus'

/**
 * Jumping to a page by name. The shell owns whether it is open, so ⌘K and the
 * topbar's search button open the same thing.
 */
export function CommandPalette({
  open,
  onOpenChange: setOpen,
}: {
  open: boolean
  onOpenChange: Dispatch<SetStateAction<boolean>>
}) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const messages = useMessages()
  const { current } = useCurrentGroup()
  const { ref, onKeyDown } = useModalFocus<HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  if (!open) return null
  const targets = current ? jumpTargets(messages) : shellJumpTargets(messages)
  const results = targets.filter((target) =>
    target.label.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={messages.shell.palette.placeholder}
        className="w-full max-w-md rounded-xl border bg-white p-2 shadow-lg dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
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
