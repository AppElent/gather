import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { GroupActivityEntry } from '../../../convex/activity'
import {
  ACTIVITY_PHRASES,
  activityModuleIcon,
  activityModuleLabel,
  formatActivityTime,
  UNKNOWN_ACTOR,
} from '../../lib/groupActivity'
import { groupLink, moduleLink } from '../../lib/groupPaths'
import { MODULES } from '../../lib/modules'
import { Icon } from '../app/Icon'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'

/**
 * A Group's Home: who is here, and what has been happening.
 *
 * One page with one stream, deliberately. This is the surface conversation
 * grows into, so a composer has to be able to arrive at the bottom of a single
 * ordered list without the page being taken apart first — which is what a set
 * of independent per-Module panels would need.
 *
 * It is also deliberately not configurable. There is no widget, no registry, no
 * stored layout and no editor: the closed #10 branch shipped a configurable
 * Home whose renderer registry was empty, so it read "nothing here" for
 * everybody, permanently. One surface that always shows something beats a
 * flexible one that shows nothing.
 */

export interface GroupHomeProps {
  groupSlug: string
  groupName: string
  isPersonal: boolean
}

/**
 * The Modules worth pointing a brand-new Group at: live, and owned by the
 * Group. Nutrition is live too and is left out on purpose — it is Personal
 * (ADR-0003), so adding to it would put nothing in this Group's stream and
 * offering it here would say otherwise.
 */
const STARTERS = MODULES.filter(
  (module) => module.status === 'live' && module.scope === 'group',
)

function MemberList({ groupSlug, groupName, isPersonal }: GroupHomeProps) {
  const members = useQuery(api.groups.members, { slug: groupSlug })

  return (
    <SurfaceCard ariaLabel="Who is here">
      <h2 className="m-0 mb-2 text-sm font-semibold">Who is here</h2>
      {members === undefined ? (
        <p className="m-0 text-sm text-[var(--app-muted)]">Loading…</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex min-w-0 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-sm"
            >
              {/* Wraps rather than truncating: a name is the one thing on this
                  card a reader cannot guess from the rest of it. */}
              <span className="min-w-0 break-words">{member.name}</span>
              {/* The pill never wraps, so it has to be the part that keeps its
                  width while the name beside it gives way. */}
              {member.role === 'admin' ? (
                <Pill className="shrink-0">Admin</Pill>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 mb-0 text-sm leading-6 text-[var(--app-muted)]">
        {isPersonal ? (
          <>
            {groupName} is yours alone — nothing kept here is visible to anybody
            else. To share something with other people, start a group with them
            in <Link to="/groups">Groups</Link>.
          </>
        ) : (
          <>
            Everyone here sees everything in {groupName}. To invite somebody
            else, or to leave, go to <Link to="/groups">Groups</Link>.
          </>
        )}
      </p>
    </SurfaceCard>
  )
}

/** The title of an entry, linked wherever the Module has a page for it. */
function EntryTitle({
  entry,
  groupSlug,
}: {
  entry: GroupActivityEntry
  groupSlug: string
}) {
  const className = 'font-semibold text-[var(--app-fg)]'

  // The URL is built here, through `groupPaths.ts`, from the row id the server
  // sent — never assembled from a string, and never sent as one.
  if (entry.kind === 'recipe' && entry.targetId) {
    return (
      <Link
        {...groupLink('recipe', groupSlug, { recipeId: entry.targetId })}
        className={className}
      >
        {entry.title}
      </Link>
    )
  }
  if (entry.kind === 'babyEvent' && entry.targetId) {
    return (
      <Link
        {...groupLink('child', groupSlug, { babyId: entry.targetId })}
        className={className}
      >
        {entry.title}
      </Link>
    )
  }
  if (entry.kind === 'task') {
    // Tasks has a page per Group and none per task, so this goes to the Module
    // rather than to an address that does not exist.
    return (
      <Link {...groupLink('tasks', groupSlug)} className={className}>
        {entry.title}
      </Link>
    )
  }
  return <span className={className}>{entry.title}</span>
}

function ActivityRow({
  entry,
  groupSlug,
}: {
  entry: GroupActivityEntry
  groupSlug: string
}) {
  const phrase = ACTIVITY_PHRASES[entry.kind]

  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border-t border-[var(--app-border)] py-2 first:border-t-0 first:pt-0">
      <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon name={activityModuleIcon(entry.kind)} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        {/* `break-words` and no fixed width anywhere on this row: a long recipe
            title has to wrap onto the next line rather than push the page
            sideways on a phone. */}
        <p className="m-0 text-sm leading-6 break-words">
          <span className="font-semibold">{entry.byName ?? UNKNOWN_ACTOR}</span>{' '}
          {phrase.verb} <EntryTitle entry={entry} groupSlug={groupSlug} />
          {entry.context && phrase.connector
            ? ` ${phrase.connector} ${entry.context}`
            : null}
        </p>
        <p className="m-0 flex flex-wrap gap-x-2 text-xs text-[var(--app-muted)]">
          <span>{activityModuleLabel(entry.kind)}</span>
          <time dateTime={new Date(entry.at).toISOString()}>
            {formatActivityTime(entry.at)}
          </time>
        </p>
      </div>
    </li>
  )
}

/**
 * What Home says before anything has happened.
 *
 * "Nothing yet" on its own is a shrug. The Group is named, the Members are on
 * the card above, and this says what to do next — so the first visit is worth
 * making even for a household that has just been created.
 */
function NothingYet({ groupSlug, groupName, isPersonal }: GroupHomeProps) {
  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
        Nothing has happened in {groupName} yet.{' '}
        {isPersonal
          ? 'Whatever you add here appears in this list, and only you will ever see it.'
          : 'Whatever anybody here adds appears in this list, with their name on it.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((module) => (
          <Link
            key={module.id}
            {...moduleLink(module, groupSlug)}
            className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold text-[var(--app-fg)] no-underline"
          >
            <Icon name={module.icon} className="h-4 w-4" />
            <span className="truncate">{module.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function GroupHome({
  groupSlug,
  groupName,
  isPersonal,
}: GroupHomeProps) {
  const activity = useQuery(api.activity.forGroup, { groupSlug })

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <header>
        <h1 className="m-0 text-2xl font-semibold break-words">{groupName}</h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          {isPersonal
            ? 'Your own group. Anything kept here is private to you.'
            : 'What everyone in this group has been up to.'}
        </p>
      </header>

      <MemberList
        groupSlug={groupSlug}
        groupName={groupName}
        isPersonal={isPersonal}
      />

      <SurfaceCard ariaLabel="Recent activity">
        <h2 className="m-0 mb-2 text-sm font-semibold">Recent activity</h2>
        {activity === undefined ? (
          <p className="m-0 text-sm text-[var(--app-muted)]">Loading…</p>
        ) : activity.length === 0 ? (
          <NothingYet
            groupSlug={groupSlug}
            groupName={groupName}
            isPersonal={isPersonal}
          />
        ) : (
          <ol className="m-0 grid list-none p-0">
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} groupSlug={groupSlug} />
            ))}
          </ol>
        )}
      </SurfaceCard>
    </div>
  )
}
