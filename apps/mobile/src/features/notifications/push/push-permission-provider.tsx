/**
 * Asks for notifications when it means something, and keeps this phone's
 * token registered while it is allowed (APP-298).
 *
 * **Never at launch.** Mounting this asks nothing: it reads what iOS already
 * says and, when notifications are allowed, registers this phone's token so a
 * token iOS rotated is picked up. The sheet is shown only from `ask`, which a
 * screen calls when a person sets a reminder or is assigned something, or
 * from Settings → Notifications when they ask there. `ask` explains in one
 * line first, and iOS's own sheet follows only on Continue. That line is
 * shown once per install: after "Not now" only Settings → Notifications asks.
 *
 * Mounted inside `ConvexSessionGate`, so registering always has a signed-in
 * caller; the token is re-registered when the phone's Language changes,
 * because the server writes each phone's notifications in its language, and
 * under the Clerk session it is signed in with, which is what releases it on
 * sign-out. After registering, the person's other phones whose session has
 * ended (revoked from another device, or a release that never arrived) are
 * forgotten, using the sessions Clerk lists as active.
 */
import { useAuth, useUser } from '@clerk/expo'
import { useMutation } from 'convex/react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'

import { api } from '../../../convex/api'
import { useI18n } from '../../../i18n'
import { showAlert } from '../../../observability/native-presentation'
import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../../../prefs/localPreference'
import {
  confirmPushRelease,
  type PushPermission,
  queuePushRelease,
  readPushPermission,
  readPushToken,
  rememberRegisteredPush,
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
  const forgetEnded = useMutation(api.notifications.forgetEndedSessions)
  const release = useMutation(api.notifications.releaseDevice)
  const { sessionId } = useAuth()
  // The session now, for a registration that lands after a sign-out.
  const sessionRef = useRef(sessionId)
  useEffect(() => {
    sessionRef.current = sessionId
    return () => {
      sessionRef.current = null
    }
  }, [sessionId])
  // Read when needed, not a dependency: the object changes with every profile edit.
  const { user } = useUser()
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])
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
    if (permission !== 'granted' || !sessionId) return
    let cancelled = false
    void (async () => {
      try {
        const token = await readPushToken()
        if (cancelled) return
        await register({ token, platform: 'ios', locale, sessionId })
        const registration = { token, sessionId }
        if (sessionRef.current !== sessionId) {
          // Signed out while this was on its way: take it back.
          queuePushRelease(registration)
          await release(registration)
          confirmPushRelease(registration)
          return
        }
        rememberRegisteredPush(registration)
        const current = userRef.current
        if (!current) return
        const sessions = await current.getSessions()
        if (cancelled) return
        await forgetEnded({ activeSessionIds: sessions.map((s) => s.id) })
      } catch {
        // No network or no push entitlement (a simulator without one): the
        // next launch tries again, and nothing on screen depends on it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [permission, register, forgetEnded, release, locale, sessionId])

  const ask = useCallback(
    async (reason: PushAskReason | 'settings') => {
      const now = await refresh()
      if (now === 'granted') return true
      if (now !== 'undetermined') return false
      if (reason !== 'settings') {
        // The line before iOS's sheet is shown once. After "Not now", only
        // Settings → Notifications asks again, because the person goes there.
        if (readPreference(PREFERENCE_KEYS.pushExplained)) return false
        writePreference(PREFERENCE_KEYS.pushExplained, '1')
        const text = t.notifications.permission
        const proceed = await new Promise<boolean>((resolve) =>
          showAlert(text.askTitle, text.ask[reason], [
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
