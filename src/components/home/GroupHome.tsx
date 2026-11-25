import {
  clockTime,
  overdueListCount,
  overdueListId,
  spelledDate,
} from '@gather/core/home-today'
import { MODULES, moduleById, moduleText } from '@gather/core/modules'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { GroupActivityEntry } from '../../../convex/activity'
import {
  activityModuleIcon,
  activityModuleId,
  activityModuleLabel,
  activityPhrase,
  formatActivityTime,
} from '../../lib/groupActivity'
import { fmt, plural, useI18n, useMessages } from '../../lib/i18n'
import { linkTo, moduleLink } from '../../lib/links'
import { Icon } from '../app/Icon'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { EVENT_TYPE_ICONS } from '../baby/babyEventFields'
import {
  InsetList,
  LinkRow,
  NowCard,
  PinnedCard,
  StartHeading,
  Tile,
  TodayRail,
} from './StartParts'
import { useStartDay } from './useStartDay'

/**
 * Start: the Group's day, as the phone's Home shows it (APP-640, Tiles &
 * Today). It answers "what now, what next" before "what happened":
 *
 * - **Header.** The Group's name as the large title, the date and the Member
 *   count under it. The Members themselves live on the Group page.
 * - **Now card,** only while a local task is past its due date.
 * - **Today rail:** today's baby log entries, then the Now capsule.
 * - **Anytime today:** local tasks due today.
 * - **Pinned:** this Member's Pins as group-fill cards.
 * - **Recent activity:** the five newest entries, the rest behind "See all".
 *
 * A part with nothing to show is absent, never an empty state, as on the
 * phone. From 1024 px the day is the left column and Pinned and activity the
 * right; below that they stack.
 *
 * Still deliberately not configurable: no widget registry, no stored layout,
 * no editor (the closed #10 branch shipped one that showed nothing).
 */

/** How many activity entries show before "See all". */
export const ACTIVITY_PREVIEW = 5

/** The Modules worth pointing a brand-new Group at: the live ones. */
const STARTERS = MODULES.filter((module) => module.status === 'live')

const TASKS = moduleById('tasks')
const BABY = moduleById('baby-log')

export function GroupHome() {
  const {
    slug: groupSlug,
    name: groupName,
    timeZone,
  } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const words = messages.shell.today
  const day = useStartDay(groupSlug, timeZone)

  const byline = [
    spelledDate(day.today, locale, words.date),
    day.memberCount === undefined
      ? null
      : plural(locale, day.memberCount, words.members),
  ]
    .filter(Boolean)
    .join(' · ')

  const listName = (id: string) =>
    day.lists.find((list) => list._id === id)?.name

  const nowCard = (() => {
    if (day.overdue.length === 0 || !TASKS) return null
    const listId = overdueListId(day.overdue)
    const list = listId ? listName(listId) : undefined
    return (
      <NowCard
        group={TASKS.group}
        icon={TASKS.icon}
        caption={words.overdue.caption}
        value={String(day.overdue.length)}
        detail={
          list
            ? fmt(words.overdue.inList, { list })
            : fmt(words.overdue.acrossLists, {
                count: overdueListCount(day.overdue),
              })
        }
        action={{
          // Tasks has one page per Group on the web, so both go there; the
          // label still names the list when there is one.
          label: list
            ? fmt(words.overdue.openList, { list })
            : words.overdue.openTasks,
          link: linkTo('tasks'),
        }}
      />
    )
  })()

  const rail =
    day.rail.length > 0 && BABY ? (
      <section aria-labelledby="start-today" className="grid gap-2">
        <StartHeading id="start-today">{words.heading}</StartHeading>
        <TodayRail
          now={day.railNow}
          nowLabel={fmt(words.now, { time: clockTime(day.now) })}
          items={day.rail.map((entry) => ({
            id: entry.id,
            timestamp: entry.timestamp,
            time: clockTime(entry.timestamp),
            group: BABY.group,
            icon: EVENT_TYPE_ICONS[entry.type] ?? BABY.icon,
            title: entry.line,
          }))}
        />
      </section>
    ) : null

  const anytime =
    day.dueToday.length > 0 ? (
      <section aria-labelledby="start-anytime" className="grid gap-2">
        <StartHeading id="start-anytime">{words.anytime}</StartHeading>
        <InsetList>
          {day.dueToday.map((task) => {
            const list = listName(task.listId)
            return (
              <LinkRow
                key={task._id}
                link={linkTo('tasks')}
                leading={
                  TASKS ? <Tile group={TASKS.group} icon={TASKS.icon} /> : null
                }
                title={task.title}
                meta={list ? fmt(words.overdue.inList, { list }) : undefined}
              />
            )
          })}
        </InsetList>
      </section>
    ) : null

  const pinned =
    day.pinned && day.pinned.length > 0 ? (
      <section aria-labelledby="start-pinned" className="grid gap-2">
        <StartHeading id="start-pinned">{words.pinned}</StartHeading>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3 p-0">
          {day.pinned.map((module) => (
            <PinnedCard
              key={module.id}
              group={module.group}
              icon={module.icon}
              label={moduleText(module, messages).label}
              link={moduleLink(module)}
            />
          ))}
        </ul>
      </section>
    ) : null

  return (
    // `grid-cols-[minmax(0,1fr)]` rather than a bare `grid`: an implicit track
    // is sized `auto`, whose floor is the widest thing in it, so one unbreakable
    // word sets a width the whole page then has to be scrolled sideways to read.
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-5">
      <header className="px-1 pt-2">
        {/* `wrap-anywhere`, not `break-words`: only `anywhere` lowers the
            minimum width, and a Group's name can be one long word. */}
        <h1 className="m-0 font-rounded text-large-title font-bold text-[var(--ink)] wrap-anywhere">
          {groupName}
        </h1>
        <p
          data-testid="start-byline"
          className="mt-0.5 mb-0 text-subhead text-[var(--muted)]"
        >
          {byline}
        </p>
      </header>

      {/* Always two columns from 1024 px, so the page does not jump when a
          Now card arrives after the first paint. On a quiet day the left
          column is simply empty, as the phone leaves those parts out. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div
          data-testid="start-day"
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 empty:hidden lg:empty:block"
        >
          {nowCard}
          {rail}
          {anytime}
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          {pinned}
          <RecentActivity groupSlug={groupSlug} groupName={groupName} />
        </div>
      </div>
    </div>
  )
}

function RecentActivity({
  groupSlug,
  groupName,
}: {
  groupSlug: string
  groupName: string
}) {
  const activity = useQuery(api.activity.forGroup, { groupSlug })
  const messages = useMessages()
  const { home } = messages.shell
  const [expanded, setExpanded] = useState(false)

  const shown =
    activity && !expanded ? activity.slice(0, ACTIVITY_PREVIEW) : activity

  return (
    <section aria-labelledby="start-activity" className="grid gap-2">
      <StartHeading id="start-activity">{home.recentActivity}</StartHeading>
      {activity === undefined ? (
        <p className="m-0 px-1 text-subhead text-[var(--muted)]">
          {messages.common.errors.loading}
        </p>
      ) : activity.length === 0 ? (
        <NothingYet groupName={groupName} />
      ) : (
        <>
          <InsetList label={home.recentActivity}>
            {shown?.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </InsetList>
          {activity.length > ACTIVITY_PREVIEW ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              className="min-h-11 justify-self-start rounded-[var(--radius-pill)] px-1 text-subhead font-semibold text-[var(--ink)] underline-offset-2 hover:underline"
            >
              {expanded ? home.showFewer : home.seeAll}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}

/** The title of an entry, linked wherever the Module has a page for it. */
function EntryTitle({ entry }: { entry: GroupActivityEntry }) {
  const messages = useMessages()
  const className = 'font-semibold text-[var(--ink)]'

  // The link is built here from the row id the server sent — never assembled
  // from a string, and never sent as one.
  if (entry.kind === 'recipe' && entry.targetId) {
    return (
      <Link
        {...linkTo('recipe', { recipeId: entry.targetId })}
        className={className}
      >
        {entry.title}
      </Link>
    )
  }
  if (entry.kind === 'babyEvent') {
    const word = messages.baby.eventTypes[entry.eventType]
    if (!entry.targetId) return <span className={className}>{word}</span>
    return (
      <Link
        {...linkTo('child', { babyId: entry.targetId })}
        className={className}
      >
        {word}
      </Link>
    )
  }
  if (entry.kind === 'task') {
    // Tasks has a page per Group and none per task.
    return (
      <Link {...linkTo('tasks')} className={className}>
        {entry.title}
      </Link>
    )
  }
  return <span className={className}>{entry.title}</span>
}

function ActivityRow({ entry }: { entry: GroupActivityEntry }) {
  const { locale, messages } = useI18n()
  const phrase = activityPhrase(entry.kind, messages)
  const module = moduleById(activityModuleId(entry))

  return (
    <li>
      <div className="mx-4 grid min-h-[var(--size-row-min)] grid-cols-[28px_minmax(0,1fr)] items-center gap-3 py-1.5">
        {module ? (
          <Tile group={module.group} icon={activityModuleIcon(entry)} />
        ) : (
          <Icon name="Circle" className="h-4 w-4 text-[var(--muted)]" />
        )}
        {/* `minmax(0,1fr)` above and `wrap-anywhere` here: a long title wraps
            rather than pushing the page sideways on a phone. */}
        <div className="min-w-0">
          <p className="m-0 text-subhead wrap-anywhere">
            <span className="font-semibold">
              {entry.byName ?? messages.shell.activity.unknownActor}
            </span>{' '}
            {phrase.verb} <EntryTitle entry={entry} />
            {entry.context && phrase.connector
              ? ` ${phrase.connector} ${entry.context}`
              : null}
          </p>
          <p className="m-0 flex flex-wrap gap-x-1 text-footnote text-[var(--muted)]">
            <span>{activityModuleLabel(entry, messages)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={new Date(entry.at).toISOString()}>
              {formatActivityTime(entry.at, messages, locale)}
            </time>
          </p>
        </div>
      </div>
    </li>
  )
}

/**
 * What Start says before anything has happened: the Group is named, and this
 * says what to do next, so the first visit is worth making.
 */
function NothingYet({ groupName }: { groupName: string }) {
  const messages = useMessages()
  const { home } = messages.shell

  return (
    <div className="grid gap-3 rounded-[var(--radius-card)] bg-[var(--surface)] p-4">
      <p className="m-0 text-subhead text-[var(--muted)]">
        {fmt(home.nothingYet, { group: groupName })} {home.nothingYetShared}
      </p>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((module) => (
          <Link
            key={module.id}
            {...moduleLink(module)}
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-3 text-subhead font-semibold text-[var(--ink)] no-underline"
          >
            <Tile group={module.group} icon={module.icon} />
            <span className="truncate">
              {moduleText(module, messages).label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
