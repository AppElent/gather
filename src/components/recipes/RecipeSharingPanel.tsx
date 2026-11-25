import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { useCurrentGroup } from '../app/useCurrentGroup'

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
 * either (GLOSSARY.md's Move and Share).
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
  const { setCurrentGroup } = useCurrentGroup()
  const messages = useMessages()
  const errorText = useErrorMessage()
  const { sharing } = messages.recipes

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
      setError(errorText(err, messages.common.errors.didNotWork))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--surface)] p-4 text-subhead">
      <h2 className="mt-0 mb-2 text-subhead font-semibold">{sharing.title}</h2>

      <p className="mt-0 mb-1">
        {sharing.livesIn}{' '}
        <strong>{homeGroupName ?? sharing.unknownGroup}</strong>
      </p>

      {sharedGroups.length === 0 ? (
        <p className="mt-0 mb-3 text-[var(--muted)]">{sharing.notShared}</p>
      ) : (
        <ul className="mb-3 list-none space-y-1 p-0">
          {sharedGroups.map((group) => (
            <li key={group._id} className="flex items-center gap-2">
              <span>
                {fmt(sharing.sharedWith, { group: group.name })}
              </span>
              <button
                type="button"
                disabled={busy}
                className="inline-flex min-h-9 shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-3.5 text-footnote font-semibold text-[var(--ink)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() =>
                  run(() =>
                    unshare({ id: recipeId, withGroupSlug: group.slug }),
                  )
                }
              >
                {sharing.unshare}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-0 mb-3 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-3 py-2 font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      {others.length === 0 ? (
        <p className="m-0 text-[var(--muted)]">{sharing.onlyOneGroup}</p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[var(--muted)]" htmlFor="recipe-move-to">
              {sharing.moveTo}
            </label>
            <select
              id="recipe-move-to"
              className="min-h-9 rounded-[var(--radius-control)] border border-[var(--control-edge)] bg-[var(--surface)] px-2.5 text-[var(--ink)]"
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            >
              <option value="">{sharing.chooseGroup}</option>
              {others.map((group) => (
                <option key={group._id} value={group.slug}>
                  {group.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || moveTo === ''}
              className="inline-flex min-h-9 shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-3.5 text-footnote font-semibold text-[var(--ink)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() =>
                run(async () => {
                  await move({ id: recipeId, toGroupSlug: moveTo })
                  // The page reads the recipe through the Current Group, which
                  // it has just left. Follow it to its new Group rather than
                  // leaving a "not found" behind.
                  const destination = others.find((g) => g.slug === moveTo)
                  if (destination) setCurrentGroup(destination._id)
                })
              }
            >
              {sharing.move}
            </button>
          </div>

          {shareOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[var(--muted)]" htmlFor="recipe-share-with">
                {sharing.shareWith}
              </label>
              <select
                id="recipe-share-with"
                className="min-h-9 rounded-[var(--radius-control)] border border-[var(--control-edge)] bg-[var(--surface)] px-2.5 text-[var(--ink)]"
                value={shareWith}
                onChange={(e) => setShareWith(e.target.value)}
              >
                <option value="">{sharing.chooseGroup}</option>
                {shareOptions.map((group) => (
                  <option key={group._id} value={group.slug}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || shareWith === ''}
                className="inline-flex min-h-9 shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-3.5 text-footnote font-semibold text-[var(--ink)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() =>
                  run(async () => {
                    await share({ id: recipeId, withGroupSlug: shareWith })
                    setShareWith('')
                  })
                }
              >
                {sharing.share}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
