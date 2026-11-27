import { dayStartIn, todayIn } from '@gather/core/civil-date'
import {
  dueTodayTasks,
  overdueTasks,
  railEntries,
} from '@gather/core/home-today'
import { pinnedModules } from '@gather/core/pins'
import { useQueries, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'

/**
 * Everything Start reads, from the queries the phone's Home reads (its
 * `use-today.ts`), combined here rather than in a new backend query:
 *
 * - local task lists and their tasks (`taskLists.list`, `tasks.listByList`),
 *   so a linked Notion or Todoist list is never fetched from Start (ADR-0021),
 * - each child and today's entries (`babies.list`, `babyEvents.listByBaby`
 *   from midnight),
 * - the Group's Members, for the count under the title,
 * - the Member's Pins in this Group (`users.myPins`). On the web they are the
 *   account's; the phone keeps its own (ADR-0033).
 *
 * Which tasks are overdue or due today, and which entries go on the rail, is
 * decided by `@gather/core/home-today`, the same rules the phone runs.
 */
export function useStartDay(groupSlug: string, timeZone: string | undefined) {
  const messages = useMessages()
  const now = useMinuteClock()
  const today = todayIn(timeZone, now)
  const dayStart = useMemo(() => dayStartIn(timeZone, now), [timeZone, now])

  const lists = useQuery(api.taskLists.list, { groupSlug })
  const localLists = useMemo(
    () => (lists ?? []).filter((list) => list.provider === 'local'),
    [lists],
  )
  const taskQueries = useMemo(
    () =>
      Object.fromEntries(
        localLists.map((list) => [
          list._id,
          {
            query: api.tasks.listByList,
            args: { listId: list._id, groupSlug },
          },
        ]),
      ),
    [localLists, groupSlug],
  )
  const taskResults = useQueries(taskQueries)

  const children = useQuery(api.babies.list, { groupSlug })
  const eventQueries = useMemo(
    () =>
      Object.fromEntries(
        (children ?? []).map((child) => [
          child._id,
          {
            query: api.babyEvents.listByBaby,
            args: {
              babyId: child._id as Id<'babies'>,
              groupSlug,
              from: dayStart,
            },
          },
        ]),
      ),
    [children, groupSlug, dayStart],
  )
  const events = useQueries(eventQueries)

  const members = useQuery(api.groups.members, { slug: groupSlug })
  const pins = useQuery(api.users.myPins, { groupSlug })

  const tasks = useMemo(
    () =>
      Object.values(taskResults).flatMap((rows) =>
        Array.isArray(rows) ? (rows as Doc<'tasks'>[]) : [],
      ),
    [taskResults],
  )

  // The cutoff is read fresh whenever the entries change, as on the phone: an
  // entry logged at 21:11:30 arrives after the clock said 21:11:00.
  // The rail draws its past/upcoming split from the same cutoff, so an entry
  // admitted here is never drawn after the Now capsule.
  const { rail, railNow } = useMemo(() => {
    const cutoff = Math.max(now, Date.now())
    return {
      railNow: cutoff,
      rail: railEntries(children ?? [], events, {
        dayStart,
        now: cutoff,
        babyLog: messages.baby.log,
        words: messages.shell.today,
      }),
    }
  }, [children, events, dayStart, now, messages])

  return {
    now,
    today,
    memberCount: members?.length,
    lists: localLists,
    overdue: overdueTasks(tasks, today),
    dueToday: dueTodayTasks(tasks, today),
    rail,
    /** The cutoff `rail` was chosen with: where the Now capsule sits. */
    railNow,
    /** `undefined` until Convex answers, so the section does not flash. */
    pinned: pins === undefined ? undefined : pinnedModules(pins ?? undefined),
  }
}

/** `Date.now()`, refreshed on every minute boundary. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => clearTimeout(timer)
  }, [])
  return now
}
