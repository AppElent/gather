import { Sparkles, X } from 'lucide-react'
import { useEffect } from 'react'
import { IconButton, Pill, SectionHeader, SurfaceCard } from './ShellPrimitives'

export interface GatherPanelProps {
  open: boolean
  activeGroupName: string
  routeTitle: string
  onClose: () => void
}

const PROMPTS = [
  'Show me what changed recently',
  'Draft a plan for this group',
  'Summarize this page',
]

export function GatherPanel({
  open,
  activeGroupName,
  routeTitle,
  onClose,
}: GatherPanelProps) {
  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/20 md:bg-transparent">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ask Gather"
        className="fixed inset-x-0 bottom-0 max-h-[88svh] overflow-auto rounded-t-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl md:inset-y-3 md:right-3 md:left-auto md:w-[360px] md:rounded-[var(--app-radius)]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase text-[var(--app-muted)]">
              {activeGroupName}
            </p>
            <h2 className="m-0 text-lg font-semibold">Ask Gather</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Context: {routeTitle}
            </p>
          </div>
          <IconButton label="Close Ask Gather" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </header>

        <SurfaceCard className="mb-3">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--app-accent)]" />
            <Pill tone="warning">Preview</Pill>
          </div>
          <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
            Automation is not connected yet. Use this panel as a command
            scratchpad for the active group; real actions will arrive in a later
            feature.
          </p>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader title="Try asking" />
          <div className="grid gap-2">
            {PROMPTS.map((prompt) => (
              <button
                type="button"
                key={prompt}
                className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
        </SurfaceCard>

        <label className="mt-3 block">
          <span className="sr-only">Ask Gather</span>
          <textarea
            placeholder="Ask Gather to help with this group..."
            className="min-h-28 w-full resize-none rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
          />
        </label>
      </aside>
    </div>
  )
}
