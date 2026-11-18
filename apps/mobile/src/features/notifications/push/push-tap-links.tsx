/**
 * Draws nothing. Follows a tapped push notification to its record (APP-298).
 *
 * A notification carries a `/g/<slug>/…` path (`notificationPath` in core),
 * and a tap is treated exactly as that link would be: the router's `/g/…`
 * route holds it across sign-in, and the handoff checks the slug against the
 * person's own Groups, switches to it, and opens the task or event. Nothing
 * in a notification is trusted beyond the shape `notificationLink` accepts.
 *
 * Mounted by the root navigator once the router is up, signed in or not, like
 * `HomeScreenActionLinks`.
 */
import { notificationLink } from '@gather/core/notifications'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect } from 'react'

/**
 * The notification that launched this process is followed once per process,
 * not once per mount: the navigator remounts this after the Unavailable gate.
 */
let launchResponseFollowed = false

/**
 * The last response followed. A launch can report the same tap both as the
 * last response and to the listener; it opens its record once.
 */
let lastFollowed: string | null = null

function follow(response: Notifications.NotificationResponse | null) {
  if (!response) return
  const id = `${response.notification.request.identifier}@${response.notification.date}`
  if (id === lastFollowed) return
  lastFollowed = id
  const link = notificationLink(response.notification.request.content.data)
  if (!link) return
  const path = `/g/${encodeURIComponent(link.groupSlug)}/${link.segments.join('/')}`
  // A tick later, so a cold start's router has mounted its first screen.
  setTimeout(() => router.navigate(path as never))
}

export function PushTapLinks() {
  useEffect(() => {
    if (!launchResponseFollowed) {
      launchResponseFollowed = true
      follow(Notifications.getLastNotificationResponse())
    }
    const subscription =
      Notifications.addNotificationResponseReceivedListener(follow)
    return () => subscription.remove()
  }, [])

  return null
}
