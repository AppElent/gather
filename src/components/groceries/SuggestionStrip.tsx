import {
  capitalise,
  daysAgo,
  type GroceryHabit,
  groceryCadence,
} from '@gather/core/groceries'
import { useMutation } from 'convex/react'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { SectionLabel } from '../app/InsetList'

export interface SuggestionStripProps {
  groupSlug: string
  listId: Id<'taskLists'>
  writable: boolean
  suggestionsOff: boolean
  suggestions: readonly GroceryHabit[]
  onUndoable: (message: string, undo: () => void) => void
}

/**
 * The "Maybe needed" strip above the aisle sections (APP-316, direction A):
 * 200 px wrapping cards at `lg`, 168 px horizontally scrolling cards below `lg`.
 * Click adds with the usual amount; the separate × button hides a suggestion
 * for good (with Undo).
 */
export function SuggestionStrip({
  groupSlug,
  listId,
  writable,
  suggestionsOff,
  suggestions,
  onUndoable,
}: SuggestionStripProps) {
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const s = g.suggestions
  const addTask = useMutation(api.tasks.add)
  const hideSuggestion = useMutation(api.taskLists.hideSuggestion)
  const unhideSuggestion = useMutation(api.taskLists.unhideSuggestion)

  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const keys = new Set(suggestions.map((habit) => habit.key))
    setGone((held) => {
      const kept = [...held].filter((key) => keys.has(key))
      return kept.length === held.size ? held : new Set(kept)
    })
  }, [suggestions])

  if (!writable || suggestionsOff) return null
  const shown = suggestions.filter((habit) => !gone.has(habit.key))
  if (shown.length === 0) return null

  const now = Date.now()

  const whyText = (habit: GroceryHabit) => {
    const cadence = groceryCadence(habit.intervalDays ?? 1)
    const cadenceLabel =
      'count' in cadence
        ? fmt(s.cadence[cadence.unit], { count: cadence.count })
        : s.cadence[cadence.unit]
    const days = daysAgo(habit.lastAt, now)
    const ago =
      days === 0
        ? s.ago.today
        : days === 1
          ? s.ago.yesterday
          : plural(locale, days, s.ago.days)
    return capitalise(fmt(s.why, { cadence: cadenceLabel, ago }))
  }

  const leave = (key: string, leaving: boolean) =>
    setGone((current) => {
      const next = new Set(current)
      if (leaving) next.add(key)
      else next.delete(key)
      return next
    })

  const add = (habit: GroceryHabit) => {
    leave(habit.key, true)
    void addTask({
      listId,
      groupSlug,
      title: habit.title,
      ...(habit.quantity !== undefined ? { quantity: habit.quantity } : {}),
      ...(habit.unit !== undefined ? { unit: habit.unit } : {}),
    }).catch(() => leave(habit.key, false))
  }

  const hide = (habit: GroceryHabit) => {
    leave(habit.key, true)
    void hideSuggestion({ listId, groupSlug, title: habit.title })
      .then(() =>
        onUndoable(fmt(s.hidden, { name: habit.title }), () => {
          leave(habit.key, false)
          void unhideSuggestion({
            listId,
            groupSlug,
            title: habit.title,
          }).catch(() => leave(habit.key, true))
        }),
      )
      .catch(() => leave(habit.key, false))
  }

  return (
    <section
      aria-labelledby="grocery-suggestions-heading"
      data-testid="grocery-suggestions"
    >
      <SectionLabel
        id="grocery-suggestions-heading"
        action={
          <span className="text-footnote text-[var(--muted)]">
            {g.web.hideSuggestionHint}
          </span>
        }
      >
        {s.title}
      </SectionLabel>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-x-visible">
        {shown.map((habit) => {
          const name = capitalise(habit.title)
          const why = whyText(habit)
          return (
            <div
              key={habit.key}
              className="flex w-[168px] shrink-0 items-stretch rounded-[var(--radius-card)] bg-[var(--surface)] lg:w-[200px]"
            >
              <button
                type="button"
                aria-label={fmt(s.add, { name, why })}
                onClick={() => add(habit)}
                className="flex min-w-0 flex-1 items-start gap-2 rounded-l-[var(--radius-card)] py-2.5 pr-1 pl-3 text-left hover:bg-[var(--surface-2)]"
              >
                <Plus
                  className="mt-0.5 size-4 shrink-0 text-[var(--accent-text)]"
                  strokeWidth={2.6}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-subhead font-semibold text-[var(--ink)]">
                    {name}
                  </span>
                  <span className="block text-footnote text-[var(--muted)]">
                    {why}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={fmt(g.web.stopSuggesting, { name })}
                title={fmt(g.web.stopSuggesting, { name })}
                onClick={() => hide(habit)}
                className="grid w-9 pointer-coarse:w-[var(--size-control-min)] shrink-0 place-items-center rounded-r-[var(--radius-card)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                <X className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
