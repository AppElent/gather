import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import type { AppLink } from '../../lib/appLink'
import { fmt, useMessages } from '../../lib/i18n'
import type { ConsumptionEntryData } from './ConsumptionEntryRow'
import { ConsumptionEntryRow } from './ConsumptionEntryRow'
import { sumKcal } from './kcal'
import type { NutritionNav } from './nutritionNav'
import { SaveAsCombo } from './SaveAsCombo'

interface Props {
  label: string
  entries: ConsumptionEntryData[]
  nav: NutritionNav
  /** Where adding to this meal happens — an address now, not a dialog. */
  addLink: AppLink
  /**
   * Keeping some of this meal as a Combo, which also replaces those entries
   * with it (#99). Absent where saving one makes no sense.
   */
  onSaveAsCombo?: (name: string, entryIds: string[]) => Promise<void>
  onUpdateEntry: (
    id: string,
    changes: {
      quantity: number
      meal: MealName
      date: string
      /**
       * Present only when the edit moved the entry off the unit it was
       * counting in — a 'piece' entry re-chosen from the picker (#102).
       */
      quantityUnit?: ConsumptionEntryData['quantityUnit']
    },
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
  // Which rows are going into the Combo being saved. The meal owns this rather
  // than the form below it, because the checkboxes live on the rows.
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)

  // Exactly the rows below, added up the way the day's total is: each entry
  // rounded, then summed, so this figure is the sum of the figures underneath
  // it and the day's is the sum of these. A meal whose entries carry no
  // calories gets undefined rather than a fabricated zero.
  const subtotal = sumKcal(entries.map((entry) => entry.nutrition))

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
              selection={
                selectedIds
                  ? {
                      selected: selectedIds.includes(entry._id),
                      onChange: (selected) =>
                        setSelectedIds((current) =>
                          selected
                            ? [...(current ?? []), entry._id]
                            : (current ?? []).filter((id) => id !== entry._id),
                        ),
                    }
                  : undefined
              }
              onUpdate={(changes) => onUpdateEntry(entry._id, changes)}
              onDelete={() => onDeleteEntry(entry._id)}
            />
          ))}
        </ul>
      )}
      {/* Only on a slot with something in it: a Combo is made by saving
          entries you have already logged, never by opening a builder. */}
      {entries.length > 0 && onSaveAsCombo && (
        <div className="mt-2 border-t border-[var(--app-border)] pt-2">
          <SaveAsCombo
            selectedCount={selectedIds?.length ?? 0}
            onSelectingChange={(selecting) =>
              // Everything starts ticked: saving the whole meal is the common
              // case, and unticking one is a smaller ask than ticking four.
              setSelectedIds(
                selecting ? entries.map((entry) => entry._id) : null,
              )
            }
            onSave={(name) =>
              onSaveAsCombo(
                name,
                entries
                  .filter((entry) => selectedIds?.includes(entry._id))
                  .map((entry) => entry._id),
              )
            }
          />
        </div>
      )}
    </section>
  )
}
