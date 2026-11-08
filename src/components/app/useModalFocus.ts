import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
} from 'react'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusableIn(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/** Modals on screen, innermost last: Escape closes only the one on top. */
const openModals: object[] = []

interface ModalFocusOptions {
  /** Whether the modal is on screen. Defaults to true for one that mounts only while open. */
  open?: boolean
  /** Escape, while this is the innermost modal. */
  onClose: () => void
  /**
   * What takes focus as the modal opens: the first control in it by default,
   * this element when given, or nothing when the modal places focus itself.
   */
  initialFocus?: RefObject<HTMLElement | null> | false
}

/**
 * A modal's keyboard contract: focus moves into it as it opens, Tab stays
 * inside it, Escape closes it (and only it), and focus goes back to whatever
 * opened it once it goes.
 *
 * Put `ref` and `onKeyDown` on the dialog element.
 */
export function useModalFocus<T extends HTMLElement>({
  open = true,
  onClose,
  initialFocus,
}: ModalFocusOptions) {
  const ref = useRef<T>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus moves once per opening, not whenever the caller's ref object changes
  useEffect(() => {
    if (!open) return
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    if (initialFocus !== false) {
      const target =
        initialFocus?.current ??
        (ref.current ? focusableIn(ref.current)[0] : undefined)
      target?.focus()
    }
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Captured, and stopped there, so a sheet underneath does not close too.
  useEffect(() => {
    if (!open) return
    const token = {}
    openModals.push(token)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openModals.at(-1) !== token) return
      event.preventDefault()
      event.stopImmediatePropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      openModals.splice(openModals.indexOf(token), 1)
    }
  }, [open])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return
    const focusable = focusableIn(event.currentTarget)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return { ref, onKeyDown }
}
