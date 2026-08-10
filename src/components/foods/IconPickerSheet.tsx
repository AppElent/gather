import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'
import { useMessages } from '../../lib/i18n'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hidden && element.tabIndex >= 0)
}

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
  const titleId = useId()
  const sheetRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }

    window.addEventListener('keydown', dismissOnEscape, true)
    return () => window.removeEventListener('keydown', dismissOnEscape, true)
  }, [open, onClose])

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return
    const sheet = sheetRef.current
    if (!sheet) return
    const focusable = focusableElements(sheet)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return

    const active = document.activeElement
    if (event.shiftKey) {
      if (active !== first && sheet.contains(active)) return
      event.preventDefault()
      last.focus()
      return
    }
    if (active !== last && sheet.contains(active)) return
    event.preventDefault()
    first.focus()
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className="absolute inset-x-0 bottom-0 max-h-[88svh] overflow-auto rounded-t-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl"
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {icon.chooseTitle}
          </h2>
          <button
            ref={closeButtonRef}
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
