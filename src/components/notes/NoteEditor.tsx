import { Pin, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { RowMenu } from '../app/RowMenu'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import {
  changeDraft,
  discardDraft,
  flushDraft,
  type NoteFields,
  retryDraft,
  useNoteDraft,
} from './noteDrafts'
import { noteWhen } from './noteText'
import { type Note, useDraftKey, useNoteActions } from './useNotes'

const FIELD =
  'w-full border-0 bg-transparent p-0 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]'
const LABEL = 'text-footnote text-[var(--muted)]'

/**
 * One note, open for typing (APP-351). There is no edit mode: what is typed is
 * saved by `noteDrafts`, and the top row says so. A draft wins over the saved
 * note until it is saved; without one the field follows the note, so another
 * Member's change shows.
 */
export function NoteEditor({
  note,
  onTogglePin,
  onDelete,
  onClose,
}: {
  note: Note
  onTogglePin: () => void
  onDelete: () => void
  /** Only where the panel replaced the list (below `lg`). */
  onClose?: () => void
}) {
  const { locale, messages } = useI18n()
  const words = messages.notes
  const errorText = useErrorMessage()
  const { timeZone } = useRequiredCurrentGroup()
  const { save } = useNoteActions()
  const key = useDraftKey()(note._id)
  const draft = useNoteDraft(key)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const title = draft?.fields.title ?? note.title
  const body = draft?.fields.body ?? note.body
  const change = (fields: NoteFields) =>
    changeDraft(key, fields, (changes) => save(note._id, changes))

  // Leaving mid-sentence keeps the sentence.
  useEffect(() => () => flushDraft(key), [key])

  // An empty note is a new one: start at its title. After the layout has moved
  // focus into the panel, which happens when the record opens.
  const startEmpty = useRef(title === '' && body === '')
  useEffect(() => {
    if (!startEmpty.current) return
    const timer = setTimeout(() => {
      startEmpty.current = false
      titleRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const when = noteWhen(note.updatedAt, locale, words.today, timeZone)
  const edited = note.updatedByMe
    ? fmt(words.web.editedByYou, { when })
    : note.updatedByName === null
      ? fmt(words.web.edited, { when })
      : fmt(words.web.editedBy, { when, name: note.updatedByName })
  const failed = draft?.state === 'failed'
  const status = !draft
    ? words.web.saved
    : failed
      ? words.web.notSaved
      : messages.common.actions.saving
  const pinLabel = note.pinned ? words.unpin : words.pin

  return (
    <div
      data-testid="note-editor"
      className="flex min-h-[560px] flex-col gap-3 px-4 py-4 lg:px-7 lg:py-[22px]"
    >
      <div className="flex items-center gap-2">
        <p className={`m-0 min-w-0 flex-1 ${LABEL}`}>
          {edited}
          {' · '}
          <span
            role="status"
            data-testid="note-status"
            className={failed ? 'font-semibold text-[var(--danger)]' : ''}
          >
            {status}
          </span>
        </p>
        <button
          type="button"
          aria-label={pinLabel}
          title={pinLabel}
          onClick={onTogglePin}
          className={`grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] hover:opacity-80 ${
            note.pinned
              ? 'bg-[var(--home-wash)] text-[var(--home-text)]'
              : 'bg-[var(--surface-2)] text-[var(--ink)]'
          }`}
        >
          <Pin
            className="size-4"
            fill={note.pinned ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
        <span className="rounded-[var(--radius-pill)] bg-[var(--surface-2)]">
          <RowMenu
            item={title.trim() || words.untitled}
            alwaysVisible
            actions={[
              {
                id: 'delete',
                label: words.delete,
                danger: true,
                icon: <Trash2 className="size-4" aria-hidden="true" />,
                onSelect: onDelete,
              },
            ]}
          />
        </span>
        {onClose ? (
          <button
            type="button"
            aria-label={messages.shell.modulePage.closePanel}
            title={messages.shell.modulePage.closePanel}
            onClick={onClose}
            className="grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] text-[var(--ink)] hover:opacity-80 lg:hidden"
          >
            <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-3 py-2"
        >
          <p className="m-0 min-w-0 flex-1 text-subhead text-[var(--danger)]">
            {fmt(words.web.notSavedBody, {
              reason: errorText(
                draft.error,
                messages.common.errors.didNotWork,
                words.refusals,
              ),
            })}
          </p>
          <button
            type="button"
            onClick={() => retryDraft(key)}
            className={`${buttonClass.small} pointer-coarse:min-h-[var(--size-control-min)]`}
          >
            {messages.common.actions.retry}
          </button>
        </div>
      ) : null}

      <input
        ref={titleRef}
        type="text"
        value={title}
        aria-label={words.titlePlaceholder}
        placeholder={words.titlePlaceholder}
        autoComplete="off"
        onChange={(event) => change({ title: event.target.value })}
        onBlur={() => flushDraft(key)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          event.preventDefault()
          bodyRef.current?.focus()
        }}
        className={`${FIELD} font-rounded text-[28px] leading-[34px] font-bold`}
      />
      <textarea
        ref={bodyRef}
        value={body}
        aria-label={words.bodyPlaceholder}
        placeholder={words.bodyPlaceholder}
        onChange={(event) => change({ body: event.target.value })}
        onBlur={() => flushDraft(key)}
        className={`${FIELD} field-sizing-content min-h-[320px] max-w-[680px] flex-1 resize-none text-[17px] leading-[26px]`}
      />
    </div>
  )
}

/** The panel or page when there is no note to edit: on its way, or gone. */
export function NoteNotice({
  noteId,
  loading,
  onBack,
}: {
  noteId: string
  loading: boolean
  onBack: () => void
}) {
  const { messages } = useI18n()
  const words = messages.notes.web
  const key = useDraftKey()(noteId)
  const draft = useNoteDraft(key)
  const kept = [draft?.fields.title, draft?.fields.body]
    .filter((text) => text !== undefined)
    .join('\n')

  if (loading)
    return (
      <div
        aria-busy="true"
        aria-label={messages.common.errors.loading}
        className="grid gap-4 p-7"
      >
        <span className="h-4 w-56 animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
        <span className="h-8 w-72 max-w-full animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
        <span className="h-4 w-full animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
      </div>
    )

  return (
    <div className="grid justify-items-start gap-3 p-5 lg:p-7">
      <h2 className="m-0 font-rounded text-title-2 font-bold">
        {messages.common.errors.notFound}
      </h2>
      <p role="status" className="m-0 text-subhead text-[var(--muted)]">
        {words.notFoundBody}
      </p>
      {draft && kept ? (
        <label className="grid w-full gap-1">
          <span className={LABEL}>{words.unsavedText}</span>
          <textarea
            readOnly
            value={kept}
            rows={6}
            className="w-full rounded-[var(--radius-control)] border-0 bg-[var(--surface-2)] p-3 text-body text-[var(--ink)]"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className={buttonClass.secondary}
        >
          {words.backToNotes}
        </button>
        {draft ? (
          <button
            type="button"
            onClick={() => discardDraft(key)}
            className={buttonClass.danger}
          >
            {words.discard}
          </button>
        ) : null}
      </div>
    </div>
  )
}
