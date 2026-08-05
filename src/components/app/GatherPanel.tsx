import { Sparkles, X } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
} from 'react'
import { fmt, useMessages } from '../../lib/i18n'
import { IconButton, Pill, SectionHeader, SurfaceCard } from './ShellPrimitives'

export interface GatherPanelProps {
  open: boolean
  /** The Group the URL names, or null off any `/g/<slug>` route. */
  activeGroupName: string | null
  routeTitle: string
  onClose: () => void
}

/**
 * Which suggestions to offer, and in what order. The words are in the message
 * tree; this is only the running order, which is not a translator's decision.
 */
const PROMPT_KEYS = ['recent', 'plan', 'summarize'] as const

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

export function GatherPanel({
  open,
  activeGroupName,
  routeTitle,
  onClose,
}: GatherPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const { gatherPanel, groupSwitcher } = useMessages().shell

  useEffect(() => {
    if (!open) {
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
      openerRef.current = null
      return
    }

    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const panel = panelRef.current
    if (panel) getFocusableElements(panel)[0]?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    return () => {
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(event.currentTarget)
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements.at(-1)

    if (!firstFocusable || !lastFocusable) return

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault()
      lastFocusable.focus()
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault()
      firstFocusable.focus()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/20 md:bg-transparent">
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={gatherPanel.title}
        onKeyDown={handleKeyDown}
        className="fixed inset-x-0 bottom-0 max-h-[88svh] overflow-auto rounded-t-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl md:inset-y-3 md:right-3 md:left-auto md:w-[360px] md:rounded-[var(--app-radius)]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Off a Group route there is no Group to name, and saying so is
                the same answer the switcher gives rather than a guess at
                which Group the question is about. */}
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--app-muted)]">
              {activeGroupName ?? groupSwitcher.none}
            </p>
            <h2 className="m-0 text-lg font-semibold">{gatherPanel.title}</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              {fmt(gatherPanel.context, { page: routeTitle })}
            </p>
          </div>
          <IconButton label={gatherPanel.close} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </header>

        <SurfaceCard className="mb-3">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--app-accent)]" />
            <Pill tone="warning">{gatherPanel.preview}</Pill>
          </div>
          <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
            {gatherPanel.notConnected}
          </p>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader title={gatherPanel.tryAsking} />
          <div className="grid gap-2">
            {PROMPT_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm"
              >
                {gatherPanel.prompts[key]}
              </button>
            ))}
          </div>
        </SurfaceCard>

        <label className="mt-3 block">
          <span className="sr-only">{gatherPanel.title}</span>
          <textarea
            placeholder={gatherPanel.placeholder}
            className="min-h-28 w-full resize-none rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
          />
        </label>
      </aside>
    </div>
  )
}
