import { HeaderUser } from '@appelent/auth'
import { Bug } from 'lucide-react'
import { CommandPalette } from './CommandPalette'
import { IssueReporterModal } from './IssueReporterModal'

export function Topbar() {
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-8">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm opacity-70"
        onClick={() => {
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
          )
        }}
      >
        <span>Jump to…</span>
        <kbd className="rounded border px-1 text-xs">⌘K</kbd>
      </button>
      <button
        type="button"
        aria-label="Report an issue"
        title="Report an issue (Ctrl+Shift+I)"
        className="rounded-md border p-1.5 opacity-70"
        onClick={() => {
          window.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'i',
              ctrlKey: true,
              shiftKey: true,
            }),
          )
        }}
      >
        <Bug className="h-4 w-4" />
      </button>
      <div className="ml-auto">
        <HeaderUser />
      </div>
      <CommandPalette />
      <IssueReporterModal />
    </header>
  )
}
