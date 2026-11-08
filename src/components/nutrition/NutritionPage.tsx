import { addDays, localIsoDate } from '@gather/core/civil-date'
import { MEAL_NAMES } from '@gather/core/domain'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { sumFacts } from '../../../convex/lib/consumption'
import { fmt, useMessages } from '../../lib/i18n'
import { addFoodLink, linkTo } from '../../lib/links'
import { DayTotals } from './DayTotals'
import { sumKcal } from './kcal'
import { MealSlot } from './MealSlot'

export interface NutritionSearch {
  date?: string
}

/**
 * The day parameter, validated identically on both routes.
 *
 * A YYYY-MM-DD date string is never valid JSON as a number (the dashes make
 * JSON.parse throw), so the router's default search codec falls back to the raw
 * string here — unlike /foods/new's barcode param, no string/number coercion is
 * needed (see that route's fix commit).
 */
export function validateNutritionSearch(
  search: Record<string, unknown>,
): NutritionSearch {
  return { date: typeof search.date === 'string' ? search.date : undefined }
}

export interface NutritionPageProps {
  /** The day on show, as YYYY-MM-DD. Undefined means today. */
  date?: string
  onDateChange: (date: string) => void
}

/**
 * The Nutrition day view, whole.
 *
 * A food diary is Personal (ADR-0003): it belongs to the person, not to the
 * Current Group, so it looks the same whichever Group it was opened from.
 */
export function NutritionPage({
  date: dateParam,
  onDateChange,
}: NutritionPageProps) {
  const date = dateParam || localIsoDate()

  const me = useQuery(api.users.me)
  const entries = useQuery(api.consumption.listForDay, { date })
  const updateEntry = useMutation(api.consumption.update)
  const deleteEntry = useMutation(api.consumption.remove)
  const saveCombo = useMutation(api.combos.saveFromMeal)

  const messages = useMessages()
  const { diary, meals } = messages.nutrition
  const { libraries } = diary

  // Every nutrient summed from the stored figures, except calories, which are
  // rounded per entry first so the day is exactly the meals added up and each
  // meal is exactly its rows (`sumKcal`). Costs at most a kcal against the
  // stored total; buys the only arithmetic a reader can actually check.
  const facts = (entries ?? []).map((e) => e.nutrition)
  const totals = { ...sumFacts(facts), calories: sumKcal(facts) }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">
        {messages.modules.byId.nutrition.label}
      </h1>
      <p className="mb-4 text-sm text-[var(--app-muted)]">
        {diary.personalNote}
      </p>

      {/* The two libraries the diary draws on (#100). They sit above the day
          rather than in the shell because neither is a Module — Foods is
          Catalog and a Combo is Personal — so nothing in the sidebar or the
          dock claims a row for them, and a phone reaches them the same way a
          desktop does. */}
      <nav aria-label={libraries.heading} className="mb-4 flex flex-wrap gap-2">
        <Link
          {...linkTo('foods')}
          className="inline-flex min-h-11 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm no-underline"
        >
          {libraries.foods}
        </Link>
        <Link
          {...linkTo('combos')}
          className="inline-flex min-h-11 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm no-underline"
        >
          {libraries.combos}
        </Link>
      </nav>

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, -1))}
          className="rounded border px-2 py-1 text-sm"
        >
          {diary.prevDay}
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded border border-[var(--app-border)] px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, 1))}
          className="rounded border px-2 py-1 text-sm"
        >
          {diary.nextDay}
        </button>
      </div>

      <DayTotals
        totals={totals}
        targets={me?.nutritionTargets}
        heading={
          date === localIsoDate()
            ? diary.totalsToday
            : fmt(diary.totalsOn, { date })
        }
      />

      {MEAL_NAMES.map((meal) => (
        <MealSlot
          // The day is part of which slot this is, not just what it shows.
          // A slot holds the ticks for a Combo being saved (#99), and those
          // name rows of *this* day; keyed by meal alone, stepping to
          // yesterday would keep them, leaving a form open over rows it does
          // not describe and a Save that submits an empty selection.
          key={`${date}-${meal}`}
          label={meals[meal]}
          entries={(entries ?? []).filter((e) => e.meal === meal)}
          addLink={addFoodLink(date, meal)}
          // One call, because it is one transaction: the Combo, the entries it
          // takes the place of and the expansion that replaces them either all
          // happen or none of them do (#99).
          onSaveAsCombo={async (name, entryIds) => {
            await saveCombo({
              date,
              meal,
              name,
              entryIds: entryIds as Id<'consumptionEntries'>[],
            })
          }}
          onUpdateEntry={async (entryId, changes) => {
            await updateEntry({
              id: entryId as Id<'consumptionEntries'>,
              ...changes,
            })
          }}
          onDeleteEntry={(entryId) =>
            deleteEntry({ id: entryId as Id<'consumptionEntries'> })
          }
        />
      ))}
    </div>
  )
}
