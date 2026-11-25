import { useNavigate } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { WashHeader } from '../app/WashHeader'
import { NoteEditor, NoteNotice } from './NoteEditor'
import { useNoteCommands } from './useNoteCommands'
import { useNote } from './useNotes'

/** `/notes/$noteId`: where a row goes below `lg`, and linkable. */
export function NotePage({ noteId }: { noteId: string }) {
  const messages = useMessages()
  const words = messages.notes
  const navigate = useNavigate()
  const commands = useNoteCommands()
  const note = useNote(noteId)
  const moduleName = messages.modules.byId.notes.label
  const back = () => void navigate(linkTo('notes'))

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs
        trail={[
          { label: moduleName, link: linkTo('notes') },
          { label: note ? note.title.trim() || words.untitled : words.web.note },
        ]}
        className="-mb-1"
        backInHeader
      />
      <WashHeader
        group="home"
        icon="NotebookPen"
        title={words.web.note}
        back={{ label: moduleName, link: linkTo('notes') }}
      />
      {commands.error ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface)] px-4 py-3 text-subhead font-semibold text-[var(--danger)]"
        >
          {commands.error}
        </p>
      ) : null}
      <div className="rounded-[var(--radius-card)] bg-[var(--surface)]">
        {note ? (
          <NoteEditor
            key={note._id}
            note={note}
            onTogglePin={() => void commands.togglePin(note)}
            onDelete={() => commands.confirmDelete(note, back)}
          />
        ) : (
          <NoteNotice
            key={noteId}
            noteId={noteId}
            loading={note === undefined}
            onBack={back}
          />
        )}
      </div>
      {commands.dialog}
    </div>
  )
}
