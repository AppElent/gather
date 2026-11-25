/** What each row of a task's Details opens: the phone's own choices. */
import { addDays, localIsoDate } from '@gather/core/civil-date'
import { weekendFrom } from '@gather/core/task-dates'
import { assignablePeople, chosenAssignee } from '@gather/core/task-lists'
import type { Task, TaskList } from '@gather/core/task-model'
import {
  availablePresets,
  clockOfDate,
  dateOfClock,
  initialPick,
} from '@gather/core/task-reminder-pick'
import { presetClock, type ReminderPreset } from '@gather/core/task-reminders'
import { deviceTimeZone } from '@gather/core/time-zones'
import { useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useI18n } from '../../lib/i18n'
import { dateInWords } from '../../lib/rowDate'
import { buttonClass } from '../app/buttons'
import { RowMenu } from '../app/RowMenu'
import { inputClass } from '../recipes/fields'
import { ChoiceList } from './ChoiceList'
import { useGroupLabels, useGroupToday, useTaskLists, useTaskPeople } from './data'
import { Coin } from './ListTile'
import { useWorkspace } from './TasksWorkspace'

interface EditorProps {
  task: Task
  onClose: () => void
}

const NOTE = 'm-0 px-1 text-footnote text-[var(--muted)]'
const HEADING = 'm-0 px-1 text-footnote font-semibold text-[var(--muted)]'

export function WhenEditor({ task, onClose }: EditorProps) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.task
  const { actions, fail } = useWorkspace()
  const today = useGroupToday()
  const [picked, setPicked] = useState(task.dueDate ?? '')
  const fieldId = useId()
  const set = (date: string | undefined) => {
    onClose()
    if (date !== task.dueDate) actions.setDue(task, date).catch(fail)
  }
  const shortcuts = [
    { id: today, name: words.today },
    { id: addDays(today, 1), name: words.tomorrow },
    { id: weekendFrom(today), name: words.weekend },
  ].filter(
    // On a Friday, tomorrow is the weekend.
    (each, at, all) => all.findIndex((other) => other.id === each.id) === at,
  )
  return (
    <>
      <ChoiceList<string | null>
        label={t.tasks.web.panel.when}
        current={task.dueDate ?? null}
        options={[
          ...shortcuts.map((each) => ({
            id: each.id,
            label: (
              <>
                <span className="flex-1">{each.name}</span>
                <span className="text-footnote font-normal text-[var(--muted)]">
                  {dateInWords(each.id, locale)}
                </span>
              </>
            ),
          })),
          { id: null, label: words.clear },
        ]}
        onChoose={(id) => set(id ?? undefined)}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (picked) set(picked)
        }}
        className="grid gap-1.5"
      >
        <label htmlFor={fieldId} className={HEADING}>
          {t.tasks.web.panel.pickDate}
        </label>
        <div className="flex gap-2">
          <input
            id={fieldId}
            type="date"
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
            className={`${inputClass} min-h-[var(--size-control-min)] min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={!picked}
            className={buttonClass.secondary}
          >
            {t.common.actions.save}
          </button>
        </div>
      </form>
    </>
  )
}

export function WhoEditor({
  task,
  list,
  onClose,
}: EditorProps & { list: TaskList }) {
  const { messages: t } = useI18n()
  const { actions, fail } = useWorkspace()
  const { people } = useTaskPeople()
  const current = chosenAssignee(task)
  return (
    <ChoiceList<string | null>
      label={t.tasks.assignee.who}
      current={current}
      options={[
        { id: null, label: t.tasks.assignee.nobody },
        ...assignablePeople(list, people).map((person) => ({
          id: person.id,
          label: (
            <>
              <Coin initial={person.initial} />
              {person.name}
            </>
          ),
        })),
      ]}
      onChoose={(id) => {
        onClose()
        if (id !== current) actions.setAssignee(task, id).catch(fail)
      }}
    />
  )
}

export function PriorityEditor({ task, onClose }: EditorProps) {
  const { messages: t } = useI18n()
  const { actions, fail } = useWorkspace()
  return (
    <ChoiceList<1 | 2 | 3 | 4 | null>
      label={t.tasks.task.priority}
      current={task.priority ?? null}
      options={[
        ...([1, 2, 3, 4] as const).map((id) => ({
          id,
          label: t.tasks.task.priorities[id],
        })),
        { id: null, label: t.tasks.task.unset },
      ]}
      onChoose={(id) => {
        onClose()
        if (id !== (task.priority ?? null))
          actions.setPriority(task, id ?? undefined).catch(fail)
      }}
    />
  )
}

/** A reminder goes to whoever sets it, on the phone (APP-305). */
export function ReminderEditor({ task, onClose }: EditorProps) {
  const { messages: t } = useI18n()
  const words = t.tasks.task.reminderSheet
  const panel = t.tasks.web.panel
  const { actions, fail } = useWorkspace()
  const me = useQuery(api.users.me, {})
  const [now] = useState(() => new Date())
  const [draft, setDraft] = useState(() =>
    clockOfDate(initialPick(task.reminder, task.dueDate, now)),
  )
  const [passed, setPassed] = useState(false)
  const presets = availablePresets(task.dueDate, now)
  const presetLabel: Record<ReminderPreset, string> = {
    dueDay: words.dueDay,
    eveningBefore: words.eveningBefore,
  }
  const someoneElse = Boolean(
    task.reminder && me && task.reminder.userId !== me._id,
  )
  const save = (clock: Parameters<typeof actions.setReminder>[1]) => {
    onClose()
    actions
      .setReminder(task.id, clock)
      .catch((error) => fail(error, words.failed))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (dateOfClock(draft).getTime() < Date.now() - 60_000) {
      setPassed(true)
      return
    }
    save({ ...draft, timeZone: deviceTimeZone() })
  }

  return (
    <>
      {presets.length > 0 ? (
        <ChoiceList<ReminderPreset | null>
          label={t.tasks.task.reminder}
          current={null}
          options={presets.map((id) => ({ id, label: presetLabel[id] }))}
          onChoose={(id) => {
            if (id && task.dueDate)
              save(presetClock(id, task.dueDate, deviceTimeZone()))
          }}
        />
      ) : null}
      <form onSubmit={submit} className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
          <label className={`grid gap-1.5 ${HEADING}`}>
            {panel.pickDate}
            <input
              type="date"
              required
              value={draft.date}
              min={localIsoDate(now)}
              onChange={(event) => {
                setPassed(false)
                setDraft({ ...draft, date: event.target.value })
              }}
              className={`${inputClass} min-h-[var(--size-control-min)] min-w-0 text-[var(--ink)]`}
            />
          </label>
          <label className={`grid gap-1.5 ${HEADING}`}>
            {panel.pickTime}
            <input
              type="time"
              required
              value={draft.time}
              onChange={(event) => {
                setPassed(false)
                setDraft({ ...draft, time: event.target.value })
              }}
              className={`${inputClass} min-h-[var(--size-control-min)] min-w-0 text-[var(--ink)]`}
            />
          </label>
        </div>
        {passed ? (
          <p
            role="alert"
            className="m-0 px-1 text-footnote font-semibold text-[var(--danger)]"
          >
            {words.passed}
          </p>
        ) : null}
        <button type="submit" className={buttonClass.primary}>
          {panel.setReminder}
        </button>
      </form>
      <p className={NOTE}>
        {someoneElse ? words.someoneElse : words.footnote}
      </p>
      {task.reminder ? (
        <button
          type="button"
          onClick={() => save(null)}
          className={buttonClass.danger}
        >
          {words.remove}
        </button>
      ) : null}
    </>
  )
}

/** The list it is on and, when that list has them, its section. */
export function ListEditor({
  task,
  list,
  onClose,
}: EditorProps & { list: TaskList }) {
  const { messages: t } = useI18n()
  const words = t.tasks.web
  const { actions, fail, show } = useWorkspace()
  const lists = useTaskLists()
  const options = (lists ?? [])
    .filter(
      (each) =>
        each._id === list.id ||
        (each.provider === 'local' && each.writable && !each.grocery),
    )
    .map((each) => ({ id: each._id as string, label: each.name }))
  return (
    <>
      <ChoiceList
        label={words.panel.list}
        current={task.listId}
        options={options}
        onChoose={(id) => {
          onClose()
          if (id === task.listId) return
          actions.moveToList(task.id, id).then(
            () =>
              show({
                message: fmt(words.moved, {
                  list: options.find((each) => each.id === id)?.label ?? '',
                }),
              }),
            fail,
          )
        }}
      />
      {list.sections.length > 0 ? (
        <>
          <h4 className={HEADING}>{words.panel.section}</h4>
          <ChoiceList<string | null>
            label={words.panel.section}
            current={
              list.sections.find((each) => each.id === task.sectionId)?.id ??
              null
            }
            options={[
              { id: null, label: t.tasks.sections.none },
              ...list.sections.map((each) => ({
                id: each.id,
                label: each.name,
              })),
            ]}
            onChoose={(id) => {
              onClose()
              if (id !== (task.sectionId ?? null))
                actions.setTaskSection(task.id, id).catch(fail)
            }}
          />
        </>
      ) : null}
    </>
  )
}

/** A label exists while a task carries the word; there is no table of them. */
export function LabelsEditor({ task }: { task: Task }) {
  const { messages: t } = useI18n()
  const words = t.tasks.task
  const { actions, fail, confirm } = useWorkspace()
  const group = useGroupLabels()
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const others = group.filter((label) => !task.labels.includes(label))
  const set = (labels: string[]) => actions.setLabels(task, labels).catch(fail)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const label = draft.trim().replace(/^#/, '')
    setDraft('')
    setRenaming(null)
    if (!label) return
    if (renaming) {
      if (label !== renaming) actions.renameLabel(renaming, label).catch(fail)
    } else if (!task.labels.includes(label)) {
      void set([...task.labels, label])
    }
  }
  return (
    <>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.tasks.web.newLabel}
          aria-label={
            renaming
              ? fmt(words.renamingLabel, { label: renaming })
              : words.addLabel
          }
          className={`${inputClass} min-h-[var(--size-control-min)] min-w-0 flex-1`}
        />
        <button type="submit" className={buttonClass.secondary}>
          {renaming ? t.common.actions.save : t.tasks.web.addLabel}
        </button>
      </form>
      {task.labels.length > 0 ? (
        <>
          <h4 className={HEADING}>{words.labelsOnTask}</h4>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {task.labels.map((label) => (
              <li
                key={label}
                className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] pl-3.5 text-subhead font-semibold"
              >
                {label}
                <button
                  type="button"
                  aria-label={fmt(words.removeLabel, { label })}
                  onClick={() =>
                    void set(task.labels.filter((each) => each !== label))
                  }
                  className="grid size-9 pointer-coarse:size-[var(--size-control-min)] cursor-pointer place-items-center rounded-[var(--radius-pill)] border-0 bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {others.length > 0 ? (
        <>
          <h4 className={HEADING}>{words.labelsInGroup}</h4>
          <ul className="m-0 list-none rounded-[var(--radius-control)] bg-[var(--ground)] p-0">
            {others.map((label) => (
              <li
                key={label}
                className="flex items-center pr-2 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
              >
                <button
                  type="button"
                  onClick={() => void set([...task.labels, label])}
                  className="min-h-[var(--size-control-min)] min-w-0 flex-1 cursor-pointer border-0 bg-transparent px-3.5 text-left font-[inherit] text-body text-[var(--ink)]"
                >
                  {label}
                </button>
                {task.linked ? null : (
                  <RowMenu
                    item={label}
                    alwaysVisible
                    actions={[
                      {
                        id: 'rename',
                        label: words.renameLabelEverywhere,
                        onSelect: () => {
                          setRenaming(label)
                          setDraft(label)
                        },
                      },
                      {
                        id: 'remove',
                        label: words.removeLabelEverywhere,
                        danger: true,
                        onSelect: () =>
                          confirm({
                            title: fmt(words.removeLabel, { label }),
                            body: words.removeLabelEverywhere,
                            confirmLabel: t.common.actions.delete,
                            run: () => actions.removeLabel(label),
                          }),
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      ) : task.labels.length === 0 ? (
        <p className={NOTE}>{words.labelsNone}</p>
      ) : null}
    </>
  )
}
