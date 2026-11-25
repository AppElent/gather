import { type RefObject, useEffect } from 'react'

/** Whether a key press belongs to something the person is typing in. */
function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) &&
    // A check ring takes no letters.
    !(target instanceof HTMLInputElement && target.type === 'checkbox')
  )
}

/** `N`, with no modifier and nothing else in the way, focuses the add field. */
export function useAddShortcut(field: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'n' && event.key !== 'N') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.defaultPrevented || typing(event.target)) return
      if (document.querySelector('[aria-modal="true"], [role="menu"]')) return
      if (!field.current) return
      event.preventDefault()
      field.current.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [field])
}
