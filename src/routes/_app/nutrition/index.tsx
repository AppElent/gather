import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  MEAL_LABELS,
  MEAL_NAMES,
  type MealName,
  sumFacts,
} from '../../../../convex/lib/consumption'
import { AddEntryModal } from '../../../components/nutrition/AddEntryModal'
import { DayTotals } from '../../../components/nutrition/DayTotals'
import { MealSlot } from '../../../components/nutrition/MealSlot'
import { TargetsPanel } from '../../../components/nutrition/TargetsPanel'

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

export const Route = createFileRoute('/_app/nutrition/')({
  component: NutritionDay,
  // A YYYY-MM-DD date string is never valid JSON as a number (the dashes
  // make JSON.parse throw), so the router's default search codec falls back
  // to the raw string here — unlike /foods/new's barcode param, no
  // string/number coercion is needed (see that route's fix commit).
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' ? search.date : undefined,
  }),
})

function NutritionDay() {
  const { date: dateParam } = Route.useSearch()
  const navigate = Route.useNavigate()
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
      <h1 className="mb-4 text-2xl font-semibold">Nutrition</h1>

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate({ search: { date: shiftDate(date, -1) } })}
          className="rounded border px-2 py-1 text-sm"
        >
          ← Prev
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => navigate({ search: { date: e.target.value } })}
          className="rounded border border-[var(--app-border)] px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => navigate({ search: { date: shiftDate(date, 1) } })}
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
