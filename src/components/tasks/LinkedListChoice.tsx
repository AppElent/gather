import { moveTargets } from '@gather/core/linked-tasks'
import type { Task, TaskList } from '@gather/core/task-model'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { fmt, useI18n } from '../../lib/i18n'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { ChoiceList } from './ChoiceList'
import { useTaskLists } from './data'
import { useWorkspace } from './TasksWorkspace'
import { providerName } from './words'

const NOTE = 'm-0 px-1 text-footnote text-[var(--muted)]'
const HEADING = 'm-0 px-1 text-footnote font-semibold text-[var(--muted)]'

/**
 * The lists a linked task can move to, those of its own connection, and the
 * rest with why not (APP-821).
 */
export function LinkedListChoice({
  task,
  list,
  onClose,
  onGone,
}: {
  task: Task
  list: TaskList
  onClose: () => void
  /** It moved: a page or panel about it leaves. */
  onGone?: () => void
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.linkedWrite.moveTo
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { actions, fail, show } = useWorkspace()
  const lists = useTaskLists()
  const connections = useQuery(api.integrations.listConnections, { groupSlug })
  const from = lists?.find((each) => each._id === list.id)
  if (!lists || !from) return null
  const { own, other } = moveTargets(from, lists)
  const connection = connections?.find((each) => each._id === from.connectionId)
  const provider = providerName(list.provider)
  const source = connection
    ? `${provider} · ${connection.connectedByName}`
    : provider
  return (
    <>
      <h4 className={HEADING}>{source}</h4>
      <ChoiceList<string>
        label={source}
        current={list.id}
        options={own.map((each) => ({ id: each._id, label: each.name }))}
        onChoose={(id) => {
          onClose()
          const name = own.find((each) => each._id === id)?.name ?? ''
          if (id === list.id) return
          actions.moveToLinkedList(task, id).then((undo) => {
            onGone?.()
            show({
              message: fmt(t.tasks.web.moved, { list: name }),
              undo: () => {
                undo().catch(fail)
              },
            })
          }, fail)
        }}
      />
      {other.length > 0 ? (
        <>
          <h4 className={HEADING}>{words.otherWeb}</h4>
          <ChoiceList<string>
            label={words.otherWeb}
            current=""
            options={other.map((each) => ({
              id: each._id,
              label: `${each.name} · ${providerName(each.provider) || 'Gather'}`,
              disabled: true,
            }))}
            onChoose={() => {}}
          />
        </>
      ) : null}
      <p className={NOTE}>{fmt(words.explained, { provider })}</p>
    </>
  )
}
