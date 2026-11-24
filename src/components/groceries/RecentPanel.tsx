import {
  formatGroceryAmount,
  groceryKey,
  parseGroceryLine,
} from '@gather/core/groceries'
import { aisleOf, recentDays } from '@gather/core/grocery-list'
import { useMutation, useQuery } from 'convex/react'
import { Check, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { InsetList, SectionFooter, SectionLabel } from '../app/InsetList'

export interface RecentPanelProps {
  groupSlug: string
  listId: Id<'taskLists'> | undefined
  /** Open item titles on the target list so rows already on it say so. */
  openTitles: readonly string[]
  /** `panel` inside the desktop 340 px aside; `page` on `/groceries/recent`. */
  mode?: 'panel' | 'page'
}

const keyOf = (title: string) => groceryKey(parseGroceryLine(title).name)

/**
 * Recent checked groceries across the Group's grocery lists, grouped by day.
 * Clicking `+` puts an item back on the active grocery list with its last
 * amount, unit and aisle via `tasks.putBack`.
 */
export function RecentPanel({
  groupSlug,
  listId,
  openTitles,
  mode = 'panel',
}: RecentPanelProps) {
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const r = g.recent
  const recent = useQuery(api.tasks.recentGroceries, { groupSlug })
  const putBack = useMutation(api.tasks.putBack)
  const errorText = useErrorMessage()

  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const onListKeys = useMemo(
    () => new Set(openTitles.map((title) => keyOf(title))),
    [openTitles],
  )
  const days = useMemo(() => recentDays(recent ?? []), [recent])
  const todayStr = new Date().toDateString()

  const dayLabel = (isoDate: string) => {
    const day = new Date(`${isoDate}T12:00:00`)
    const long = day.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    if (day.toDateString() === todayStr) return `${r.today} · ${long}`
    return long.charAt(0).toLocaleUpperCase(locale) + long.slice(1)
  }

  const reAdd = async (taskId: Id<'tasks'>) => {
    if (!listId || pendingIds.has(taskId)) return
    setError(null)
    setPendingIds((current) => new Set(current).add(taskId))
    try {
      await putBack({ taskId, groupSlug, listId })
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(taskId)
        return next
      })
    }
  }

  const content = (
    <>
      <p className="m-0 text-footnote text-[var(--muted)]">
        {g.web.recentIntro}
      </p>
      {error ? (
        <p
          role="alert"
          className="m-0 text-footnote font-semibold text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      {recent === undefined ? (
        <p className="m-0 text-subhead text-[var(--muted)]">
          {messages.common.errors.loading}
        </p>
      ) : recent.length === 0 ? (
        <p className="m-0 text-subhead text-[var(--muted)]">{r.empty}</p>
      ) : (
        <div className="grid gap-4">
          {days.map((day) => {
            const rows = day.rows.map((row) => {
              const amount = formatGroceryAmount(
                row.quantity,
                row.unit,
                locale,
                g.units,
              )
              const aisle = g.aisles[aisleOf(row)]
              const meta = amount
                ? `${fmt(r.last, { amount })} · ${aisle}`
                : aisle
              const onList = onListKeys.has(keyOf(row.title))
              const busy = pendingIds.has(row._id)
              return (
                <li
                  key={row._id}
                  className={`flex min-h-[var(--size-row-min)] items-center gap-2 py-2 [&+li]:border-t-[0.5px] [&+li]:border-[var(--hair)] ${
                    mode === 'page' ? 'px-4' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-[var(--ink)]">
                      {row.title}
                    </span>
                    <span className="block truncate text-footnote text-[var(--muted)]">
                      {meta}
                    </span>
                  </div>
                  {onList ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-footnote font-semibold text-[var(--muted)]">
                      <Check className="size-3.5" aria-hidden="true" />
                      {r.onList}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!listId || busy}
                      aria-label={fmt(r.putBack, { name: row.title })}
                      title={fmt(r.putBack, { name: row.title })}
                      onClick={() => void reAdd(row._id)}
                      className={`${buttonClass.smallRound} pointer-coarse:size-[var(--size-control-min)] text-[var(--accent-text)]`}
                    >
                      <Plus
                        className="size-4"
                        strokeWidth={2.6}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </li>
              )
            })

            return mode === 'page' ? (
              <section key={day.date}>
                <SectionLabel level={2}>{dayLabel(day.date)}</SectionLabel>
                <InsetList>{rows}</InsetList>
              </section>
            ) : (
              <section key={day.date} className="grid gap-1">
                <h3 className="m-0 text-footnote font-semibold text-[var(--muted)]">
                  {dayLabel(day.date)}
                </h3>
                <ul className="m-0 list-none p-0">{rows}</ul>
              </section>
            )
          })}
        </div>
      )}
      {recent && recent.length > 0 ? (
        mode === 'page' ? (
          <SectionFooter>{r.footnote}</SectionFooter>
        ) : (
          <p className="m-0 text-footnote text-[var(--muted)]">{r.footnote}</p>
        )
      ) : null}
    </>
  )

  return (
    <div
      className={mode === 'panel' ? 'grid gap-3 p-4' : 'grid gap-4'}
      data-testid="recent-panel"
    >
      {content}
    </div>
  )
}
