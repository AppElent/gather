import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import type { ActiveGroup } from '../app/GroupGate'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold disabled:opacity-60'

export interface GroupMembersSettingsProps {
  group: ActiveGroup
}

/**
 * Who is in this Group, and who may change it.
 *
 * This card is here because of the one next to it. Leaving a Group is now
 * something a Member can actually do, and the last admin walking out would
 * leave a household nobody can rename, delete or hand on — so `leaveGroup`
 * refuses that departure. A refusal with no way to satisfy it is only a
 * different trap, and this is the way to satisfy it: make somebody else an
 * admin, then go.
 *
 * Roles are shown to everyone and changeable only by an admin. Knowing who can
 * act on the Group is not privileged information — being able to *decide* it
 * is.
 */
export function GroupMembersSettings({ group }: GroupMembersSettingsProps) {
  const members = useQuery(api.groups.members, { slug: group.slug })
  const me = useQuery(api.users.me)
  const setRole = useMutation(api.groups.setMemberRole)
  const [error, setError] = useState<string | null>(null)
  const { members: membersText } = useMessages().settings
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  if (group.isPersonal) return null

  const isAdmin = group.role === 'admin'
  const adminCount = members?.filter((m) => m.role === 'admin').length ?? 0

  async function change(userId: string, role: 'admin' | 'member') {
    setError(null)
    setBusyUserId(userId)
    try {
      await setRole({
        groupId: group._id,
        userId: userId as Parameters<typeof setRole>[0]['userId'],
        role,
      })
    } catch (e) {
      setError(errorMessage(e, membersText.roleFailed))
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <SurfaceCard ariaLabel={membersText.title}>
      <h2 className="m-0 mb-1 text-base font-semibold">{membersText.title}</h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        {isAdmin ? membersText.personalNote : membersText.sharedNote}
      </p>

      {error && (
        <p role="alert" className="m-0 mb-2 text-sm text-[var(--app-danger)]">
          {error}
        </p>
      )}

      {members === undefined ? (
        <div className="h-16 animate-pulse rounded-[var(--app-radius)] bg-[var(--app-surface-muted)]" />
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {members.map((member) => {
            // The last admin cannot be demoted, for the reason they cannot
            // leave: it would empty the Group of anyone able to undo it.
            const isLastAdmin = member.role === 'admin' && adminCount <= 1

            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {member.name}
                  </span>
                  {member.userId === me?._id ? (
                    <Pill>{membersText.you}</Pill>
                  ) : null}
                  {member.role === 'admin' ? (
                    <Pill tone="dark">{membersText.admin}</Pill>
                  ) : null}
                </span>

                {isAdmin ? (
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busyUserId === member.userId || isLastAdmin}
                    title={isLastAdmin ? membersText.lastAdmin : undefined}
                    onClick={() =>
                      void change(
                        member.userId,
                        member.role === 'admin' ? 'member' : 'admin',
                      )
                    }
                  >
                    {member.role === 'admin'
                      ? membersText.makeMember
                      : membersText.makeAdmin}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </SurfaceCard>
  )
}
