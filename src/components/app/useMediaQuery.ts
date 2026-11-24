import { useSyncExternalStore } from 'react'

/** Tailwind's `lg`, the web's desktop breakpoint (DESIGN_SYSTEM.md). */
export const DESKTOP_QUERY = '(min-width: 1024px)'

function mediaList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return null
  return window.matchMedia(query)
}

/**
 * Whether a media query matches, kept current as the window changes.
 *
 * The server and the first client render say `false` (phone first), so a page
 * that hydrates on a desktop redraws once rather than mismatching.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = mediaList(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => mediaList(query)?.matches ?? false,
    () => false,
  )
}

/** At or above `lg`: the dialog is centred and lists sit side by side. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
