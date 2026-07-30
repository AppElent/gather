import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  MEAL_LABELS,
  MEAL_NAMES,
  type MealName,
  sumFacts,
} from '../../../convex/lib/consumption'
import { moduleById } from '../../lib/modules'
import { AddEntryModal } from './AddEntryModal'
import { DayTotals } from './DayTotals'
import { MealSlot } from './MealSlot'
import { TargetsPanel } from './TargetsPanel'

// Client-local YYYY-MM-DD — matches spec §3.4 ("no server timezone math").
function todayLocal(): string {
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
}

/**
 * The Nutrition day view, whole.
 *
 * Both `/nutrition` and `/g/<slug>/nutrition` render this one component. A food
 * diary is Personal (ADR-0003): it belongs to the person, not to the Group in
 * the URL, so the two routes must show the same thing. Sharing the component is
 * what makes that true rather than merely intended — the routes differ only in
 * where the date lives, which is why that is the only thing they pass in.
 */
export function NutritionPage({
  date: dateParam,
  onDateChange,
}: NutritionPageProps) {
  const date = dateParam || todayLocal()

  const me = useQuery(api.users.me)
  const entries = useQuery(api.consumption.listForDay, { date })
  const updateEntry = useMutation(api.consumption.update)
  const deleteEntry = useMutation(api.consumption.remove)
  const setTargets = useMutation(api.users.setNutritionTargets)

  const [addingMeal, setAddingMeal] = useState<MealName | null>(null)
  const [savingTargets, setSavingTargets] = useState(false)
  const [targetsError, setTargetsError] = useState<string | null>(null)

  const totals = sumFacts((entries ?? []).map((e) => e.nutrition))

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Nutrition</h1>
      {moduleById('nutrition')?.scope === 'personal' && (
        <p className="mb-4 text-sm text-[var(--app-muted)]">
          Yours alone. Nobody else in the group can see it, and it looks the
          same whichever group you are in.
        </p>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onDateChange(shiftDate(date, -1))}
          className="rounded border px-2 py-1 text-sm"
        >
          ← Prev
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
          Next →
        </button>
      </div>

      {targetsError && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {targetsError}
        </p>
      )}
      <TargetsPanel
        targets={me?.nutritionTargets}
        saving={savingTargets}
        onSave={async (targets) => {
          setSavingTargets(true)
          setTargetsError(null)
          try {
            await setTargets({ targets })
          } catch (err) {
            setTargetsError(
              err instanceof Error ? err.message : 'Could not save targets',
            )
          } finally {
            setSavingTargets(false)
          }
        }}
      />

      <DayTotals
        totals={totals}
        targets={me?.nutritionTargets}
        heading={date === todayLocal() ? "Today's totals" : `Totals — ${date}`}
      />

      {MEAL_NAMES.map((meal) => (
        <MealSlot
          key={meal}
          label={MEAL_LABELS[meal]}
          entries={(entries ?? []).filter((e) => e.meal === meal)}
          onAdd={() => setAddingMeal(meal)}
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

      {addingMeal && (
        <AddEntryModal
          date={date}
          meal={addingMeal}
          onClose={() => setAddingMeal(null)}
        />
      )}
    </div>
  )
}
