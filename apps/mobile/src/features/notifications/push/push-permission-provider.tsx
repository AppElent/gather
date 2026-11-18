/**
 * Asks for notifications when it means something, and keeps this phone's
 * token registered while it is allowed (APP-298).
 *
 * **Never at launch.** Mounting this asks nothing: it reads what iOS already
 * says and, when notifications are allowed, registers this phone's token so a
 * token iOS rotated is picked up. The sheet is shown only from `ask`, which a
 * screen calls when a person sets a reminder or is assigned something, or
 * from Settings → Notifications when they ask there. `ask` explains in one
 * line first, and iOS's own sheet follows only on Continue.
 *
 * Mounted inside `ConvexSessionGate`, so registering always has a signed-in
 * caller; the token is re-registered when the phone's Language changes,
 * because the server writes each phone's notifications in its language.
 */
import { useMutation } from 'convex/react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Alert, AppState } from 'react-native'

import { api } from '../../../convex/api'
import { useI18n } from '../../../i18n'
import {
  type PushPermission,
  readPushPermission,
  readPushToken,
  rememberRegisteredPushToken,
  requestPushPermission,
} from './push-device'

/** What the person just did, which picks the line before iOS's sheet. */
export type PushAskReason = 'reminder' | 'assignment'

export interface PushPermissionValue {
  /** What iOS says now; `null` until it has been read. */
  permission: PushPermission | null
  /**
   * Ask for notifications because of `reason`, or straight away when the
   * person asked for them (`'settings'`). Resolves to whether this phone may
   * now receive them. Safe to call every time: once iOS has answered it asks
   * nothing again.
   */
  ask: (reason: PushAskReason | 'settings') => Promise<boolean>
}

export const PushPermissionContext = createContext<PushPermissionValue | null>(
  null,
)

export function PushPermissionProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n()
  const register = useMutation(api.notifications.registerDevice)
  const [permission, setPermission] = useState<PushPermission | null>(null)

  const refresh = useCallback(async () => {
    const next = await readPushPermission().catch(
      () => 'unavailable' as const,
    )
    setPermission(next)
    return next
  }, [])

  // Read on mount and whenever the app comes back, because the person may
  // have changed it in iOS Settings in between.
  useEffect(() => {
    void refresh()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    return () => subscription.remove()
  }, [refresh])

  useEffect(() => {
    if (permission !== 'granted') return
    let cancelled = false
    void (async () => {
      try {
        const token = await readPushToken()
        if (cancelled) return
        await register({ token, platform: 'ios', locale })
        rememberRegisteredPushToken(token)
      } catch {
        // No network or no push entitlement (a simulator without one): the
        // next launch tries again, and nothing on screen depends on it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [permission, register, locale])

  const ask = useCallback(
    async (reason: PushAskReason | 'settings') => {
      const now = await refresh()
      if (now === 'granted') return true
      if (now !== 'undetermined') return false
      if (reason !== 'settings') {
        const text = t.notifications.permission
        const proceed = await new Promise<boolean>((resolve) =>
          Alert.alert(text.askTitle, text.ask[reason], [
            {
              text: text.notNow,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            { text: text.continue, onPress: () => resolve(true) },
          ]),
        )
        if (!proceed) return false
      }
      const answer = await requestPushPermission().catch(
        () => 'unavailable' as const,
      )
      setPermission(answer)
      return answer === 'granted'
    },
    [refresh, t],
  )

  const value = useMemo(() => ({ permission, ask }), [permission, ask])
  return (
    <PushPermissionContext value={value}>{children}</PushPermissionContext>
  )
}
