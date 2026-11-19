/**
 * Draws nothing. The Done button on a task reminder (APP-305).
 *
 * A reminder arrives in the `taskReminder` category (`categoryId` on the
 * server's push); this registers that category with its one action, in the
 * phone's Language, and completes the task when the action is pressed. The
 * button does not open the app: iOS wakes Gather in the background, and the
 * task is set done through the same `tasks.update` a tap in the app uses, in
 * the Group the notification names. Nothing in the notification is trusted
 * beyond `notificationLink`'s shape, and the server checks the Group and the
 * task as for any other write.
 *
 * A category is registered from JavaScript, but `expo-notifications` itself
 * is native, so installed builds get the button from the native build that
 * brings push (APP-373), not over the air.
 *
 * Mounted inside `ConvexSessionGate`: completing needs a signed-in caller.
 * A press that woke the app from nothing arrives as the last response, read
 * once on mount; `PushTapLinks` leaves these alone rather than opening the
 * task.
 */
import { notificationLink } from '@gather/core/notifications'
import {
  TASK_DONE_ACTION,
  TASK_REMINDER_CATEGORY,
} from '@gather/core/task-reminders'
import { useMutation } from 'convex/react'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { api, type Id } from '../../../convex/api'
import { useI18n } from '../../../i18n'

/** Responses already handled in this process, by notification. */
const handled = new Set<string>()

/** The task a Done press is about, or null for anything else. */
export function doneTarget(
  response: Notifications.NotificationResponse,
): { groupSlug: string; taskId: string; id: string } | null {
  if (response.actionIdentifier !== TASK_DONE_ACTION) return null
  const link = notificationLink(response.notification.request.content.data)
  const [first, second, taskId] = link?.segments ?? []
  if (!link || first !== 'tasks' || second !== 'task' || !taskId) return null
  return {
    groupSlug: link.groupSlug,
    taskId,
    id: response.notification.request.identifier,
  }
}

export function PushTaskDone() {
  const { t } = useI18n()
  const update = useMutation(api.tasks.update)
  const updateRef = useRef(update)
  useEffect(() => {
    updateRef.current = update
  }, [update])

  // The category, again whenever the Language changes: its button is text.
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    void Notifications.setNotificationCategoryAsync(TASK_REMINDER_CATEGORY, [
      {
        identifier: TASK_DONE_ACTION,
        buttonTitle: t.notifications.actions.done,
        options: { opensAppToForeground: false },
      },
    ]).catch(() => {
      // A build without the native module: no button, and nothing else lost.
    })
  }, [t])

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const complete = (response: Notifications.NotificationResponse | null) => {
      const target = response && doneTarget(response)
      if (!target || handled.has(target.id)) return
      handled.add(target.id)
      updateRef
        .current({
          taskId: target.taskId as Id<'tasks'>,
          groupSlug: target.groupSlug,
          done: true,
        })
        .catch(() => {
          // Not a Member any more, or the task is gone: nothing to complete.
        })
      void Notifications.dismissNotificationAsync(target.id).catch(() => {})
    }
    complete(Notifications.getLastNotificationResponse())
    const subscription =
      Notifications.addNotificationResponseReceivedListener(complete)
    return () => subscription.remove()
  }, [])

  return null
}
