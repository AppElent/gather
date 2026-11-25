import { useEffect } from 'react'

/**
 * Escape with focus on nothing (after Enter in the title, or a reload) closes
 * the open task too. With focus inside the page, `ListDetailLayout` does it.
 */
export function useCloseOnEscape(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.target !== document.body) return
      if (
        document.querySelector(
          '[aria-modal="true"], [role="dialog"], [role="menu"]',
        )
      )
        return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
