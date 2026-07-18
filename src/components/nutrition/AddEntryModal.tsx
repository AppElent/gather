import { useEffect, useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import { MEAL_LABELS } from '../../../convex/lib/consumption'
import { FoodAddTab } from './FoodAddTab'
import { QuickAddTab } from './QuickAddTab'
import { RecipeAddTab } from './RecipeAddTab'

type Tab = 'recipes' | 'foods' | 'quick'

const TABS: Array<[Tab, string]> = [
  ['recipes', 'Recipes'],
  ['foods', 'Foods'],
  ['quick', 'Quick add'],
]

interface Props {
  date: string
  meal: MealName
  onClose: () => void
}

export function AddEntryModal({ date, meal, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('recipes')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-[var(--app-surface)] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add to {MEAL_LABELS[meal]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm opacity-60"
          >
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-2 border-b border-[var(--app-border)]">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-2 py-1.5 text-sm ${
                tab === id
                  ? 'border-[var(--app-accent)] font-medium'
                  : 'border-transparent opacity-60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'recipes' && (
          <RecipeAddTab date={date} meal={meal} onAdded={onClose} />
        )}
        {tab === 'foods' && (
          <FoodAddTab date={date} meal={meal} onAdded={onClose} />
        )}
        {tab === 'quick' && (
          <QuickAddTab date={date} meal={meal} onAdded={onClose} />
        )}
      </div>
    </div>
  )
}
