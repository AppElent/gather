/**
 * What a person is told when a write to a task was not taken. A linked list's
 * write goes to its provider (APP-448), so the reason is worth an alert; a
 * local one already shows it by not changing, with the haptic.
 */
import { useCallback } from 'react'

import { haptics } from '../../feedback/haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { providerName } from './providerName'
import { LinkedWriteError, useTaskLists } from './store'

/** The alert's words, or null for anything that is not a linked write. */
export function linkedFailureWords(
  error: unknown,
  lists: readonly { _id: string; provider: string }[] | undefined,
  t: Messages,
): { title: string; body: string } | null {
  if (!(error instanceof LinkedWriteError)) return null
  const provider = providerName(
    lists?.find((list) => list._id === error.listId)?.provider ?? 'todoist',
  )
  return {
    title: fmt(t.tasks.linkedWrite.failedTitle, { provider }),
    body: fmt(t.tasks.linkedWrite.failed[error.reason], { provider }),
  }
}

export function useWriteFailed() {
  const { t } = useI18n()
  const lists = useTaskLists()
  return useCallback(
    (error: unknown) => {
      haptics.actionFailed()
      const words = linkedFailureWords(error, lists, t)
      if (words) showAlert(words.title, words.body)
    },
    [t, lists],
  )
}
