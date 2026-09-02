import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { useCurrentGroup } from '../../components/app/useCurrentGroup'
import { Icon } from '../../components/app/Icon'
import { errorMessage } from '../../lib/errorMessage'
import { groupLink } from '../../lib/groupPaths'
import { useMessages } from '../../lib/i18n'

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
  const navigate = useNavigate()
  const { setCurrentGroup } = useCurrentGroup()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { groups: text } = useMessages().shell

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <header>
        <h1 className="m-0 text-2xl font-semibold">{text.title}</h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          {text.intro}
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
        <SurfaceCard ariaLabel={text.yours}>
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
                  onClick={() => setCurrentGroup(g._id)}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-[var(--app-radius)] px-2 py-2 text-sm font-semibold text-[var(--app-fg)] no-underline hover:bg-[var(--app-surface-muted)]"
                >
                  {/* A Group's name is somebody else's input and can be one long
                      word; `minmax(0,1fr)` above is what lets it truncate
                      instead of widening the page. */}
                  <span className="flex min-w-0 items-center gap-2">
                    {g.imageUrl ? (
                      <img
                        src={g.imageUrl}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-[7px] object-cover"
                      />
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[var(--app-surface-muted)]">
                        {g.icon ? (
                          <Icon name={g.icon} className="h-4 w-4" />
                        ) : (
                          g.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                    )}
                    <span className="truncate">{g.name}</span>
                  </span>
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
                  .then((groupId) => {
                    setCurrentGroup(groupId)
                    setName('')
                    return navigate({ to: '/home' })
                  })
                  .catch((err) =>
                    setError(errorMessage(err, text.createFailed)),
                  )
            }}
          >
            <h2 className="m-0 text-base font-semibold">{text.createTitle}</h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {text.createBody}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={text.createPlaceholder}
              aria-label={text.createLabel}
              className={INPUT}
            />
            <div>
              <button type="submit" className={BUTTON}>
                {text.create}
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
                  .then((groupId) => {
                    setCurrentGroup(groupId)
                    setCode('')
                    return navigate({ to: '/home' })
                  })
                  .catch((err) => setError(errorMessage(err, text.joinFailed)))
            }}
          >
            <h2 className="m-0 text-base font-semibold">{text.joinTitle}</h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {text.joinBody}
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={text.joinPlaceholder}
              aria-label={text.joinLabel}
              className={INPUT}
            />
            <div>
              <button type="submit" className={BUTTON}>
                {text.join}
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>
  )
}
