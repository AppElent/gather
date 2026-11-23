import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useEffect } from 'react'

/**
 * Keeps the screen from locking while `active`, and lets it lock again the
 * moment it is not. `useKeepAwake` follows mount instead, and a screen left
 * open behind another tab would keep the phone awake until the app closed.
 *
 * `tag` names who is asking, so one screen letting go never releases
 * another's hold: a loyalty card at the till, shopping mode (APP-315).
 */
export function useKeepAwakeWhile(active: boolean, tag: string) {
  useEffect(() => {
    if (!active) return
    activateKeepAwakeAsync(tag).catch(() => {})
    return () => {
      deactivateKeepAwake(tag).catch(() => {})
    }
  }, [active, tag])
}
