import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Pill, SurfaceCard } from '../../components/app/ShellPrimitives'
import { errorMessage } from '../../lib/errorMessage'
import { groupLink } from '../../lib/groupPaths'

export const Route = createFileRoute('/_app/groups')({ component: GroupsPage })

const BUTTON =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'

const INPUT =
  'min-h-9 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm'

/**
 * Every Group you are in, and the two ways to end up in another one.
 *
 * This page never got the restyle the rest of the shell did — raw `rounded-md
 * border`, `bg-emerald-100`, `bg-red-50`, none of the `--app-*` tokens — so it
 * read as a different app bolted onto this one. It is on the shared primitives
 * now, which matters more than it did: a Group row is the way into that Group's
 * settings, so this is a page people arrive at on purpose rather than a list
 * they pass through once.
 *
 * The invite code has come off the rows with the restyle. It was a grey aside
 * on every row of a page anybody can open, and it is a capability — whoever
 * holds one can join. It lives on the Group's own settings page now, next to a
 * sentence explaining what it does. Joining with somebody else's is still here,
 * because that is not about a Group you are already in.
 */
function GroupsPage() {
  const groups = useQuery(api.groups.myGroups)
  const createGroup = useMutation(api.groups.createGroup)
  const joinByInvite = useMutation(api.groups.joinByInvite)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <header>
        <h1 className="m-0 text-2xl font-semibold">Groups</h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          The households you are in. Open one to change its name, share its
          invite code, or leave it.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 py-2 text-sm text-[var(--app-danger)]"
        >
          {error}
        </p>
      )}

      {groups === undefined ? (
        <div className="h-24 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
      ) : (
        <SurfaceCard ariaLabel="Your groups">
          <ul className="m-0 grid list-none gap-1 p-0">
            {groups.map((g) => (
              <li key={g._id}>
                {/* The row is the way into the Group's own settings. It used to
                    be a bare span that went nowhere, next to a sidebar link
                    called "Group settings" that went here — so the one thing on
                    screen actually naming a Group was the one thing you could
                    not click. */}
                <Link
                  {...groupLink('settings', g.slug)}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-[var(--app-radius)] px-2 py-2 text-sm font-semibold text-[var(--app-fg)] no-underline hover:bg-[var(--app-surface-muted)]"
                >
                  {/* A Group's name is somebody else's input and can be one long
                      word; `minmax(0,1fr)` above is what lets it truncate
                      instead of widening the page. */}
                  <span className="truncate">{g.name}</span>
                  {g.isPersonal ? <Pill>Personal</Pill> : null}
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--app-muted)]"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              if (name.trim())
                void createGroup({ name: name.trim() })
                  .then(() => setName(''))
                  .catch((err) =>
                    setError(errorMessage(err, 'Could not create that group.')),
                  )
            }}
          >
            <h2 className="m-0 text-base font-semibold">New group</h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              A household of your own. You start as its admin.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wine club"
              aria-label="New group name"
              className={INPUT}
            />
            <div>
              <button type="submit" className={BUTTON}>
                Create
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              if (code.trim())
                void joinByInvite({ inviteCode: code.trim() })
                  .then(() => setCode(''))
                  .catch((err) =>
                    setError(
                      errorMessage(err, 'Could not join with that code.'),
                    ),
                  )
            }}
          >
            <h2 className="m-0 text-base font-semibold">Join with a code</h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Somebody in the group finds it in that group's settings.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8-char code"
              aria-label="Invite code"
              className={INPUT}
            />
            <div>
              <button type="submit" className={BUTTON}>
                Join
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>
  )
}
