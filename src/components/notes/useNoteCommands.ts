import { useState } from 'react'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import { type Note, useNoteActions } from './useNotes'

type Target = Pick<Note, '_id' | 'title' | 'pinned'>

/** Pin and delete, the same from a row, the panel and a note's own page. */
export function useNoteCommands() {
  const messages = useMessages()
  const words = messages.notes
  const actions = useNoteActions()
  const errorText = useErrorMessage()
  const { confirm, dialog } = useConfirmAction()
  const [error, setError] = useState<string | null>(null)

  return {
    dialog,
    error,
    setError,
    createEmpty: actions.createEmpty,
    togglePin: async (note: Target) => {
      setError(null)
      try {
        await actions.togglePin(note)
      } catch (caught) {
        setError(errorText(caught, messages.common.errors.didNotWork))
      }
    },
    confirmDelete: (note: Target, onDeleted: () => void) =>
      confirm({
        title: fmt(words.deleteTitle, {
          title: note.title.trim() || words.untitled,
        }),
        body: words.deleteBody,
        confirmLabel: messages.common.actions.delete,
        run: async () => {
          await actions.remove(note._id)
          onDeleted()
        },
      }),
  }
}
