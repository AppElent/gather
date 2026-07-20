import { useClerk, useOrganizationList } from '@clerk/clerk-react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { spacePath } from '../../lib/spaceRoutes'
import { filterGatherMemberships, type GatherMembership } from './gatherClerk'
import { useSpace } from './SpaceContext'

type SpaceSummary = { slug: string; name: string; clerkOrganizationId: string }

type SpaceApi = { spaces: { mine: unknown } }
const spaceApi = api as unknown as SpaceApi
const useSpaceQuery = useQuery as unknown as (reference: unknown) => unknown

export function SpaceSwitcher() {
  const { space } = useSpace()
  const { setActive } = useClerk()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const organizationList = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const spaces = useSpaceQuery(spaceApi.spaces.mine) as
    | SpaceSummary[]
    | undefined
  useEffect(() => {
    if (organizationList.userMemberships.hasNextPage)
      void organizationList.userMemberships.fetchNext()
  }, [
    organizationList.userMemberships.fetchNext,
    organizationList.userMemberships.hasNextPage,
  ])
  const memberships = filterGatherMemberships(
    (organizationList.userMemberships.data ??
      []) as unknown as GatherMembership[],
  )
  const availableSpaces = (spaces ?? []).filter((candidate) =>
    memberships.some(
      (membership) =>
        membership.organization.id === candidate.clerkOrganizationId,
    ),
  )

  const switchTo = async (target: SpaceSummary) => {
    if (target.slug === space.slug) {
      setOpen(false)
      return
    }
    await setActive({ organization: target.clerkOrganizationId })
    setOpen(false)
    const suffix = location.pathname.replace(`/s/${space.slug}`, '')
    const destination =
      suffix === '/modules'
        ? spacePath.modules(target.slug)
        : suffix === '/home' || suffix === ''
          ? spacePath.home(target.slug)
          : spacePath.home(target.slug)
    await navigate({ to: destination as never })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Switch Space"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-left text-sm font-semibold"
      >
        <span className="truncate">{space.name ?? space.slug}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 grid w-full min-w-56 gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg">
          {availableSpaces.map((candidate) => (
            <button
              key={candidate.slug}
              type="button"
              className="rounded px-2 py-2 text-left text-sm hover:bg-[var(--app-surface-muted)]"
              onClick={() => void switchTo(candidate)}
            >
              {candidate.name}
            </button>
          ))}
          <Link
            to="/onboarding"
            className="flex items-center gap-2 rounded px-2 py-2 text-sm font-semibold text-[var(--app-fg)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create or join a Space
          </Link>
        </div>
      ) : null}
    </div>
  )
}
