import {
  useClerk,
  useOrganization,
  useOrganizationList,
} from '@clerk/clerk-react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  filterGatherInvitations,
  filterGatherMemberships,
  type GatherInvitation,
  type GatherMembership,
} from './gatherClerk'

type Pending = {
  organizationId: string
  name: string
  spaceSlug: string
  repairMembership: boolean
}
type CreateResult = { clerkOrganizationId: string; spaceSlug: string }
const unsafeApi = api as unknown as {
  spaceAdmin: { create: typeof api.users.ensureUser }
  spaces: {
    activeSpace: unknown
    ensureMembershipProjection: typeof api.users.ensureUser
  }
}

const useSpaceQuery = useQuery as unknown as (
  reference: unknown,
  args?: unknown,
) => unknown

export function SpaceOnboarding() {
  const { setActive } = useClerk()
  const { organization } = useOrganization()
  const organizationList = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: { infinite: true },
  })
  const createSpace = useMutation(
    unsafeApi.spaceAdmin.create,
  ) as unknown as (args: {
    name: string
    requestId: string
  }) => Promise<CreateResult>
  const ensureMembershipProjection = useMutation(
    unsafeApi.spaces.ensureMembershipProjection,
  ) as unknown as (args: { spaceSlug: string }) => Promise<unknown>
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [request, setRequest] = useState<{ name: string; id: string } | null>(
    null,
  )
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeOrganizationIsGather = filterGatherMemberships(
    (organizationList.userMemberships.data ?? []) as GatherMembership[],
  ).some((membership) => membership.organization.id === organization?.id)
  const activeSpace = useSpaceQuery(
    unsafeApi.spaces.activeSpace,
    (pending && organization?.id === pending.organizationId) ||
      (!pending && activeOrganizationIsGather)
      ? {}
      : 'skip',
  ) as { spaceSlug: string } | undefined
  const memberships = filterGatherMemberships(
    (organizationList.userMemberships.data ??
      []) as unknown as GatherMembership[],
  )
  const invitations = filterGatherInvitations(
    (organizationList.userInvitations.data ??
      []) as unknown as GatherInvitation[],
  )
  const busy = pending !== null

  const activate = useCallback(
    async (next: Pending) => {
      setError(null)
      setPending(next)
      try {
        await setActive({ organization: next.organizationId })
      } catch (value) {
        setPending(null)
        setError(
          value instanceof Error
            ? value.message
            : 'Could not activate this Space. Please retry.',
        )
      }
    },
    [setActive],
  )

  useEffect(() => {
    if (organizationList.userMemberships.hasNextPage)
      void organizationList.userMemberships.fetchNext()
  }, [
    organizationList.userMemberships.fetchNext,
    organizationList.userMemberships.hasNextPage,
  ])

  useEffect(() => {
    if (organizationList.userInvitations.hasNextPage)
      void organizationList.userInvitations.fetchNext()
  }, [
    organizationList.userInvitations.fetchNext,
    organizationList.userInvitations.hasNextPage,
  ])

  useEffect(() => {
    if (busy || !organization || !activeSpace || !activeOrganizationIsGather)
      return
    void navigate({
      to: '/s/$spaceSlug/home',
      params: { spaceSlug: activeSpace.spaceSlug },
    })
  }, [activeOrganizationIsGather, activeSpace, busy, navigate, organization])

  useEffect(() => {
    if (busy || organization || memberships.length === 0) return
    const first = memberships[0]
    void activate({
      organizationId: first.organization.id,
      name: first.organization.name,
      spaceSlug: '',
      repairMembership: true,
    })
  }, [activate, busy, memberships, organization])

  useEffect(() => {
    if (!pending || organization?.id !== pending.organizationId) return
    const spaceSlug = pending.spaceSlug || activeSpace?.spaceSlug
    if (!spaceSlug) return

    let cancelled = false
    const complete = async () => {
      if (pending.repairMembership)
        await ensureMembershipProjection({ spaceSlug })
      if (!cancelled) {
        setRequest(null)
        await navigate({
          to: '/s/$spaceSlug/home',
          params: { spaceSlug },
        })
      }
    }
    void complete().catch((value) => {
      if (!cancelled) {
        setPending(null)
        setError(
          value instanceof Error
            ? value.message
            : 'Could not prepare this Space. Please retry.',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    activeSpace?.spaceSlug,
    ensureMembershipProjection,
    navigate,
    organization?.id,
    pending,
  ])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    const nextRequest =
      request?.name === trimmed
        ? request
        : { name: trimmed, id: crypto.randomUUID() }
    setRequest(nextRequest)
    setError(null)
    try {
      const result = await createSpace({
        name: trimmed,
        requestId: nextRequest.id,
      })
      await activate({
        organizationId: result.clerkOrganizationId,
        name: trimmed,
        spaceSlug: result.spaceSlug,
        repairMembership: false,
      })
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : 'Could not create this Space. Please retry.',
      )
    }
  }

  const join = async (invitation: GatherInvitation) => {
    if (busy) return
    try {
      await invitation.accept()
      await activate({
        organizationId: invitation.organization.id,
        name: invitation.organization.name,
        spaceSlug: '',
        repairMembership: true,
      })
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : 'Could not join this Space. Please retry.',
      )
    }
  }

  if (!organizationList.isLoaded)
    return <p className="text-sm text-[var(--app-muted)]">Loading Spaces...</p>

  return (
    <div className="mx-auto grid max-w-xl gap-6 py-10">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--app-muted)]">
          Gather Spaces
        </p>
        <h1 className="m-0 text-3xl font-semibold">Create or join a Space</h1>
      </div>
      {memberships.length > 0 ? <p>You have Gather Spaces available.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {invitations.map((invitation) => (
        <div key={invitation.id}>
          <span>{invitation.organization.name}</span>
          {invitation.inviterName ? (
            <span>Invited by {invitation.inviterName}</span>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void join(invitation)}
          >
            Join
          </button>
        </div>
      ))}
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="space-name">
          Space name
          <input
            id="space-name"
            value={name}
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value)
              if (request?.name !== event.target.value.trim()) setRequest(null)
            }}
          />
        </label>
        <button type="submit" disabled={busy || !name.trim()}>
          Create Space
        </button>
        {error ? (
          <button type="submit" disabled={busy}>
            Retry
          </button>
        ) : null}
      </form>
    </div>
  )
}
