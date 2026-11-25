/**
 * One task, opened (APP-308): its title in place, its details, subtasks and
 * note. In the panel beside a list from `lg`, on a page of its own below it.
 */
import { localIsoDate } from '@gather/core/civil-date'
import { parseCents } from '@gather/core/finance'
import { subtasksOf } from '@gather/core/subtasks'
import {
  assigneeUnavailable,
  chosenAssignee,
  hasLinkAndPrice,
  normalizeTaskUrl,
  taskUrlHost,
} from '@gather/core/task-lists'
import type { Task, TaskList } from '@gather/core/task-model'
import { reminderLabel } from '@gather/core/task-reminder-pick'
import { formatPrice, priceText } from '@gather/core/wishlist'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  Bell,
  CalendarDays,
  ExternalLink,
  Flag,
  List,
  Plus,
  Repeat,
  Tag,
  User,
  X,
} from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useI18n } from '../../lib/i18n'
import { dateInWords, rowDate } from '../../lib/rowDate'
import { RowMenu } from '../app/RowMenu'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useIsDesktop } from '../app/useMediaQuery'
import { CheckRing } from './CheckRing'
import { type TaskState, useGroupToday, useTaskPeople } from './data'
import { FieldGroup, FieldRow } from './FieldRow'
import {
  LabelsEditor,
  ListEditor,
  PriorityEditor,
  ReminderEditor,
  WhenEditor,
  WhoEditor,
} from './fieldEditors'
import { RepeatEditor } from './RepeatEditor'
import { placeLink, type TaskPlace, taskLink } from './selection'
import { useWorkspace } from './TasksWorkspace'
import { useAutosave } from './useAutosave'
import { dayWords, providerName, repeatWords, upperFirst } from './words'

const CLOSE =
  'grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 cursor-pointer place-items-center rounded-[var(--radius-pill)] border-0 bg-[var(--surface-2)] text-[var(--ink)] hover:opacity-80'
const HEADING = 'm-0 text-footnote font-semibold text-[var(--muted)]'

/** The panel's contents for whatever `?task=` names. */
export function TaskPanel({
  state,
  place,
  onClose,
}: {
  state: TaskState
  place: TaskPlace
  /** Closes the panel; a page of its own has nothing to close. */
  onClose?: () => void
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.web
  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label={words.loading} className="grid gap-4 p-5">
        <span className="h-7 w-3/5 animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
        <span className="h-56 animate-pulse rounded-2xl bg-[var(--surface-2)] motion-reduce:animate-none" />
      </div>
    )
  }
  if (state.status === 'missing') {
    return (
      <section className="grid gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="m-0 font-rounded text-title-2 font-bold">
            {state.deleted ? words.deletedTitle : words.missingTitle}
          </h2>
          {onClose ? <CloseButton onClose={onClose} /> : null}
        </div>
        {state.deleted ? null : (
          <p className="m-0 text-subhead text-[var(--muted)]">
            {words.missingBody}
          </p>
        )}
        <Link
          {...placeLink(place)}
          className="inline-flex min-h-[var(--size-control-min)] items-center justify-self-start font-semibold text-[var(--home-text)]"
        >
          {place.kind === 'task' || place.kind === 'index'
            ? words.toTasks
            : words.toList}
        </Link>
      </section>
    )
  }
  return (
    <TaskEditor
      key={state.task.id}
      {...state}
      place={place}
      onClose={onClose}
    />
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const label = useI18n().messages.shell.modulePage.closePanel
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      title={label}
      className={CLOSE}
    >
      <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
    </button>
  )
}

function TaskEditor({
  task,
  list,
  tasks,
  doc,
  place,
  onClose,
}: Extract<TaskState, { status: 'ready' }> & {
  place: TaskPlace
  onClose?: () => void
}) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.web
  const { actions, complete, menu } = useWorkspace()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const { byId } = useTaskPeople()
  const local = list.provider === 'local'
  const editable = list.writable && !task.pending
  const parent = task.parentTaskId
    ? tasks.find((each) => each.id === task.parentTaskId)
    : undefined

  // Opening it is having seen that someone gave it to you (APP-302).
  const noticed = task.assignmentNotice?.at
  const markSeen = useRef(actions.markAssignmentSeen)
  markSeen.current = actions.markAssignmentSeen
  useEffect(() => {
    if (noticed !== undefined) markSeen.current(task.id).catch(() => {})
  }, [noticed, task.id])

  const addedWhen = doc
    ? new Date(doc._creationTime).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : ''
  const adder = doc ? byId.get(doc.createdBy)?.name : undefined

  return (
    <div className="grid gap-4 p-5">
      <div className="grid gap-1">
        {parent ? (
          <Link
            {...taskLink(place, parent, desktop)}
            className="inline-flex min-h-8 items-center justify-self-start text-footnote font-semibold text-[var(--muted)]"
          >
            {fmt(t.tasks.subtasks.stepOf, { title: parent.title })}
          </Link>
        ) : null}
        <div className="flex items-start gap-2.5">
          <span className="pl-2.5">
            <CheckRing
              size="l"
              label={fmt(
                task.done ? words.ring.reopen : words.ring.complete,
                { task: task.title },
              )}
              checked={task.done}
              disabled={!editable}
              onToggle={() => complete(task)}
            />
          </span>
          <TitleField task={task} editable={editable} />
          <RowMenu
            item={task.title}
            alwaysVisible
            actions={menu({
              task,
              list,
              onDeleted:
                onClose ?? (() => void navigate(placeLink(
                  { kind: 'list', listId: list.id },
                ))),
            })}
          />
          {onClose ? <CloseButton onClose={onClose} /> : null}
        </div>
      </div>

      <Fields task={task} list={list} editable={editable} />
      {hasLinkAndPrice(list.kind) ? (
        <WishlistFields task={task} list={list} editable={editable} />
      ) : null}

      {task.parentTaskId || list.grocery ? null : (
        <Subtasks
          task={task}
          list={list}
          tasks={tasks}
          place={place}
          editable={editable}
        />
      )}

      {local ? <NoteField task={task} editable={editable} /> : null}
      {local && task.repeat ? <History taskId={task.id} /> : null}

      <footer className="grid gap-1 text-footnote text-[var(--muted)]">
        {local ? <p className="m-0">{words.panel.reminderFootnote}</p> : null}
        {!local && task.repeatText ? (
          <p className="m-0">
            {fmt(t.tasks.repeat.linked, {
              provider: providerName(list.provider),
            })}
          </p>
        ) : null}
        {doc ? (
          <p className="m-0">
            {adder
              ? fmt(words.panel.addedBy, { name: adder, when: addedWhen })
              : fmt(words.panel.added, { when: addedWhen })}
          </p>
        ) : null}
        {task.sourceUrl ? (
          <a
            href={task.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 justify-self-start font-semibold text-[var(--home-text)]"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {fmt(words.panel.openSource, {
              provider: providerName(list.provider),
            })}
          </a>
        ) : null}
      </footer>
    </div>
  )
}

function SaveFailed() {
  return (
    <p
      role="alert"
      className="m-0 text-footnote font-semibold text-[var(--danger)]"
    >
      {useI18n().messages.tasks.web.panel.saveFailed}
    </p>
  )
}

/** Keeps itself, and Enter is done: a title has one line of meaning. */
function TitleField({ task, editable }: { task: Task; editable: boolean }) {
  const words = useI18n().messages.tasks.web.panel
  const { actions } = useWorkspace()
  const field = useAutosave({
    id: `${task.id}:title`,
    stored: task.title,
    save: (title) => actions.rename(task, title),
    required: true,
  })
  return (
    <div className="grid min-w-0 flex-1 gap-1">
      {editable ? (
        <textarea
          rows={1}
          aria-label={words.title}
          aria-invalid={field.failed}
          value={field.value}
          onChange={(event) =>
            field.change(event.target.value.replace(/\n/g, ' '))
          }
          onBlur={field.blur}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            event.currentTarget.blur()
          }}
          className="field-sizing-content w-full resize-none rounded-lg border-0 bg-transparent px-1 py-0.5 font-rounded text-title-2 font-bold text-[var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
        />
      ) : (
        <h2 className="m-0 px-1 py-0.5 font-rounded text-title-2 font-bold break-words">
          {task.title}
        </h2>
      )}
      {field.failed ? <SaveFailed /> : null}
    </div>
  )
}

/**
 * The details. What the list's provider cannot store is not drawn; what it
 * stores but Gather may not write is drawn without its choices (ADR-0021).
 */
function Fields({
  task,
  list,
  editable,
}: {
  task: Task
  list: TaskList
  editable: boolean
}) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.web.panel
  const { actions, fail } = useWorkspace()
  const { byId } = useTaskPeople()
  const today = useGroupToday()
  const local = list.provider === 'local'
  const section = list.sections.find((each) => each.id === task.sectionId)
  const date = task.dueDate
    ? rowDate(task.dueDate, today, locale, t.common.overdueOn)
    : undefined
  const near = task.dueDate
    ? upperFirst(dayWords(task.dueDate, today, locale, t))
    : t.tasks.web.row.noDate
  const late = Boolean(date?.overdue) && !task.done
  /** A linked list Gather cannot write shows only what is set. */
  const shown = (set: boolean) => list.writable || set

  return (
    <FieldGroup label={words.fields}>
      <FieldRow
        icon={List}
        label={words.list}
        value={section ? `${list.name} · ${section.name}` : list.name}
        // A subtask stays with its parent (APP-304).
        editor={
          local && editable && !task.parentTaskId
            ? (close) => <ListEditor task={task} list={list} onClose={close} />
            : undefined
        }
      />
      {shown(Boolean(task.dueDate)) ? (
        <FieldRow
          icon={CalendarDays}
          label={words.when}
          value={late && date ? date.text : near}
          tone={late ? 'danger' : 'muted'}
          editor={
            editable
              ? (close) => <WhenEditor task={task} onClose={close} />
              : undefined
          }
        />
      ) : null}
      {(local && !task.parentTaskId) || task.repeatText ? (
        <FieldRow
          icon={Repeat}
          label={words.repeat}
          value={
            repeatWords(task, locale, t) || t.tasks.repeat.summary.never
          }
          editor={
            local && editable
              ? (close) => (
                  <RepeatEditor
                    task={task}
                    onClose={close}
                    onSave={(rule) => {
                      actions.setRepeat(task.id, rule).catch(fail)
                    }}
                  />
                )
              : undefined
          }
        />
      ) : null}
      {local || list.assignable?.shared || chosenAssignee(task) !== null ? (
        <FieldRow
          icon={User}
          label={words.who}
          value={
            chosenAssignee(task) === null
              ? t.tasks.assignee.nobody
              : (byId.get(task.assigneeId ?? '')?.name ??
                (task.assigneeName || t.tasks.assignee.someone))
          }
          editor={
            editable && assigneeUnavailable(list) === null
              ? (close) => <WhoEditor task={task} list={list} onClose={close} />
              : undefined
          }
        />
      ) : null}
      {local ? (
        <FieldRow
          icon={Bell}
          label={words.reminder}
          value={
            task.reminder
              ? // A reminder is this device's clock, so its day is too.
                reminderLabel(
                  task.reminder,
                  localIsoDate(),
                  locale,
                  t.tasks.task,
                )
              : t.tasks.task.unset
          }
          editor={
            editable
              ? (close) => <ReminderEditor task={task} onClose={close} />
              : undefined
          }
        />
      ) : null}
      {shown(Boolean(task.priority)) ? (
        <FieldRow
          icon={Flag}
          label={words.priority}
          value={
            task.priority
              ? t.tasks.task.priorities[task.priority]
              : t.tasks.task.unset
          }
          editor={
            editable
              ? (close) => <PriorityEditor task={task} onClose={close} />
              : undefined
          }
        />
      ) : null}
      {shown(task.labels.length > 0) ? (
        <FieldRow
          icon={Tag}
          label={words.labels}
          value={task.labels.join(', ') || t.tasks.task.unset}
          editor={editable ? () => <LabelsEditor task={task} /> : undefined}
        />
      ) : null}
    </FieldGroup>
  )
}

const LINE =
  'min-h-[46px] min-w-0 flex-1 border-0 bg-transparent py-0 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]'

function WishlistFields({
  task,
  list,
  editable,
}: {
  task: Task
  list: TaskList
  editable: boolean
}) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.wishlist
  const { actions } = useWorkspace()
  const [badLink, setBadLink] = useState(false)
  const link = useAutosave({
    id: `${task.id}:link`,
    stored: task.url ?? '',
    save: (typed) => {
      const url = typed.trim() ? normalizeTaskUrl(typed) : null
      if (typed.trim() && !url) {
        setBadLink(true)
        return Promise.reject(new Error(words.invalidLink))
      }
      return actions.setUrl(task.id, url)
    },
  })
  const stored = priceText(task.priceCents, locale)
  const price = useAutosave({
    id: `${task.id}:price`,
    stored,
    save: (typed) => {
      const text = typed.replace(/[€\s]/g, '')
      const cents = text ? parseCents(text) : null
      // Not a price: the one that was there comes back.
      if (text && (cents === null || cents < 0)) return Promise.resolve()
      return actions.setPrice(task.id, cents)
    },
  })
  const openable = task.url ? normalizeTaskUrl(task.url) : null
  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }
  return (
    <div className="grid gap-1.5">
      <ul
        aria-label={list.name}
        className="m-0 list-none overflow-hidden rounded-2xl bg-[var(--ground)] p-0"
      >
        <li className="flex items-center gap-3 px-3.5">
          <label htmlFor={`link-${task.id}`}>{words.link}</label>
          <input
            id={`link-${task.id}`}
            inputMode="url"
            disabled={!editable}
            placeholder={words.linkPlaceholder}
            value={link.value}
            aria-invalid={badLink}
            onChange={(event) => {
              setBadLink(false)
              link.change(event.target.value)
            }}
            onBlur={link.blur}
            onKeyDown={onEnter}
            className={`${LINE} text-right`}
          />
          {openable ? (
            <a
              href={openable}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${words.openLink} ${taskUrlHost(openable) ?? ''}`.trim()}
              className="grid size-[var(--size-control-min)] place-items-center text-[var(--home-text)]"
            >
              <ExternalLink className="size-[18px]" aria-hidden="true" />
            </a>
          ) : null}
        </li>
        <li className="flex items-center gap-3 border-t-[0.5px] border-[var(--hair)] px-3.5">
          <label htmlFor={`price-${task.id}`}>{words.price}</label>
          <input
            id={`price-${task.id}`}
            inputMode="decimal"
            disabled={!editable}
            placeholder={words.pricePlaceholder}
            value={price.value}
            onChange={(event) => price.change(event.target.value)}
            onBlur={price.blur}
            onKeyDown={onEnter}
            className={`${LINE} text-right tabular-nums`}
          />
          <span aria-hidden="true" className="text-[var(--muted)]">
            €
          </span>
        </li>
      </ul>
      {badLink ? (
        <p
          role="alert"
          className="m-0 text-footnote font-semibold text-[var(--danger)]"
        >
          {words.invalidLink}
        </p>
      ) : link.failed || price.failed ? (
        <SaveFailed />
      ) : null}
      {task.priceCents !== undefined && !editable ? (
        <span className="sr-only">{formatPrice(task.priceCents, locale)}</span>
      ) : null}
    </div>
  )
}

function Subtasks({
  task,
  list,
  tasks,
  place,
  editable,
}: {
  task: Task
  list: TaskList
  tasks: readonly Task[]
  place: TaskPlace
  editable: boolean
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.web.panel
  const { actions, complete, menu, fail } = useWorkspace()
  const desktop = useIsDesktop()
  const [title, setTitle] = useState('')
  const rows = subtasksOf(tasks, task.id)
  const done = rows.filter((each) => each.done).length
  if (rows.length === 0 && !editable) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const sent = title.trim()
    if (!sent) return
    setTitle('')
    actions.addSubtask(task, sent).catch((error) => {
      setTitle((now) => now || sent)
      fail(error, t.tasks.subtasks.failed)
    })
  }
  const move = (from: number, to: number) => {
    const ids = rows.map((each) => each.id)
    ids.splice(to, 0, ...ids.splice(from, 1))
    actions.reorderSubtasks(task.id, ids).catch(fail)
  }
  const local = list.provider === 'local'

  return (
    <section className="grid gap-2">
      <h3 className={HEADING}>
        {rows.length > 0
          ? fmt(words.subtasksCount, { done, total: rows.length })
          : words.subtasks}
      </h3>
      <ul className="m-0 list-none rounded-2xl bg-[var(--ground)] p-0">
        {rows.map((each, at) => (
          <li
            key={each.id}
            className="group/row flex min-h-[46px] items-center gap-2.5 pr-2 pl-3.5 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
          >
            <CheckRing
              size="s"
              label={fmt(
                each.done ? t.tasks.web.ring.reopen : t.tasks.web.ring.complete,
                { task: each.title },
              )}
              checked={each.done}
              disabled={!editable || each.pending}
              onToggle={() => complete(each)}
            />
            <Link
              {...taskLink(place, each, desktop)}
              className={`flex min-h-[46px] min-w-0 flex-1 items-center break-words no-underline ${
                each.done
                  ? 'text-[var(--muted)] line-through'
                  : 'text-[var(--ink)]'
              }`}
            >
              {each.title}
            </Link>
            <RowMenu
              item={each.title}
              actions={menu({
                task: each,
                list,
                onMove:
                  local && editable
                    ? {
                        up: at > 0 ? () => move(at, at - 1) : undefined,
                        down:
                          at < rows.length - 1
                            ? () => move(at, at + 1)
                            : undefined,
                      }
                    : undefined,
              })}
            />
          </li>
        ))}
        {editable ? (
          <li className="px-3.5 [li+&]:border-t-[0.5px] [li+&]:border-[var(--hair)]">
            <form onSubmit={submit} className="flex items-center gap-2.5">
              <Plus
                className="size-[18px] shrink-0 text-[var(--home-text)]"
                aria-hidden="true"
              />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  // Escape leaves the field first, then the panel.
                  if (event.key !== 'Escape' || !title) return
                  event.preventDefault()
                  setTitle('')
                }}
                enterKeyHint="done"
                autoComplete="off"
                aria-label={fmt(t.tasks.linkedWrite.addSubtask, {
                  task: task.title,
                })}
                placeholder={words.addSubtask}
                className={LINE}
              />
            </form>
          </li>
        ) : null}
      </ul>
    </section>
  )
}

function NoteField({ task, editable }: { task: Task; editable: boolean }) {
  const words = useI18n().messages.tasks.web.panel
  const { actions } = useWorkspace()
  const field = useAutosave({
    id: `${task.id}:notes`,
    stored: task.notes ?? '',
    save: (notes) => actions.setNotes(task.id, notes),
    delay: 800,
  })
  if (!editable && !task.notes) return null
  return (
    <section className="grid gap-2">
      <h3 className={HEADING}>{words.note}</h3>
      <textarea
        rows={2}
        aria-label={words.note}
        aria-invalid={field.failed}
        disabled={!editable}
        placeholder={words.noteEmpty}
        value={field.value}
        onChange={(event) => field.change(event.target.value)}
        onBlur={field.blur}
        className="field-sizing-content min-h-[72px] w-full resize-none rounded-2xl border-0 bg-[var(--ground)] px-3.5 py-3 text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
      />
      {field.failed ? <SaveFailed /> : null}
    </section>
  )
}

/** When a repeating task was done before, and by whom (APP-303). */
function History({ taskId }: { taskId: string }) {
  const { locale, messages: t } = useI18n()
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const rows = useQuery(api.tasks.completions, {
    taskId: taskId as Id<'tasks'>,
    groupSlug,
  })
  if (!rows || rows.length === 0) return null
  return (
    <section className="grid gap-2">
      <h3 className={HEADING}>{t.tasks.web.panel.history}</h3>
      <ul className="m-0 list-none rounded-2xl bg-[var(--ground)] p-0">
        {rows.map((row) => (
          <li
            key={row._id}
            className="flex min-h-[46px] items-center px-3.5 text-subhead text-[var(--muted)] [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
          >
            {fmt(t.tasks.repeat.historyEntry, {
              name: row.byName ?? t.tasks.repeat.someone,
              when: dateInWords(row.completedOn, locale),
            })}
          </li>
        ))}
      </ul>
    </section>
  )
}
