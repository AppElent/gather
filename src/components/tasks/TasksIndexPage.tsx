import { SMART_LISTS } from '@gather/core/smart-lists'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { EmptyState } from '../app/EmptyState'
import {
  InsetList,
  InsetRow,
  SectionFooter,
  SectionLabel,
} from '../app/InsetList'
import { ListLoadingState } from '../app/ListDetailLayout'
import { ModuleTile } from '../app/ModuleTile'
import { useIsDesktop } from '../app/useMediaQuery'
import { type StartCreatingProps, useStartCreating } from '../app/useStartCreating'
import { WashHeader } from '../app/WashHeader'
import { useSmartLists, useTaskIndex, useTaskPeople } from './data'
import { Coin, ListTile } from './ListTile'
import { NewListDialog } from './NewListDialog'
import { listLink, type TaskPlace, taskLink } from './selection'
import { SMART_GLYPHS } from './smartGlyphs'
import { TaskListRow } from './TaskListRow'
import { TasksWorkspace, useWorkspace } from './TasksWorkspace'
import { openCountWords } from './words'

const INDEX: TaskPlace = { kind: 'index' }

/** Tasks: what is due today, the smart lists, and the Group's lists. */
export function TasksIndexPage(props: StartCreatingProps) {
  return (
    <TasksWorkspace>
      <TasksIndex {...props} />
    </TasksWorkspace>
  )
}

function TasksIndex(props: StartCreatingProps) {
  const { locale, messages: t } = useI18n()
  const index = useTaskIndex()
  const smart = useSmartLists()
  const { byId } = useTaskPeople()
  const { menu } = useWorkspace()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const [creating, setCreating] = useState(false)
  useStartCreating(props, () => setCreating(true))

  const lists = [...index.lists].sort((a, b) => a.order - b.order)
  const due = smart.byList.today
  const late = due.filter(
    (task) => task.dueDate !== undefined && task.dueDate < smart.today,
  ).length
  // Tasks someone else gave you that you have not opened yet (APP-302).
  const notices = smart.tasks
    .filter(
      (task) =>
        !task.done &&
        task.assignmentNotice &&
        smart.me !== null &&
        task.assigneeId === smart.me,
    )
    .sort(
      (a, b) => (b.assignmentNotice?.at ?? 0) - (a.assignmentNotice?.at ?? 0),
    )
  const create = () => setCreating(true)

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
      <WashHeader
        group="home"
        icon="ListChecks"
        title={t.tasks.web.parent}
        summary={
          index.loaded
            ? {
                count: plural(locale, index.openTotal, t.tasks.count.open),
                scope: plural(locale, lists.length, t.tasks.count.lists),
              }
            : undefined
        }
        primary={{ label: t.tasks.page.addList, onClick: create }}
      />

      {!index.loaded ? (
        <ListLoadingState label={t.tasks.web.loading} />
      ) : lists.length === 0 ? (
        <EmptyState
          kind="nothing-yet"
          title={t.tasks.page.emptyTitle}
          body={t.tasks.page.emptyBody}
          tile={{ group: 'home', icon: 'ListChecks' }}
          action={{ label: t.tasks.page.emptyAction, onClick: create }}
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-2">
          <div className="grid gap-5">
            {notices.length > 0 ? (
              <section>
                <SectionLabel>{t.tasks.assignee.notice.title}</SectionLabel>
                <InsetList>
                  {notices.map((task) => {
                    const giver = task.assignmentNotice
                      ? byId.get(task.assignmentNotice.by)
                      : undefined
                    return (
                      <InsetRow
                        key={task.id}
                        title={task.title}
                        footnote={fmt(t.tasks.assignee.notice.gaveYou, {
                          name: giver?.name ?? t.tasks.assignee.someone,
                        })}
                        leading={<Coin initial={giver?.initial ?? '?'} />}
                        link={taskLink(INDEX, task, desktop)}
                      />
                    )
                  })}
                </InsetList>
              </section>
            ) : null}

            <section>
              <SectionLabel
                action={
                  late > 0 ? (
                    <span className="text-footnote font-semibold text-[var(--danger)]">
                      {fmt(t.tasks.smart.overdueCount, { count: late })}
                    </span>
                  ) : undefined
                }
              >
                {t.tasks.smart.lists.today.title}
              </SectionLabel>
              {!smart.loaded ? (
                <div
                  aria-hidden="true"
                  className="h-[104px] animate-pulse rounded-[var(--radius-card)] bg-[var(--surface)] motion-reduce:animate-none"
                />
              ) : (
                <InsetList>
                  {due.length === 0 ? (
                    <InsetRow
                      title={
                        <span className="text-[var(--muted)]">
                          {t.tasks.index.todayEmpty}
                        </span>
                      }
                    />
                  ) : (
                    due.map((task) => {
                      const list = smart.lists.find(
                        (each) => each.id === task.listId,
                      )
                      return (
                        <TaskListRow
                          key={task.id}
                          task={task}
                          list={list}
                          today={smart.today}
                          smart="late"
                          people={byId}
                          link={taskLink(
                            INDEX,
                            { ...task, grocery: list?.grocery },
                            desktop,
                          )}
                          menu={
                            list ? menu({ task, list, tasks: smart.tasks }) : []
                          }
                        />
                      )
                    })
                  )}
                </InsetList>
              )}
            </section>

            <section>
              <SectionLabel>{t.tasks.smart.section}</SectionLabel>
              <InsetList>
                {SMART_LISTS.filter((id) => id !== 'today').map((id) => {
                  const words = t.tasks.smart.lists[id]
                  return (
                    <InsetRow
                      key={id}
                      title={words.title}
                      footnote={words.subtitle}
                      leading={
                        <ModuleTile group="home" icon={SMART_GLYPHS[id]} />
                      }
                      trailing={
                        smart.loaded ? smart.byList[id].length : undefined
                      }
                      link={linkTo('smartTaskList', { smartList: id })}
                    />
                  )
                })}
              </InsetList>
            </section>
          </div>

          <section>
            <SectionLabel>{t.tasks.index.lists}</SectionLabel>
            <InsetList>
              {lists.map((list) => {
                const kind = t.tasks.kinds[list.kind].title
                const linked = list.provider !== 'local'
                return (
                  <InsetRow
                    key={list.id}
                    title={list.name}
                    // The type under the name, unless the name says it.
                    footnote={
                      !linked && list.kind !== 'plain' && kind !== list.name
                        ? kind
                        : undefined
                    }
                    leading={<ListTile list={list} />}
                    trailing={
                      <>
                        {linked ? (
                          <span className="rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-2.5 py-0.5 text-footnote">
                            {t.tasks.index.linked}
                          </span>
                        ) : null}
                        {openCountWords(list, index.counts.get(list.id), t)}
                      </>
                    }
                    link={listLink(list)}
                  />
                )
              })}
            </InsetList>
            {lists.some((list) => list.provider !== 'local') ? (
              <SectionFooter>{t.tasks.web.linkedFootnote}</SectionFooter>
            ) : null}
          </section>
        </div>
      )}

      {creating ? (
        <NewListDialog
          onClose={() => setCreating(false)}
          onCreated={(list) =>
            void navigate(
              listLink({ id: list.id, grocery: list.kind === 'groceries' }),
            )
          }
        />
      ) : null}
    </div>
  )
}
