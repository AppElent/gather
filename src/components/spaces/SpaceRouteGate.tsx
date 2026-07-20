import {
  useAuth,
  useClerk,
  useOrganization,
  useOrganizationList,
} from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { filterGatherMemberships, type GatherMembership } from './gatherClerk'
import { SpaceContextProvider, type SpaceContextValue } from './SpaceContext'

type SpaceSummary = { slug: string; clerkOrganizationId: string }
type SpaceApi = { spaces: { mine: unknown; context: unknown } }

const spaceApi = api as unknown as SpaceApi
const useSpaceQuery = useQuery as unknown as (
  reference: unknown,
  args?: unknown,
) => unknown

function GateMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell grid min-h-svh place-items-center text-sm text-[var(--app-muted)]">
      {children}
    </div>
  )
}

export function SpaceRouteGate({
  spaceSlug,
  children,
}: {
  spaceSlug: string
  children: React.ReactNode
}) {
  const { isLoaded: isOrganizationLoaded, organization } = useOrganization()
  const { setActive } = useClerk()
  const { getToken } = useAuth()
  const organizationList = useOrganizationList({
    userMemberships: { infinite: true },
  })
  useEffect(() => {
    if (organizationList.userMemberships.hasNextPage)
      void organizationList.userMemberships.fetchNext()
  }, [
    organizationList.userMemberships.fetchNext,
    organizationList.userMemberships.hasNextPage,
  ])
  const gatherMemberships = filterGatherMemberships(
    (organizationList.userMemberships.data ??
      []) as unknown as GatherMembership[],
  )
  const spaces = useSpaceQuery(spaceApi.spaces.mine) as
    | SpaceSummary[]
    | undefined
  const [tokenReadyForOrganization, setTokenReadyForOrganization] = useState<
    string | null
  >(null)
  const [activationError, setActivationError] = useState<string | null>(null)
  const targetSpace = spaces?.find((space) => space.slug === spaceSlug)
  const targetOrganizationId = targetSpace?.clerkOrganizationId
  const canActivateTarget = gatherMemberships.some(
    (membership) => membership.organization.id === targetOrganizationId,
  )
  const organizationMatches =
    canActivateTarget && organization?.id === targetOrganizationId

  useEffect(() => {
    if (!targetOrganizationId || !canActivateTarget || organizationMatches)
      return
    setActivationError(null)
    void setActive({ organization: targetOrganizationId }).catch((error) => {
      setActivationError(
        error instanceof Error
          ? error.message
          : 'Could not activate this Space',
      )
    })
  }, [canActivateTarget, organizationMatches, setActive, targetOrganizationId])

  useEffect(() => {
    if (!organizationMatches || !targetOrganizationId) {
      setTokenReadyForOrganization(null)
      return
    }
    let cancelled = false
    setTokenReadyForOrganization(null)
    void getToken({ template: 'convex', skipCache: true })
      .then(() => {
        if (!cancelled) setTokenReadyForOrganization(targetOrganizationId)
      })
      .catch((error) => {
        if (!cancelled)
          setActivationError(
            error instanceof Error
              ? error.message
              : 'Could not refresh Space access',
          )
      })
    return () => {
      cancelled = true
    }
  }, [getToken, organizationMatches, targetOrganizationId])

  const context = useSpaceQuery(
    spaceApi.spaces.context,
    tokenReadyForOrganization === targetOrganizationId ? { spaceSlug } : 'skip',
  ) as SpaceContextValue | undefined

  if (
    !isOrganizationLoaded ||
    !organizationList.isLoaded ||
    spaces === undefined
  )
    return <GateMessage>Loading Spaces...</GateMessage>
  if (!targetSpace) return <GateMessage>Space not found.</GateMessage>
  if (activationError) return <GateMessage>{activationError}</GateMessage>
  if (!canActivateTarget)
    return <GateMessage>Choose a Gather Space to continue.</GateMessage>
  if (!organizationMatches)
    return <GateMessage>Activating Space...</GateMessage>
  if (tokenReadyForOrganization !== targetOrganizationId)
    return <GateMessage>Refreshing Space access...</GateMessage>
  if (context === undefined) return <GateMessage>Loading Space...</GateMessage>
  return <SpaceContextProvider value={context}>{children}</SpaceContextProvider>
}
