/**
 * The one thing both Notes screens do the same way.
 *
 * Deleting is permanent in Gather today, so it asks first and names the note it
 * is about to destroy (`docs/mobile-interaction.md`). Both the index's hold
 * menu and the note's own â‹¯ reach it, and an alert whose wording depended on
 * which one you used would be a bug nobody would ever notice.
 */
import { Alert } from 'react-native'

import { fmt, type Messages } from '../../i18n'
import { taskActions } from '../tasks/store'
import type { Note } from '../tasks/types'

export function confirmDeleteNote(
  note: Note,
  t: Messages,
  onDeleted?: () => void,
) {
  Alert.alert(
    fmt(t.labs.notes.deleteTitle, {
      title: note.title || t.labs.notes.untitled,
    }),
    t.labs.list.deleteBody,
    [
      { text: t.actions.cancel, style: 'cancel' },
      {
        text: t.actions.delete,
        style: 'destructive',
        onPress: () => {
          taskActions.deleteNote(note.id)
          onDeleted?.()
        },
      },
    ],
  )
}
