import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import type { ActiveGroup } from '../app/GroupGate'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'

const inputClass =
  'min-h-9 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm'

export interface GroupIdentitySettingsProps {
  group: ActiveGroup
}

/**
 * What a Group is, who can get in, and how to get out.
 *
 * These used to be nowhere. Renaming and leaving lived on `/groups` or not at
 * all, and the invite code was a grey aside on a list row — so a page called
 * "<Group> settings" held one card about Notion and nothing about the Group
 * itself, which read as unfinished because it was. A Group row on `/groups` now
 * leads here, and this is what it has to be worth arriving at.
 *
 * Each control is offered only where it means something. A Personal group has
 * no second Member to invite, no name worth changing and nowhere to leave to,
 * so it gets none of them; renaming is an admin's to do. The mutations refuse
 * all of that again on the server — this only avoids showing a reader a button
 * whose whole purpose is to tell them no.
 */
export function GroupIdentitySettings({ group }: GroupIdentitySettingsProps) {
  const navigate = useNavigate()
  const rename = useMutation(api.groups.renameGroup)
  const leave = useMutation(api.groups.leaveGroup)
  const { confirm, dialog } = useConfirmAction()
  const messages = useMessages()
  const group_ = messages.settings.group
  const actions = messages.common.actions
  const [name, setName] = useState(group.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRename = group.role === 'admin' && !group.isPersonal

  async function submitRename(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) return
    setSaving(true)
    setError(null)
    try {
      // The slug follows the name, so the address this page is on stops
      // existing the moment the rename lands. Going to the new one is part of
      // the same action, not something to leave a reader stranded by.
      const slug = await rename({ groupId: group._id, name: trimmed })
      await navigate({
        to: '/g/$groupSlug/settings',
        params: { groupSlug: slug },
      })
    } catch (err) {
      setError(errorMessage(err, group_.renameFailed))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">{group_.title}</h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        {group.isPersonal ? group_.personalNote : group_.sharedNote}
      </p>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-[var(--app-danger)]">
          {error}
        </p>
      )}

      <div className="grid gap-4">
        {canRename ? (
          <form onSubmit={(e) => void submitRename(e)} className="grid gap-2">
            <label htmlFor="group-name" className="text-sm font-semibold">
              {group_.name}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputClass} sm:max-w-xs`}
              />
              <button
                type="submit"
                disabled={saving || !name.trim() || name.trim() === group.name}
                className={`${buttonClass} disabled:opacity-60`}
              >
                {saving ? actions.saving : group_.rename}
              </button>
            </div>
            <p className="m-0 text-xs text-[var(--app-muted)]">
              {group_.addressChanges}
            </p>
          </form>
        ) : null}

        {group.isPersonal ? null : <InviteCode slug={group.slug} />}

        {group.isPersonal ? null : (
          <div className="grid gap-2">
            <span className="text-sm font-semibold">{group_.leave}</span>
            <div>
              <button
                type="button"
                className={buttonClass}
                onClick={() =>
                  confirm({
                    title: fmt(group_.leaveTitle, { group: group.name }),
                    body: group_.leaveBody,
                    confirmLabel: group_.leaveConfirm,
                    // The one refusal a reader can act on is the last admin's,
                    // and the server's message names the fix; Members below is
                    // where it happens.
                    errorFallback: group_.leaveFailed,
                    run: async () => {
                      await leave({ groupId: group._id })
                      await navigate({ to: '/groups' })
                    },
                  })
                }
              >
                {group_.leaveButton}
              </button>
            </div>
          </div>
        )}
      </div>

      {dialog}
    </SurfaceCard>
  )
}

/**
 * The invite code, asked for by name.
 *
 * Its own query rather than a field on the gate's Group, because the code is a
 * capability and reading one should be a request somebody made — see
 * `groups.inviteCode`.
 */
function InviteCode({ slug }: { slug: string }) {
  const code = useQuery(api.groups.inviteCode, { slug })
  const messages = useMessages()
  const group_ = messages.settings.group

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{group_.inviteCode}</span>
      <div className="flex flex-wrap items-center gap-2">
        {code === undefined ? (
          <span className="text-sm text-[var(--app-muted)]">
            {messages.common.errors.loading}
          </span>
        ) : (
          <Pill>{code}</Pill>
        )}
      </div>
      <p className="m-0 text-xs text-[var(--app-muted)]">
        {group_.inviteCodeNote}
      </p>
    </div>
  )
}
