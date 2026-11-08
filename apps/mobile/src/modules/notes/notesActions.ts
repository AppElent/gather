/**
 * The one thing both Notes screens do the same way.
 *
 * Deleting is permanent in Gather today, so it asks first and names the note it
 * is about to destroy (`apps/mobile/DESIGN_SYSTEM.md`). Both the index's hold
 * menu and the note's own ⋯ reach it, and an alert whose wording depended on
 * which one you used would be a bug nobody would ever notice.
 */
import { Alert } from 'react-native'

import { fmt, type Messages } from '../../i18n'
import type { Note } from './store'

export function confirmDeleteNote(
  note: Note,
  t: Messages,
  onDelete: () => void,
) {
  Alert.alert(
    fmt(t.notes.deleteTitle, {
      title: note.title || t.notes.untitled,
    }),
    t.notes.deleteBody,
    [
      { text: t.actions.cancel, style: 'cancel' },
      { text: t.actions.delete, style: 'destructive', onPress: onDelete },
    ],
  )
}
