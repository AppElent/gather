import { Pin, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { RowMenu } from '../app/RowMenu'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import {
  changeDraft,
  discardDraft,
  flushDraft,
  keepMineDraft,
  type NoteFields,
  type NoteText,
  retryDraft,
  type TheirNote,
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
  onOpen,
}: {
  note: Note
  onTogglePin: () => void
  onDelete: () => void
  /** Only where the panel replaced the list (below `lg`). */
  onClose?: () => void
  /** Opens another note: the copy made from a conflict. */
  onOpen: (noteId: string) => void
}) {
  const { locale, messages } = useI18n()
  const words = messages.notes
  const errorText = useErrorMessage()
  const { timeZone } = useRequiredCurrentGroup()
  const { save, copy } = useNoteActions()
  const key = useDraftKey()(note._id)
  const draft = useNoteDraft(key)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const title = draft?.fields.title ?? note.title
  const body = draft?.fields.body ?? note.body
  const change = (fields: NoteFields) =>
    changeDraft(
      key,
      fields,
      (changes, baseUpdatedAt) => save(note._id, changes, baseUpdatedAt),
      { title: note.title, body: note.body, updatedAt: note.updatedAt },
    )

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
  const theirs = draft?.state === 'conflict' ? draft.theirs : undefined
  const status = !draft
    ? words.web.saved
    : failed || theirs
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
            className={
              failed || theirs ? 'font-semibold text-[var(--danger)]' : ''
            }
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

      {theirs ? (
        <NoteConflict
          mine={{ title, body }}
          theirs={theirs}
          onKeepMine={() => keepMineDraft(key)}
          onKeepTheirs={() => discardDraft(key)}
          onCopyMine={async (idempotencyKey) => {
            const id = await copy({ title, body }, idempotencyKey)
            discardDraft(key)
            onOpen(id)
          }}
        />
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

/**
 * Another Member saved this note while this person was typing (APP-994), as
 * the phone's `NoteConflictSheet` shows it. Nothing was overwritten: both
 * versions are shown, and nothing more is sent until the person chooses.
 */
function NoteConflict({
  mine,
  theirs,
  onKeepMine,
  onKeepTheirs,
  onCopyMine,
}: {
  mine: NoteText
  theirs: TheirNote
  onKeepMine: () => void
  onKeepTheirs: () => void
  onCopyMine: (idempotencyKey: string) => Promise<void>
}) {
  const { messages } = useI18n()
  const words = messages.notes.web.conflict
  const errorText = useErrorMessage()
  const [copying, setCopying] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  // Kept until a copy succeeds, so a retry answers with the same note.
  const copyKey = useRef<string | null>(null)

  const copyMine = async () => {
    copyKey.current ??= `web-note-copy-${crypto.randomUUID()}`
    setCopying(true)
    setCopyError(null)
    try {
      await onCopyMine(copyKey.current)
    } catch (caught) {
      setCopying(false)
      setCopyError(
        fmt(words.copyFailed, {
          reason: errorText(
            caught,
            messages.common.errors.didNotWork,
            messages.notes.refusals,
          ),
        }),
      )
    }
  }

  return (
    <section
      role="alert"
      aria-labelledby="note-conflict-title"
      data-testid="note-conflict"
      className="grid gap-3 rounded-[var(--radius-control)] bg-[var(--surface-2)] p-3"
    >
      <div className="grid gap-1">
        <h2
          id="note-conflict-title"
          className="m-0 text-body font-semibold text-[var(--ink)]"
        >
          {words.title}
        </h2>
        <p className="m-0 text-subhead text-[var(--muted)]">
          {theirs.updatedByName === null
            ? words.changedBySomeone
            : fmt(words.changedBy, { name: theirs.updatedByName })}
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <ConflictVersion
          testId="note-conflict-theirs"
          label={words.theirs}
          text={theirs}
        />
        <ConflictVersion
          testId="note-conflict-mine"
          label={words.mine}
          text={mine}
        />
      </div>
      {copyError ? (
        <p className="m-0 text-subhead text-[var(--danger)]">{copyError}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={copying}
          onClick={onKeepMine}
          className={buttonClass.primary}
        >
          {words.keepMine}
        </button>
        <button
          type="button"
          disabled={copying}
          onClick={onKeepTheirs}
          className={buttonClass.onWash}
        >
          {words.keepTheirs}
        </button>
        <button
          type="button"
          disabled={copying}
          aria-busy={copying}
          onClick={() => void copyMine()}
          className={buttonClass.onWash}
        >
          {copying ? messages.common.actions.working : words.copyMine}
        </button>
      </div>
    </section>
  )
}

function ConflictVersion({
  testId,
  label,
  text,
}: {
  testId: string
  label: string
  text: NoteText
}) {
  const { messages } = useI18n()
  return (
    <div
      data-testid={testId}
      className="grid min-w-0 content-start gap-1 rounded-[var(--radius-control)] bg-[var(--surface)] p-3"
    >
      <p className={`m-0 font-semibold ${LABEL}`}>{label}</p>
      <p className="m-0 font-semibold break-words text-[var(--ink)]">
        {text.title || messages.notes.untitled}
      </p>
      {text.body ? (
        <p className="m-0 max-h-60 overflow-y-auto break-words whitespace-pre-wrap text-subhead text-[var(--ink)]">
          {text.body}
        </p>
      ) : null}
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
