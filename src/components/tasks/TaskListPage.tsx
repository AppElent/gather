import { reorderWithSubtasks, topLevelTasks } from '@gather/core/subtasks'
import { groupBySection, keepsCheckedInPlace } from '@gather/core/task-lists'
import type { Task, TaskList } from '@gather/core/task-model'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { buttonClass } from '../app/buttons'
import { CompletedSection } from '../app/CompletedSection'
import { EmptyState } from '../app/EmptyState'
import { InsetList, InsetRow, SectionLabel } from '../app/InsetList'
import { ListDetailLayout, ListLoadingState } from '../app/ListDetailLayout'
import { RowMenu, type RowMenuAction } from '../app/RowMenu'
import { useIsDesktop } from '../app/useMediaQuery'
import { WashHeader } from '../app/WashHeader'
import { useTaskList, useTaskOf, useTaskPeople } from './data'
import { LIST_GLYPHS } from './ListTile'
import { ListDialog, type ListDialogKind } from './listDialogs'
import { QuickAdd } from './QuickAdd'
import { listLink, placeLink, type TaskPlace, taskLink } from './selection'
import { TaskListRow } from './TaskListRow'
import { TaskPanel } from './TaskPanel'
import { TasksWorkspace, useWorkspace } from './TasksWorkspace'
import { useCloseOnEscape } from './useCloseOnEscape'
import { providerName } from './words'

interface TaskListPageProps {
  listId: string
  selectedTaskId?: string
}

/** One list: the add field, its sections, what is completed, a task's panel. */
export function TaskListPage(props: TaskListPageProps) {
  return (
    <TasksWorkspace>
      <TaskListBody {...props} />
    </TasksWorkspace>
  )
}

function TaskListBody({ listId, selectedTaskId }: TaskListPageProps) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.web
  const { status, today, list, tasks, refresh } = useTaskList(listId)
  const state = useTaskOf(selectedTaskId)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<ListDialogKind | null>(null)
  const listMenu = useListMenu(list, refresh, setDialog)
  const field = useRef<HTMLInputElement>(null)
  const place: TaskPlace = { kind: 'list', listId }
  const close = () => void navigate(placeLink(place))
  useCloseOnEscape(Boolean(selectedTaskId), close)
  const parent = { label: words.parent, link: linkTo('tasks') }

  if (list?.grocery) return <Navigate {...listLink(list)} replace />

  const rows = topLevelTasks(tasks ?? [])
  const open = rows.filter((task) => !task.done).length
  const name =
    list?.name ?? (status === 'missing' ? words.listMissingTitle : words.parent)
  const linked = list !== undefined && list.provider !== 'local'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs
        trail={[parent, { label: name }]}
        backInHeader
        className="mx-auto -mb-1 w-full max-w-6xl"
      />
      <div>
        <ListDetailLayout
          header={
            <WashHeader
              group={list && !linked ? list.color : 'home'}
              icon={list && !linked ? LIST_GLYPHS[list.icon] : 'ListChecks'}
              title={name}
              back={parent}
              summary={
                list && tasks
                  ? {
                      count: plural(locale, open, t.tasks.count.open),
                      scope: linked
                        ? fmt(words.scope.linked, {
                            provider: providerName(list.provider),
                          })
                        : words.scope.household,
                    }
                  : undefined
              }
              extra={
                list ? (
                  <RowMenu
                    item={list.name}
                    alwaysVisible
                    actions={listMenu(list)}
                  />
                ) : undefined
              }
              primary={
                list?.writable
                  ? {
                      label: words.add.primary,
                      onClick: () => field.current?.focus(),
                    }
                  : undefined
              }
            />
          }
          list={
            status === 'missing' ? (
              <EmptyState
                kind="nothing-found"
                title={words.listMissingTitle}
                body={words.listMissingBody}
                action={{ label: words.toTasks, link: linkTo('tasks') }}
              />
            ) : !list ? (
              <ListLoadingState label={words.loading} />
            ) : (
              <>
                {list.writable ? (
                  <QuickAdd lists={[list]} fieldRef={field} toLastSection />
                ) : null}
                <LinkedNotice list={list} />
                {tasks ? (
                  <ListRows
                    list={list}
                    tasks={tasks}
                    rows={rows}
                    today={today}
                    selectedTaskId={selectedTaskId}
                    onClose={close}
                  />
                ) : linked && list.sync !== 'loading' ? null : (
                  <ListLoadingState label={words.loading} />
                )}
              </>
            )
          }
          panel={
            selectedTaskId ? (
              <TaskPanel state={state} place={place} onClose={close} />
            ) : undefined
          }
          panelLabel={words.panel.label}
          recordKey={selectedTaskId}
          onCloseRecord={close}
        />
      </div>
      {dialog && list ? (
        <ListDialog kind={dialog} list={list} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  )
}

/** The list's own `⋯`. A linked list's name, face and order are not Gather's. */
function useListMenu(
  list: TaskList | undefined,
  refresh: () => Promise<unknown>,
  open: (dialog: ListDialogKind) => void,
) {
  const { messages: t } = useI18n()
  const words = t.tasks.web.listMenu
  const { actions, confirm } = useWorkspace()
  const navigate = useNavigate()
  const linked = list !== undefined && list.provider !== 'local'
  return (shown: TaskList): RowMenuAction[] => [
    { id: 'display', label: words.display, onSelect: () => open('display') },
    ...(linked
      ? [
          {
            id: 'refresh',
            label: words.refresh,
            onSelect: () => void refresh(),
          },
        ]
      : [
          { id: 'rename', label: words.rename, onSelect: () => open('rename') },
          {
            id: 'appearance',
            label: words.appearance,
            onSelect: () => open('appearance'),
          },
          {
            id: 'sections',
            label: words.sections,
            onSelect: () => open('sections'),
          },
        ]),
    {
      id: 'delete',
      label: linked ? words.unlink : words.delete,
      danger: true,
      onSelect: () =>
        confirm({
          title: fmt(
            linked ? t.tasks.web.unlinkTitle : t.tasks.page.deleteListTitle,
            { name: shown.name },
          ),
          body: linked
            ? fmt(t.tasks.web.unlinkBody, {
                provider: providerName(shown.provider),
              })
            : t.tasks.page.deleteListBody,
          confirmLabel: linked
            ? t.tasks.web.unlinkConfirm
            : t.tasks.page.deleteListConfirm,
          errorFallback: t.tasks.page.deleteListFailed,
          run: async () => {
            await actions.removeList(shown.id)
            await navigate(linkTo('tasks'))
          },
        }),
    },
  ]
}

/** What a linked list says about itself: loading, refused, or read-only. */
function LinkedNotice({ list }: { list: TaskList }) {
  const { messages: t } = useI18n()
  if (list.provider === 'local') return null
  const provider = { provider: providerName(list.provider) }
  const broken = list.sync === 'reconnect' || list.sync === 'failed'
  const text =
    list.sync === 'reconnect'
      ? fmt(t.tasks.external.reconnect, provider)
      : list.sync === 'failed'
        ? t.tasks.external.loadFailed
        : list.sync === 'loading'
          ? fmt(t.tasks.web.syncing, provider)
          : list.writable
            ? null
            : fmt(t.tasks.web.readOnly, provider)
  if (!text) return null
  return (
    <p
      role={broken ? 'alert' : undefined}
      className={`m-0 flex flex-wrap items-center justify-between gap-x-4 rounded-[var(--radius-card)] bg-[var(--surface-2)] px-4 py-3 text-subhead ${
        broken ? 'font-semibold text-[var(--danger)]' : 'text-[var(--muted)]'
      }`}
    >
      {text}
      {list.sync === 'reconnect' ? (
        <Link
          {...linkTo('settings')}
          className="inline-flex min-h-[var(--size-control-min)] items-center text-[var(--home-text)]"
        >
          {t.tasks.external.goToSettings}
        </Link>
      ) : null}
    </p>
  )
}

function ListRows({
  list,
  tasks,
  rows,
  today,
  selectedTaskId,
  onClose,
}: {
  list: TaskList
  /** Every task on the list, subtasks included. */
  tasks: Task[]
  /** The ones drawn as rows. */
  rows: Task[]
  today: string
  selectedTaskId?: string
  onClose: () => void
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.web
  const { actions, menu, fail } = useWorkspace()
  const { byId } = useTaskPeople()
  const desktop = useIsDesktop()
  const place: TaskPlace = { kind: 'list', listId: list.id }
  const local = list.provider === 'local'
  // A packing list keeps its checked items where they are (APP-306).
  const inPlace = keepsCheckedInPlace(list.kind)
  const listed = inPlace ? rows : rows.filter((task) => !task.done)
  const finished = inPlace ? [] : rows.filter((task) => task.done)
  const groups = groupBySection(list.sections, listed)
  const sectioned = list.sections.length > 0

  if (rows.length === 0 && !sectioned) {
    return (
      <EmptyState
        kind="nothing-for-you"
        title={
          local
            ? words.emptyListTitle
            : fmt(t.tasks.external.empty, {
                provider: providerName(list.provider),
              })
        }
        body={list.writable ? words.emptyListBody : undefined}
      />
    )
  }

  /** Up or down among the rows of its own section. */
  const move = (section: readonly Task[], from: number, to: number) => {
    const moved = [...section]
    moved.splice(to, 0, ...moved.splice(from, 1))
    const order = groups.flatMap((group) =>
      group.tasks.some((task) => task.id === section[0]?.id)
        ? moved.map((task) => ({ id: task.id, section: group.id }))
        : group.tasks.map((task) => ({ id: task.id, section: group.id })),
    )
    // The server wants every task once: each parent's subtasks follow it.
    const all = reorderWithSubtasks(
      order.map((each) => each.id),
      order.map((each) => each.section),
      tasks,
      inPlace,
    )
    actions.reorder(list.id, all.ids, all.sectionIds).catch(fail)
  }

  const row = (task: Task, section?: readonly Task[]) => {
    const at = section?.indexOf(task) ?? -1
    return (
      <TaskListRow
        key={task.id}
        task={task}
        list={list}
        today={today}
        people={byId}
        selected={task.id === selectedTaskId}
        link={taskLink(place, task, desktop)}
        menu={menu({
          task,
          list,
          onMove:
            section && local && list.writable
              ? {
                  up: at > 0 ? () => move(section, at, at - 1) : undefined,
                  down:
                    at < section.length - 1
                      ? () => move(section, at, at + 1)
                      : undefined,
                }
              : undefined,
          onDeleted: task.id === selectedTaskId ? onClose : undefined,
        })}
      />
    )
  }

  return (
    <>
      {inPlace && rows.length > 0 ? (
        <PackingProgress rows={rows} list={list} />
      ) : null}
      {groups.map((group) =>
        // "No section" is drawn only while something is in it.
        sectioned && group.id === null && group.tasks.length === 0 ? null : !sectioned &&
          group.tasks.length === 0 ? null : (
          <section key={group.id ?? 'none'}>
            {sectioned ? (
              <SectionLabel>
                {group.name ?? t.tasks.sections.none}
              </SectionLabel>
            ) : null}
            <InsetList label={sectioned ? undefined : list.name}>
              {group.tasks.length === 0 ? (
                <InsetRow
                  title={
                    <span className="text-[var(--muted)]">
                      {words.emptySection}
                    </span>
                  }
                />
              ) : (
                group.tasks.map((task) => row(task, group.tasks))
              )}
            </InsetList>
          </section>
        ),
      )}
      <CompletedSection count={finished.length}>
        <InsetList>{finished.map((task) => row(task))}</InsetList>
      </CompletedSection>
    </>
  )
}

/** "7 of 18 packed", and the reset for the next trip with its Undo. */
function PackingProgress({ rows, list }: { rows: Task[]; list: TaskList }) {
  const { messages: t } = useI18n()
  const words = t.tasks.packing
  const { actions, show, fail } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const done = rows.filter((task) => task.done).length
  const label = fmt(words.progress, { done, total: rows.length })

  const reset = async () => {
    setBusy(true)
    try {
      const ids = await actions.setDoneInList(list.id, false)
      show({
        message: words.uncheckedAll,
        undo: () => {
          actions.setDoneInList(list.id, true, ids).catch(fail)
        },
      })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-[var(--radius-card)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[var(--muted)]">
          <strong className="text-[var(--ink)] tabular-nums">{label}</strong>{' '}
          {words.packed}
        </p>
        {list.writable ? (
          <button
            type="button"
            title={words.uncheckAllHint}
            disabled={busy || done === 0}
            onClick={() => void reset()}
            className={buttonClass.small}
          >
            {words.uncheckAll}
          </button>
        ) : null}
      </div>
      <progress
        aria-label={`${label} ${words.packed}`}
        value={done}
        max={rows.length}
        className="h-1.5 w-full appearance-none overflow-hidden rounded-[var(--radius-pill)] [&::-moz-progress-bar]:bg-[var(--home-text)] [&::-webkit-progress-bar]:bg-[var(--surface-2)] [&::-webkit-progress-value]:bg-[var(--home-text)]"
      />
    </div>
  )
}
