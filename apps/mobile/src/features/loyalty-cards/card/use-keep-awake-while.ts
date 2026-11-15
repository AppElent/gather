import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useEffect } from 'react'

const TAG = 'loyalty-card-till'

/**
 * Keeps the screen from locking while `active`, and lets it lock again the
 * moment it is not. `useKeepAwake` follows mount instead, and a card left open
 * behind another tab would keep the phone awake until the app closed.
 */
export function useKeepAwakeWhile(active: boolean) {
  useEffect(() => {
    if (!active) return
    activateKeepAwakeAsync(TAG).catch(() => {})
    return () => {
      deactivateKeepAwake(TAG).catch(() => {})
    }
  }, [active])
}
