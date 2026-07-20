import { useOrganization } from '@clerk/clerk-react'
import { useAction } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useSpace } from '../spaces/SpaceContext'

const unsafeApi = api as unknown as {
  spaceAdmin: {
    invite: unknown
    revokeInvitation: unknown
    changeRole: unknown
    removeMember: unknown
    reconcile: unknown
  }
}

type Member = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
}
type Invitation = { id: string; emailAddress: string }

type ClerkMembership = {
  id: string
  role: unknown
  publicUserData?: {
    identifier?: string
    firstName?: string
    lastName?: string
  }
}

type ClerkInvitation = {
  id: string
  emailAddress?: string
  email_address?: string
}

type ClerkMembershipList = { data?: ClerkMembership[] }
type ClerkInvitationList = { data?: ClerkInvitation[] }

function clerkRole(role: unknown): 'admin' | 'member' {
  return role === 'org:admin' || role === 'admin' ? 'admin' : 'member'
}

function memberName(membership: ClerkMembership) {
  const name = [
    membership.publicUserData?.firstName,
    membership.publicUserData?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
  return name || membership.publicUserData?.identifier || 'Member'
}

function readMembers(memberships: ClerkMembershipList | undefined): Member[] {
  return (memberships?.data ?? []).map((membership) => ({
    id: membership.id,
    name: memberName(membership),
    email: membership.publicUserData?.identifier ?? '',
    role: clerkRole(membership.role),
  }))
}

function readInvitations(
  invitations: ClerkInvitationList | undefined,
): Invitation[] {
  return (invitations?.data ?? []).map((invitation) => ({
    id: invitation.id,
    emailAddress:
      invitation.emailAddress ??
      invitation.email_address ??
      'Pending invitation',
  }))
}
export function SpaceMembers() {
  const { space, role } = useSpace()
  const { memberships, invitations: invitationResource } = useOrganization({
    memberships: { infinite: true },
    invitations: { infinite: true },
  })
  const members = useMemo(
    () =>
      readMembers(memberships as unknown as ClerkMembershipList | undefined),
    [memberships],
  )
  const invitations = useMemo(
    () =>
      readInvitations(
        invitationResource as unknown as ClerkInvitationList | undefined,
      ),
    [invitationResource],
  )
  const [emailAddress, setEmailAddress] = useState('')
  const invite = (useAction as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceAdmin.invite,
  ) as (args: {
    spaceSlug: string
    emailAddress: string
    publicAppOrigin: string
  }) => Promise<unknown>
  const revokeInvitation = (
    useAction as unknown as (reference: unknown) => unknown
  )(unsafeApi.spaceAdmin.revokeInvitation) as (args: {
    spaceSlug: string
    invitationId: string
  }) => Promise<unknown>
  const changeRole = (useAction as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceAdmin.changeRole,
  ) as (args: {
    spaceSlug: string
    clerkMembershipId: string
    role: 'admin' | 'member'
  }) => Promise<unknown>
  const removeMember = (
    useAction as unknown as (reference: unknown) => unknown
  )(unsafeApi.spaceAdmin.removeMember) as (args: {
    spaceSlug: string
    clerkMembershipId: string
  }) => Promise<unknown>
  const reconcile = (useAction as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceAdmin.reconcile,
  ) as (args: { spaceSlug: string }) => Promise<unknown>
  const isAdmin = role === 'admin'
  const adminCount = members.filter((member) => member.role === 'admin').length

  if (!isAdmin)
    return (
      <p role="alert" className="m-0 text-sm text-[var(--app-muted)]">
        Admin access required
      </p>
    )

  return (
    <section className="grid max-w-3xl gap-6">
      <header>
        <h1 className="m-0 text-2xl font-semibold">Members</h1>
        <p className="mb-0 mt-1 text-sm text-[var(--app-muted)]">
          Clerk is the source of truth for memberships.
        </p>
      </header>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!emailAddress.trim()) return
          void invite({
            spaceSlug: space.slug,
            emailAddress: emailAddress.trim(),
            publicAppOrigin: window.location.origin,
          })
          setEmailAddress('')
        }}
      >
        <label className="grid gap-1 text-sm">
          Invite by email
          <input
            type="email"
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!emailAddress.trim()}>
          Invite member
        </button>
        <button
          type="button"
          onClick={() => void reconcile({ spaceSlug: space.slug })}
        >
          Reconcile with Clerk
        </button>
      </form>
      <section className="grid gap-3">
        <h2 className="m-0 text-lg font-semibold">Current members</h2>
        {members.map((member) => {
          const isLastAdmin = member.role === 'admin' && adminCount === 1
          return (
            <article
              key={member.id}
              className="flex flex-wrap items-center gap-2 rounded border border-[var(--app-border)] p-3"
            >
              <span className="mr-auto">
                <strong>{member.name}</strong>
                {member.email ? ` (${member.email})` : ''} - {member.role}
              </span>
              {member.role === 'admin' ? (
                <button
                  type="button"
                  disabled={isLastAdmin}
                  onClick={() =>
                    void changeRole({
                      spaceSlug: space.slug,
                      clerkMembershipId: member.id,
                      role: 'member',
                    })
                  }
                >
                  Demote {member.name}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void changeRole({
                      spaceSlug: space.slug,
                      clerkMembershipId: member.id,
                      role: 'admin',
                    })
                  }
                >
                  Promote {member.name}
                </button>
              )}
              <button
                type="button"
                disabled={isLastAdmin}
                onClick={() =>
                  void removeMember({
                    spaceSlug: space.slug,
                    clerkMembershipId: member.id,
                  })
                }
              >
                Remove {member.name}
              </button>
            </article>
          )
        })}
      </section>
      {invitations.length ? (
        <section className="grid gap-3">
          <h2 className="m-0 text-lg font-semibold">Pending invitations</h2>
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-wrap items-center gap-2 rounded border border-[var(--app-border)] p-3"
            >
              <span className="mr-auto">{invitation.emailAddress}</span>
              <button
                type="button"
                onClick={() =>
                  void revokeInvitation({
                    spaceSlug: space.slug,
                    invitationId: invitation.id,
                  })
                }
              >
                Revoke invitation
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </section>
  )
}
