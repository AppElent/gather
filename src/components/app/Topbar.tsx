import { HeaderUser } from '@appelent/auth'
import { CommandPalette } from './CommandPalette'

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
      <div className="ml-auto">
        <HeaderUser />
      </div>
      <CommandPalette />
    </header>
  )
}
