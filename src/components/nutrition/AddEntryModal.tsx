import { useEffect, useState } from 'react'
import type { MealName } from '../../../convex/lib/consumption'
import { fmt, useMessages } from '../../lib/i18n'
import { FoodAddTab } from './FoodAddTab'
import type { NutritionNav } from './nutritionNav'
import { QuickAddTab } from './QuickAddTab'
import { RecipeAddTab } from './RecipeAddTab'

type Tab = 'recipes' | 'foods' | 'quick'

/** Which tabs there are and in what order — the words are in the message tree. */
const TABS = ['recipes', 'foods', 'quick'] as const satisfies readonly Tab[]

interface Props {
  date: string
  meal: MealName
  nav: NutritionNav
  onClose: () => void
}

export function AddEntryModal({ date, meal, nav, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('recipes')
  const { diary, meals } = useMessages().nutrition
  const { add } = diary

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
          <h2 className="text-sm font-semibold">
            {fmt(add.title, { meal: meals[meal] })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm opacity-60"
          >
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-2 border-b border-[var(--app-border)]">
          {TABS.map((id) => (
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
              {add.tabs[id]}
            </button>
          ))}
        </div>
        {tab === 'recipes' && (
          <RecipeAddTab date={date} meal={meal} nav={nav} onAdded={onClose} />
        )}
        {tab === 'foods' && (
          <FoodAddTab date={date} meal={meal} nav={nav} onAdded={onClose} />
        )}
        {tab === 'quick' && (
          <QuickAddTab date={date} meal={meal} onAdded={onClose} />
        )}
      </div>
    </div>
  )
}
