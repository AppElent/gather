import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { type AppLink, linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { EmptyState } from '../app/EmptyState'
import { InsetList, SectionLabel } from '../app/InsetList'
import { ListDetailLayout, ListLoadingState } from '../app/ListDetailLayout'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useIsDesktop } from '../app/useMediaQuery'
import { type StartCreatingProps, useStartCreating } from '../app/useStartCreating'
import { WashHeader } from '../app/WashHeader'
import { inputClass } from '../recipes/fields'
import { NoteEditor, NoteNotice } from './NoteEditor'
import { NoteRow } from './NoteRow'
import { useNoteCommands } from './useNoteCommands'
import { MIN_QUERY, type Note, useNote, useNotesList } from './useNotes'

const SEARCH_PAUSE = 250

/**
 * Notes on the web (APP-351): the list-and-detail layout turned around, a
 * 340 px list (Pinned, then Recent) beside the note itself, which is open for
 * typing. `?note=<id>` is the selection; below 1024 px a row goes to the note's
 * own page.
 */
export function NotesPage({
  noteId,
  startCreating,
  onCreateStarted,
}: StartCreatingProps & { noteId?: string }) {
  const { slug: groupSlug, name: groupName } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const words = messages.notes
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const errorText = useErrorMessage()
  const commands = useNoteCommands()
  const { loading, pinned, rest, hasMore, loadingMore, loadMore } =
    useNotesList()
  const note = useNote(noteId)

  const [typed, setTyped] = useState('')
  const query = usePaused(typed.trim(), SEARCH_PAUSE)
  const searching = typed.trim().length > 0
  const found = useQuery(
    api.notes.searchNotes,
    searching && query.length >= MIN_QUERY ? { groupSlug, query } : 'skip',
  )
  const searchRef = useRef<HTMLInputElement>(null)

  const addressOf = (id: string): AppLink =>
    isDesktop
      ? { ...linkTo('notes'), search: { note: id } }
      : linkTo('note', { noteId: id })
  const close = () => void navigate({ ...linkTo('notes'), search: {} })

  // Where the layout has no row to return to (a reload, a new note, a row that
  // moved to Pinned), closing still lands on the note's row.
  const lastOpen = useRef(noteId)
  useEffect(() => {
    const closed = lastOpen.current
    lastOpen.current = noteId
    if (!closed || noteId) return
    const row = Array.from(
      document.querySelectorAll<HTMLElement>('[data-note]'),
    ).find((candidate) => candidate.dataset.note === closed)
    const list = row?.closest('[data-layout="list-detail"] > div')
    const active = document.activeElement
    if (active && active !== document.body && !list?.contains(active)) return
    row?.closest('a')?.focus({ preventScroll: true })
  }, [noteId])

  const latestAddress = useRef(addressOf)
  latestAddress.current = addressOf
  const creating = useRef(false)
  const create = async () => {
    if (creating.current) return
    creating.current = true
    commands.setError(null)
    try {
      const id = await commands.createEmpty()
      setTyped('')
      void navigate(latestAddress.current(id))
    } catch (caught) {
      commands.setError(errorText(caught, words.web.createFailed))
    } finally {
      creating.current = false
    }
  }
  useStartCreating({ startCreating, onCreateStarted }, () => void create())

  const clearSearch = () => {
    setTyped('')
    searchRef.current?.focus()
  }

  const row = (item: Note) => (
    <NoteRow
      key={item._id}
      note={item}
      selected={isDesktop && noteId === item._id}
      link={addressOf(item._id)}
      onTogglePin={() => void commands.togglePin(item)}
      onDelete={() => confirmDelete(item)}
    />
  )
  const confirmDelete = (item: Note) =>
    commands.confirmDelete(item, () => {
      if (noteId === item._id) close()
    })

  const section = (id: string, label: string, notes: readonly Note[]) =>
    notes.length > 0 ? (
      <section aria-labelledby={id}>
        <SectionLabel id={id}>{label}</SectionLabel>
        <InsetList>{notes.map(row)}</InsetList>
      </section>
    ) : null

  const total = pinned.length + rest.length
  const none = !loading && total === 0 && !hasMore

  const list = (
    <>
      {commands.error ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface)] px-4 py-3 text-subhead font-semibold text-[var(--danger)]"
        >
          {commands.error}
        </p>
      ) : null}

      {loading || none ? null : (
        <div className="flex items-center gap-2">
          <input
            ref={searchRef}
            type="search"
            value={typed}
            aria-label={words.search}
            placeholder={words.search}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || typed === '') return
              event.preventDefault()
              clearSearch()
            }}
            className={`${inputClass} min-w-0 flex-1 [&::-webkit-search-cancel-button]:hidden`}
          />
          {typed ? (
            <button
              type="button"
              aria-label={words.web.clearSearch}
              title={words.web.clearSearch}
              onClick={clearSearch}
              className={buttonClass.round}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}

      {searching ? (
        query.length < MIN_QUERY ? (
          <p className="m-0 px-1 text-subhead text-[var(--muted)]">
            {words.web.searchHint}
          </p>
        ) : found === undefined ? (
          <ListLoadingState label={messages.common.errors.loading} sections={1} />
        ) : found.length === 0 ? (
          <EmptyState
            kind="nothing-found"
            title={words.web.searchNone}
            action={{ label: words.web.clearSearch, onClick: clearSearch }}
          />
        ) : (
          <InsetList label={words.search}>{found.map(row)}</InsetList>
        )
      ) : loading ? (
        <ListLoadingState label={messages.common.errors.loading} />
      ) : none ? (
        <EmptyState
          kind="nothing-yet"
          tile={{ group: 'home', icon: 'NotebookPen' }}
          title={words.empty}
          body={words.web.emptyBody}
          action={{ label: words.newNote, onClick: () => void create() }}
        />
      ) : (
        <>
          {section('notes-pinned', words.pinned, pinned)}
          {section('notes-recent', words.recent, rest)}
          {hasMore ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={loadMore}
              className={buttonClass.onWash}
            >
              {loadingMore ? messages.common.actions.working : words.showMore}
            </button>
          ) : null}
        </>
      )}
    </>
  )

  const panel = noteId ? (
    note ? (
      <NoteEditor
        key={note._id}
        note={note}
        onTogglePin={() => void commands.togglePin(note)}
        onDelete={() => confirmDelete(note)}
        onClose={close}
        onOpen={(id) => void navigate(addressOf(id))}
      />
    ) : (
      <NoteNotice
        key={noteId}
        noteId={noteId}
        loading={note === undefined}
        onBack={close}
      />
    )
  ) : none ? undefined : (
    <div className="grid min-h-[560px] content-center">
      <EmptyState
        kind="nothing-for-you"
        title={words.web.pickTitle}
        body={words.web.pickBody}
      />
    </div>
  )

  return (
    <>
      <ListDetailLayout
        header={
          <WashHeader
            group="home"
            icon="NotebookPen"
            title={messages.modules.byId.notes.label}
            summary={
              loading
                ? undefined
                : {
                    count: hasMore
                      ? fmt(words.web.summaryMore, { count: total })
                      : plural(locale, total, words.web.summary),
                    scope:
                      pinned.length > 0
                        ? fmt(words.web.summaryPinned, { count: pinned.length })
                        : groupName,
                  }
            }
            onSearch={
              loading || none ? undefined : () => searchRef.current?.focus()
            }
            primary={{ label: words.newNote, onClick: () => void create() }}
          />
        }
        list={list}
        panel={panel}
        panelLabel={words.web.note}
        recordKey={noteId}
        onCloseRecord={close}
        width={340}
        wide="panel"
      />
      {commands.dialog}
    </>
  )
}

/** `value` once it has stopped changing for a moment. */
function usePaused(value: string, pause: number): string {
  const [paused, setPaused] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setPaused(value), pause)
    return () => clearTimeout(timer)
  }, [value, pause])
  return paused
}
