import { createFileRoute } from '@tanstack/react-router'
import { NotesError } from '../../../components/notes/NotesError'
import { NotesPage } from '../../../components/notes/NotesPage'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/notes/')({
  errorComponent: NotesError,
  component: NotesRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): { note?: string; new?: true } => ({
    ...(typeof search.note === 'string' && search.note
      ? { note: search.note }
      : {}),
    ...validateNewSearch(search),
  }),
})

function NotesRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <NotesPage
      noteId={search.note}
      startCreating={search.new}
      onCreateStarted={() =>
        void navigate({
          search: search.note ? { note: search.note } : {},
          replace: true,
        })
      }
    />
  )
}
