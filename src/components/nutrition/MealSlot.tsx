import type { MealName } from '../../../convex/lib/consumption'
import type { ConsumptionEntryData } from './ConsumptionEntryRow'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'

interface Props {
  label: string
  entries: ConsumptionEntryData[]
  onAdd: () => void
  onUpdateEntry: (
    id: string,
    changes: { quantity: number; meal: MealName; date: string },
  ) => void
  onDeleteEntry: (id: string) => void
}

export function MealSlot({
  label,
  entries,
  onAdd,
  onUpdateEntry,
  onDeleteEntry,
}: Props) {
  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{label}</h2>
        <button type="button" onClick={onAdd} className="text-sm underline">
          + Add
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm opacity-60">Nothing logged yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--app-border)]">
          {entries.map((entry) => (
            <ConsumptionEntryRow
              key={entry._id}
              entry={entry}
              onUpdate={(changes) => onUpdateEntry(entry._id, changes)}
              onDelete={() => onDeleteEntry(entry._id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
