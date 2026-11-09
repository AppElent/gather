import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { useConfirmAction } from '../app/ConfirmAction'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import type { ShellGroup } from '../app/useCurrentGroup'
import { ImageUploadField } from '../photo/ImageUploadField'

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'

const dangerButtonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[color-mix(in_oklch,var(--app-danger)_45%,var(--app-border))] px-3 text-sm font-semibold text-[var(--app-danger)] disabled:opacity-60'

const inputClass =
  'min-h-9 w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm'

export interface GroupIdentitySettingsProps {
  group: ShellGroup
}

/**
 * What a Group is, who can get in, and how to get out.
 *
 * Renaming and deleting are an admin's to do, so only an admin is offered
 * them. The mutations refuse them again on the server — this only avoids
 * showing a reader a button whose whole purpose is to tell them no.
 *
 * Deleting is allowed only to the last Member, and here the button says so
 * before it is pressed rather than letting the server refuse it, unlike Leave:
 * Leave's refusal names a fix on this page (make somebody else an admin), but
 * nothing on the web removes another Member, so a refusal to delete would only
 * explain a dead end after asking about it.
 */
export function GroupIdentitySettings({ group }: GroupIdentitySettingsProps) {
  const navigate = useNavigate()
  const rename = useMutation(api.groups.renameGroup)
  const leave = useMutation(api.groups.leaveGroup)
  const deleteGroup = useMutation(api.groups.deleteGroup)
  const updateAppearance = useMutation(api.groups.updateAppearance)
  const generateImageUploadUrl = useMutation(api.groups.generateImageUploadUrl)
  const { confirm, dialog } = useConfirmAction()
  const messages = useMessages()
  const group_ = messages.settings.group
  const actions = messages.common.actions
  const [name, setName] = useState(group.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [icon, setIcon] = useState(group.icon ?? 'Users')
  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>(
    group.imageId,
  )

  const isAdmin = group.role === 'admin'
  // The same subscription as the Members card below, so no second read.
  const members = useQuery(
    api.groups.members,
    isAdmin ? { slug: group.slug } : 'skip',
  )
  const othersRemain = members !== undefined && members.length > 1

  async function submitRename(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) return
    setSaving(true)
    setError(null)
    try {
      await rename({ groupId: group._id, name: trimmed })
    } catch (err) {
      setError(errorMessage(err, group_.renameFailed))
    } finally {
      setSaving(false)
    }
  }

  async function saveAppearance() {
    setSaving(true)
    setError(null)
    try {
      await updateAppearance({
        groupId: group._id,
        icon,
        imageId: imageId ?? null,
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
        {group_.sharedNote}
      </p>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-[var(--app-danger)]">
          {error}
        </p>
      )}

      <div className="grid gap-4">
        {isAdmin ? (
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
          </form>
        ) : null}

        {isAdmin ? (
          <div className="grid gap-2">
            <label htmlFor="group-icon" className="text-sm font-semibold">
              Icon
            </label>
            <select
              id="group-icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              className={inputClass}
            >
              <option value="Users">People</option>
              <option value="House">Home</option>
              <option value="Heart">Heart</option>
              <option value="Utensils">Food</option>
              <option value="Wine">Wine</option>
            </select>
            <ImageUploadField
              imageUrl={group.imageUrl ?? null}
              onChange={setImageId}
              generateUploadUrl={generateImageUploadUrl}
              preset="groupPhoto"
              label="Group picture"
              fieldId="group-image"
            />
            <div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAppearance()}
                className={buttonClass}
              >
                {saving ? actions.saving : 'Save appearance'}
              </button>
            </div>
          </div>
        ) : null}

        <InviteCode slug={group.slug} />

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
                    await navigate(linkTo('groups'))
                  },
                })
              }
            >
              {group_.leaveButton}
            </button>
          </div>
        </div>

        {isAdmin ? (
          <div className="grid gap-2">
            <span className="text-sm font-semibold">{group_.delete}</span>
            <div>
              <button
                type="button"
                className={dangerButtonClass}
                disabled={members === undefined || othersRemain}
                aria-describedby={
                  othersRemain ? 'group-delete-note' : undefined
                }
                onClick={() =>
                  confirm({
                    title: fmt(group_.deleteTitle, { group: group.name }),
                    body: group_.deleteBody,
                    confirmLabel: group_.deleteConfirm,
                    errorFallback: group_.deleteFailed,
                    // Where leaving goes: the Current Group is gone either way.
                    run: async () => {
                      await deleteGroup({ groupId: group._id })
                      await navigate(linkTo('groups'))
                    },
                  })
                }
              >
                {group_.deleteButton}
              </button>
            </div>
            {othersRemain ? (
              <p
                id="group-delete-note"
                className="m-0 text-xs text-[var(--app-muted)]"
              >
                {group_.deleteOthersFirst}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {dialog}
    </SurfaceCard>
  )
}

/**
 * The invite code, asked for by name.
 *
 * Its own query rather than a field on the Current Group, because the code is a
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
