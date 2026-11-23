/**
 * Everything Home's "Today" reads, from queries that already exist and are
 * combined here rather than in a new backend query:
 *
 * - local task lists and their tasks (`taskLists.list`, `tasks.listByList`),
 * - each child and today's entries (`babies.list`, `babyEvents.listByBaby`
 *   from midnight),
 * - the Group's Members (`groups.members`), for the count under the title.
 *
 * The Pins are not here: on the phone they are the device's own list
 * (ADR-0033), read through `useModuleArrangement`.
 */

import {
  dueTodayTasks,
  overdueTasks,
  railEntries,
  startOfDay,
} from '@gather/core/home-today'
import { useMemo } from 'react'
import { api, type Id } from '../convex/api'
import { useQueries, useQuery } from '../convex/queries'
import { useGroup } from '../group/GroupProvider'
import { useI18n } from '../i18n'
import { useMinuteClock } from '../modules/baby/clock'
import { useLocalTaskState } from '../modules/tasks/store'

export function useToday() {
  const { group } = useGroup()
  const { t } = useI18n()
  const now = useMinuteClock()
  const dayStart = startOfDay(now)

  const tasks = useLocalTaskState()
  const members = useQuery(api.groups.members, { slug: group.slug })
  const children = useQuery(api.babies.list, { groupSlug: group.slug })

  // One subscription per child, from midnight. The request object only
  // changes with the children or the day, so `useQueries` keeps them open.
  const eventQueries = useMemo(
    () =>
      Object.fromEntries(
        (children ?? []).map((child) => [
          child._id,
          {
            query: api.babyEvents.listByBaby,
            args: {
              babyId: child._id as Id<'babies'>,
              groupSlug: group.slug,
              from: dayStart,
            },
          },
        ]),
      ),
    [children, group.slug, dayStart],
  )
  const events = useQueries(eventQueries)

  // The cutoff is read fresh whenever the entries change, not only from the
  // minute clock: an entry logged at 21:11:30 arrives after the clock said
  // 21:11:00, and must show at once rather than a minute later.
  const rail = useMemo(
    () =>
      railEntries(children ?? [], events, {
        dayStart,
        now: Math.max(now, Date.now()),
        babyLog: t.baby.log,
        words: t.shell.home.today,
      }),
    [children, events, dayStart, now, t],
  )

  return {
    now,
    memberCount: members?.length,
    overdue: overdueTasks(tasks.tasks, tasks.today),
    dueToday: dueTodayTasks(tasks.tasks, tasks.today),
    lists: tasks.lists,
    tasks: tasks.tasks,
    rail,
  }
}
