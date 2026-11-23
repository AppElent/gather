import { useEffect, useRef } from 'react'

/**
 * What a Module index takes from its route when Add sent somebody to it with
 * `?new` (see `src/lib/createActions.ts`): open the create dialog once, then
 * let the route drop the flag, so a reload or Back does not open it again.
 */
export interface StartCreatingProps {
  startCreating?: boolean
  onCreateStarted?: () => void
}

export function useStartCreating(
  { startCreating, onCreateStarted }: StartCreatingProps,
  open: () => void,
) {
  // The latest callbacks, without making them a reason to run again.
  const latest = useRef({ open, onCreateStarted })
  latest.current = { open, onCreateStarted }

  useEffect(() => {
    if (!startCreating) return
    latest.current.open()
    latest.current.onCreateStarted?.()
  }, [startCreating])
}
