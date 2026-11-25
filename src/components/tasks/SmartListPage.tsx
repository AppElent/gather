import { isSmartListId, type SmartListId, upcomingDays } from '@gather/core/smart-lists'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'
import { plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { EmptyState } from '../app/EmptyState'
import { InsetList, SectionLabel } from '../app/InsetList'
import { ListDetailLayout, ListLoadingState } from '../app/ListDetailLayout'
import { useIsDesktop } from '../app/useMediaQuery'
import { WashHeader } from '../app/WashHeader'
import { useSmartLists, useTaskOf, useTaskPeople } from './data'
import { QuickAdd } from './QuickAdd'
import { placeLink, type TaskPlace, taskLink } from './selection'
import { SMART_GLYPHS } from './smartGlyphs'
import { type SmartDate, TaskListRow } from './TaskListRow'
import { TaskPanel } from './TaskPanel'
import { TasksWorkspace, useWorkspace } from './TasksWorkspace'
import { useCloseOnEscape } from './useCloseOnEscape'
import { dayHeading } from './words'

interface SmartListPageProps {
  smartList: string
  selectedTaskId?: string
  /** The list a linked task was opened from. */
  selectedListId?: string
}

/** Today, My tasks, Upcoming or Unassigned: rows from every list (APP-301). */
export function SmartListPage({ smartList, ...selected }: SmartListPageProps) {
  if (!isSmartListId(smartList)) return <Navigate {...linkTo('tasks')} replace />
  return (
    <TasksWorkspace>
      <SmartListBody id={smartList} {...selected} />
    </TasksWorkspace>
  )
}

function SmartListBody({
  id,
  selectedTaskId,
  selectedListId,
}: {
  id: SmartListId
  selectedTaskId?: string
  selectedListId?: string
}) {
  const { locale, messages: t } = useI18n()
  const smart = useSmartLists()
  const { byId } = useTaskPeople()
  const { menu } = useWorkspace()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const field = useRef<HTMLInputElement>(null)
  const state = useTaskOf(selectedTaskId, selectedListId)
  const place: TaskPlace = { kind: 'smart', smartList: id }
  const close = () => void navigate(placeLink(place))
  useCloseOnEscape(Boolean(selectedTaskId), close)
  const words = t.tasks.smart
  const title = words.lists[id].title
  const tasks = smart.byList[id]
  const writable = smart.lists.filter((list) => list.writable && !list.grocery)
  const local = writable.filter((list) => list.provider === 'local')
  // Only a list of Gather's own has somebody to give a task to.
  const addable = id === 'mine' ? local : [...local, ...writable.filter((list) => list.provider !== 'local')]
  const date: SmartDate = id === 'today' ? 'late' : 'any'

  const rows = (some: typeof tasks, shown: SmartDate) =>
    some.map((task) => {
      const list = smart.lists.find((each) => each.id === task.listId)
      const selected =
        task.id === selectedTaskId &&
        (!task.linked || !selectedListId || task.listId === selectedListId)
      return (
        <TaskListRow
          key={`${task.listId}:${task.id}`}
          task={task}
          list={list}
          today={smart.today}
          smart={shown}
          people={byId}
          selected={selected}
          link={taskLink(
            place,
            { ...task, grocery: list?.grocery },
            desktop,
          )}
          menu={
            list
              ? menu({
                  task,
                  list,
                  onGone: selected ? close : undefined,
                })
              : []
          }
        />
      )
    })

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs
        trail={[
          { label: t.tasks.web.parent, link: linkTo('tasks') },
          { label: title },
        ]}
        backInHeader
        className="mx-auto -mb-1 w-full max-w-6xl"
      />
      <div>
        <ListDetailLayout
          header={
            <WashHeader
              group="home"
              icon={SMART_GLYPHS[id]}
              title={title}
              back={{ label: t.tasks.web.parent, link: linkTo('tasks') }}
              summary={
                smart.loaded
                  ? {
                      count: plural(locale, tasks.length, words.count),
                      scope: words.fromAll,
                    }
                  : undefined
              }
              primary={
                addable.length > 0
                  ? {
                      label: t.tasks.web.add.primary,
                      onClick: () => field.current?.focus(),
                    }
                  : undefined
              }
            />
          }
          list={
            !smart.loaded ? (
              <ListLoadingState label={t.tasks.web.loading} />
            ) : (
              <>
                <QuickAdd
                  lists={addable}
                  fieldRef={field}
                  preset={
                    id === 'today'
                      ? { dueDate: smart.today }
                      : id === 'mine' && smart.me
                        ? { assigneeId: smart.me }
                        : {}
                  }
                />
                {tasks.length === 0 ? (
                  <EmptyState kind="nothing-for-you" title={words.empty[id]} />
                ) : id === 'upcoming' ? (
                  upcomingDays(tasks, smart.today).map((day) => (
                    <section key={day.key}>
                      <SectionLabel>
                        {day.date
                          ? dayHeading(day.date, smart.today, locale, t)
                          : words.days.overdue}
                      </SectionLabel>
                      <InsetList>
                        {rows(day.tasks, day.date ? 'none' : 'past')}
                      </InsetList>
                    </section>
                  ))
                ) : (
                  <InsetList label={title}>
                    {rows(tasks, date)}
                  </InsetList>
                )}
              </>
            )
          }
          panel={
            selectedTaskId ? (
              <TaskPanel state={state} place={place} onClose={close} />
            ) : undefined
          }
          panelLabel={t.tasks.web.panel.label}
          recordKey={selectedTaskId}
          onCloseRecord={close}
        />
      </div>
    </div>
  )
}
