import { Link } from '@tanstack/react-router'
import type { MealName } from '../../../convex/lib/consumption'
import { sumFacts } from '../../../convex/lib/consumption'
import type { AppLink } from '../../lib/appLink'
import { fmt, useMessages } from '../../lib/i18n'
import type { ConsumptionEntryData } from './ConsumptionEntryRow'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'
import type { NutritionNav } from './nutritionNav'
import { SaveAsCombo } from './SaveAsCombo'

interface Props {
  label: string
  entries: ConsumptionEntryData[]
  nav: NutritionNav
  /** Where adding to this meal happens — an address now, not a dialog. */
  addLink: AppLink
  /** Keeping this meal as a Combo. Absent where saving one makes no sense. */
  onSaveAsCombo?: (name: string) => Promise<void>
  onUpdateEntry: (
    id: string,
    changes: { quantity: number; meal: MealName; date: string },
  ) => Promise<void>
  onDeleteEntry: (id: string) => void
}

export function MealSlot({
  label,
  entries,
  nav,
  addLink,
  onSaveAsCombo,
  onUpdateEntry,
  onDeleteEntry,
}: Props) {
  const { slot } = useMessages().nutrition.diary

  // The same summation the day's totals use, over the entries this slot is
  // already rendering — so a meal's kcal and the day's kcal cannot drift, and
  // a meal whose entries carry no calories has no `calories` key at all rather
  // than a fabricated zero.
  const subtotal = sumFacts(entries.map((entry) => entry.nutrition)).calories

  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">
          {label}
          {subtotal !== undefined && (
            <span className="ml-2 text-sm font-normal opacity-60">
              {fmt(slot.subtotal, { calories: subtotal })}
            </span>
          )}
        </h2>
        <Link
          {...addLink}
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          {slot.add}
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm opacity-60">{slot.empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--app-border)]">
          {entries.map((entry) => (
            <ConsumptionEntryRow
              key={entry._id}
              entry={entry}
              nav={nav}
              onUpdate={(changes) => onUpdateEntry(entry._id, changes)}
              onDelete={() => onDeleteEntry(entry._id)}
            />
          ))}
        </ul>
      )}
      {/* Only on a slot with something in it: a Combo is made by saving a
          meal you have already filled in, never by opening a builder. */}
      {entries.length > 0 && onSaveAsCombo && (
        <div className="mt-2 border-t border-[var(--app-border)] pt-2">
          <SaveAsCombo onSave={onSaveAsCombo} />
        </div>
      )}
    </section>
  )
}
