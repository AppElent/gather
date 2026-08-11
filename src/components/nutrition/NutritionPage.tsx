import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { MEAL_NAMES, sumFacts } from '../../../convex/lib/consumption'
import { fmt, useMessages } from '../../lib/i18n'
import { moduleById } from '../../lib/modules'
import { DayTotals } from './DayTotals'
import { sumKcal } from './kcal'
import { MealSlot } from './MealSlot'
import type { NutritionNav } from './nutritionNav'

// Client-local YYYY-MM-DD — matches spec §3.4 ("no server timezone math").
// Exported because the add route has to read "today" the same way the diary
// does, or a sheet opened with no date in the URL would write to another day.
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  /** Where the diary's provenance links go - see `nutritionNav.ts`. */
  nav: NutritionNav
}

/**
 * The Nutrition day view, whole.
 *
 * A food diary is Personal (ADR-0003): it belongs to the person, not to the
 * Group in the URL, so it looks the same whichever Group it was opened from.
 * The route passes in only the date and the links, which is what keeps that
 * true — there is nothing else about it for a Group to change.
 *
 * There is one address, `/g/<slug>/nutrition`. An earlier version of this
 * comment claimed a flat `/nutrition` route as well; ADR-0002 removed the flat
 * tree, and `src/lib/legacyPaths.ts` is what answers for links to it now.
 */
export function NutritionPage({
  date: dateParam,
  onDateChange,
  nav,
}: NutritionPageProps) {
  const date = dateParam || todayLocal()

  const me = useQuery(api.users.me)
  const entries = useQuery(api.consumption.listForDay, { date })
  const updateEntry = useMutation(api.consumption.update)
  const deleteEntry = useMutation(api.consumption.remove)
  const saveCombo = useMutation(api.combos.saveFromMeal)

  const messages = useMessages()
  const { diary, meals } = messages.nutrition

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
      {moduleById('nutrition')?.scope === 'personal' && (
        <p className="mb-4 text-sm text-[var(--app-muted)]">
          {diary.personalNote}
        </p>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onDateChange(shiftDate(date, -1))}
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
          onClick={() => onDateChange(shiftDate(date, 1))}
          className="rounded border px-2 py-1 text-sm"
        >
          {diary.nextDay}
        </button>
      </div>

      <DayTotals
        totals={totals}
        targets={me?.nutritionTargets}
        heading={
          date === todayLocal()
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
          nav={nav}
          addLink={nav.addEntry(date, meal)}
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
