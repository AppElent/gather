import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMessages } from '../../lib/i18n'

interface Props {
  open: boolean
  icons: readonly string[]
  value?: string
  disabled?: boolean
  onChoose: (icon: string) => void
  onClear: () => void
  onClose: () => void
}

/**
 * The picker lives above its form rather than expanding it: the surrounding
 * field stays a compact summary while the full set remains easy to reach.
 * `icons` comes from the picker so this display component does not import its
 * public parent and create a circular dependency.
 */
export function IconPickerSheet({
  open,
  icons,
  value,
  disabled,
  onChoose,
  onClear,
  onClose,
}: Props) {
  const { icon } = useMessages().common

  useEffect(() => {
    if (!open) return

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="icon-picker-title"
        className="absolute inset-x-0 bottom-0 max-h-[88svh] overflow-auto rounded-t-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl"
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id="icon-picker-title" className="text-lg font-semibold">
            {icon.chooseTitle}
          </h2>
          <button
            type="button"
            aria-label={icon.close}
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] text-xl"
          >
            ×
          </button>
        </header>
        <div className="flex flex-wrap gap-1">
          {icons.map((candidate) => {
            const chosen = candidate === value
            return (
              <button
                key={candidate}
                type="button"
                disabled={disabled}
                aria-pressed={chosen}
                onClick={() => onChoose(candidate)}
                className={`flex min-h-11 min-w-11 items-center justify-center rounded-[var(--app-radius)] border text-xl ${
                  chosen
                    ? 'border-[var(--app-fg)] bg-[var(--app-bg)]'
                    : 'border-transparent'
                }`}
              >
                {candidate}
              </button>
            )
          })}
          {value !== undefined && (
            <button
              type="button"
              disabled={disabled}
              aria-label={icon.none}
              onClick={onClear}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] text-sm opacity-60"
            >
              ×
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
