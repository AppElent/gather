/**
 * Draws nothing. Delivers a push release that sign-out could not (APP-298).
 *
 * Sign-out keeps the phone's release (its token and the session it was
 * registered under) until the server confirms it. When the phone was offline,
 * this sends it again on the next launch and whenever the app comes back,
 * signed in or not: `notifications.releaseDevice` needs no session.
 *
 * Mounted by the root layout inside the Convex provider.
 */
import { useMutation } from 'convex/react'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { api } from '../../../convex/api'
import { confirmPushRelease, pendingPushRelease } from './push-device'

export function PushReleaseRetry() {
  const release = useMutation(api.notifications.releaseDevice)

  useEffect(() => {
    const deliver = () => {
      const pending = pendingPushRelease()
      if (!pending) return
      release(pending)
        .then(() => confirmPushRelease(pending))
        .catch(() => {})
    }
    deliver()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') deliver()
    })
    return () => subscription.remove()
  }, [release])

  return null
}
