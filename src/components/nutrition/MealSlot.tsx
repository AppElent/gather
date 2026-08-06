import { Link } from '@tanstack/react-router'
import type { MealName } from '../../../convex/lib/consumption'
import type { AppLink } from '../../lib/appLink'
import { useMessages } from '../../lib/i18n'
import type { ConsumptionEntryData } from './ConsumptionEntryRow'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'
import type { NutritionNav } from './nutritionNav'

interface Props {
  label: string
  entries: ConsumptionEntryData[]
  nav: NutritionNav
  /** Where adding to this meal happens — an address now, not a dialog. */
  addLink: AppLink
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
  onUpdateEntry,
  onDeleteEntry,
}: Props) {
  const { slot } = useMessages().nutrition.diary

  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{label}</h2>
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
    </section>
  )
}
