import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { groupLink } from '../../lib/groupPaths'

export interface RecipeSharingPanelProps {
  recipeId: Id<'recipes'>
  /** The Group the recipe lives in, as `recipes.get` reports it. */
  homeGroupName: string | null
  homeGroupSlug: string | null
  /** The further Groups it is visible in. */
  sharedGroups: Array<{ _id: Id<'groups'>; name: string; slug: string }>
}

/**
 * Where a recipe lives, who else can see it, and the two verbs that change
 * either (CONTEXT.md's Move and Share).
 *
 * Rendered only where `recipes.get` says `canEdit` — a Group that was merely
 * shared the recipe reads it and no more, so offering it these controls would
 * be offering an action that can only fail on click.
 *
 * It says the answer before it offers to change it, because "who can see this?"
 * should never be something a household has to guess at. The destinations on
 * offer are the caller's own Groups: you cannot put a recipe into a Group you
 * are not in.
 */
export function RecipeSharingPanel({
  recipeId,
  homeGroupName,
  homeGroupSlug,
  sharedGroups,
}: RecipeSharingPanelProps) {
  const myGroups = useQuery(api.groups.myGroups)
  const move = useMutation(api.recipes.move)
  const share = useMutation(api.recipes.share)
  const unshare = useMutation(api.recipes.unshare)
  const navigate = useNavigate()

  const [moveTo, setMoveTo] = useState('')
  const [shareWith, setShareWith] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sharedSlugs = new Set(sharedGroups.map((g) => g.slug))
  const others = (myGroups ?? []).filter((g) => g.slug !== homeGroupSlug)
  const shareOptions = others.filter((g) => !sharedSlugs.has(g.slug))

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not do that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-4 rounded-md border px-3 py-3 text-sm">
      <h2 className="mb-2 font-medium">Groups</h2>

      <p className="mb-1 opacity-80">
        Lives in <strong>{homeGroupName ?? 'a group you are in'}</strong>
      </p>

      {sharedGroups.length === 0 ? (
        <p className="mb-3 opacity-60">Not shared with any other group.</p>
      ) : (
        <ul className="mb-3 list-none space-y-1 p-0">
          {sharedGroups.map((group) => (
            <li key={group._id} className="flex items-center gap-2">
              <span className="opacity-80">Shared with {group.name}</span>
              <button
                type="button"
                disabled={busy}
                className="rounded border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() =>
                  run(() =>
                    unshare({ id: recipeId, withGroupSlug: group.slug }),
                  )
                }
              >
                Unshare
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      {others.length === 0 ? (
        <p className="opacity-60">
          You are only in one group, so there is nowhere to move or share this
          to yet.
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <label className="opacity-80" htmlFor="recipe-move-to">
              Move to
            </label>
            <select
              id="recipe-move-to"
              className="rounded border px-2 py-1"
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            >
              <option value="">Choose a group…</option>
              {others.map((group) => (
                <option key={group._id} value={group.slug}>
                  {group.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || moveTo === ''}
              className="rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() =>
                run(async () => {
                  await move({ id: recipeId, toGroupSlug: moveTo })
                  // This page is addressed inside the Group the recipe has just
                  // left, and that address no longer resolves to anything
                  // (ADR-0002). Follow the recipe to its new one rather than
                  // leaving a "not found" behind.
                  await navigate(groupLink('recipe', moveTo, { recipeId }))
                })
              }
            >
              Move
            </button>
          </div>

          {shareOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="opacity-80" htmlFor="recipe-share-with">
                Share with
              </label>
              <select
                id="recipe-share-with"
                className="rounded border px-2 py-1"
                value={shareWith}
                onChange={(e) => setShareWith(e.target.value)}
              >
                <option value="">Choose a group…</option>
                {shareOptions.map((group) => (
                  <option key={group._id} value={group.slug}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || shareWith === ''}
                className="rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() =>
                  run(async () => {
                    await share({ id: recipeId, withGroupSlug: shareWith })
                    setShareWith('')
                  })
                }
              >
                Share
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
