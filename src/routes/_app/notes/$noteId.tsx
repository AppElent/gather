import { createFileRoute } from '@tanstack/react-router'
import { NotePage } from '../../../components/notes/NotePage'
import { NotesError } from '../../../components/notes/NotesError'

export const Route = createFileRoute('/_app/notes/$noteId')({
  errorComponent: NotesError,
  component: NoteRoute,
})

function NoteRoute() {
  const { noteId } = Route.useParams()
  return <NotePage noteId={noteId} />
}
