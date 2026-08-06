import { useState } from 'react'
import type { ComboComponent, ComboCounts } from '../../../convex/lib/combos'
import { comboEntries, countOf, isModified } from '../../../convex/lib/combos'
import { sumFacts } from '../../../convex/lib/consumption'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { NutritionBreakdown } from './NutritionBreakdown'
import { ResultCard } from './ResultCard'

export interface ComboSummary {
  _id: string
  name: string
  components: ComboComponent[]
}

interface Props {
  combo: ComboSummary
  expanded: boolean
  onToggle: () => void
  busy: boolean
  error: string | null
  /** Given what today's logging looks like, write it. */
  onLog: (counts: ComboCounts, modified: boolean) => void
}

/**
 * A Combo, expanding into what is in it.
 *
 * It gets the same treatment as every other row rather than a one-tap
 * shortcut, because "I want to change something small" turned out to be the
 * routine case when the prototype was driven on a phone — an extra slice
 * today, no coffee this morning. Each component has a stepper counting *its
 * own* serving, and stepping to zero is how a component is dropped: a separate
 * remove control beside a stepper was both redundant and too small to hit.
 *
 * Nothing here writes to the Combo. Adjustments apply to today's entries only,
 * and Reset puts back what was saved without closing the sheet.
 */
export function ComboCard({
  combo,
  expanded,
  onToggle,
  busy,
  error,
  onLog,
}: Props) {
  const { locale, messages } = useI18n()
  const { combos } = messages.nutrition.diary
  const [counts, setCounts] = useState<ComboCounts>({})

  const entries = comboEntries(combo.components, counts)
  const totals = sumFacts(entries.map((entry) => entry.nutrition))
  const modified = isModified(combo.components, counts)
  const setCount = (id: string, next: number) =>
    setCounts((current) => ({ ...current, [id]: Math.max(0, next) }))

  return (
    <ResultCard
      title={combo.name}
      subtitle={fmt(plural(locale, combo.components.length, combos.itemCount), {
        count: combo.components.length,
      })}
      meta={
        totals.calories !== undefined
          ? fmt(combos.kcal, { calories: Math.round(totals.calories) })
          : undefined
      }
      expanded={expanded}
      onToggle={onToggle}
    >
      <ul className="grid gap-2">
        {combo.components.map((component) => {
          const count = countOf(counts, component.id)
          const dropped = count === 0 || !component.available
          return (
            <li
              key={component.id}
              className={`flex items-center justify-between gap-3 ${
                dropped ? 'opacity-50' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">
                  {component.label}
                </span>
                <span className="block text-xs opacity-60">
                  {component.available
                    ? fmt(combos.amount, {
                        quantity:
                          Math.round(component.quantity * count * 100) / 100,
                        unit: messages.nutrition.units[component.quantityUnit],
                      })
                    : combos.unavailable}
                </span>
              </span>
              {component.available && (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={fmt(combos.less, { label: component.label })}
                    onClick={() => setCount(component.id, count - 1)}
                    className="min-h-11 min-w-11 rounded-full border border-[var(--app-border)] text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">
                    {count}
                  </span>
                  <button
                    type="button"
                    aria-label={fmt(combos.more, { label: component.label })}
                    onClick={() => setCount(component.id, count + 1)}
                    className="min-h-11 min-w-11 rounded-full border border-[var(--app-border)] text-lg"
                  >
                    +
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3">
        <NutritionBreakdown facts={totals} />
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || entries.length === 0}
          onClick={() => onLog(counts, modified)}
          className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {messages.nutrition.diary.add.confirm}
        </button>
        {modified && (
          <button
            type="button"
            onClick={() => setCounts({})}
            className="min-h-11 text-sm underline"
          >
            {combos.reset}
          </button>
        )}
        {entries.length === 0 && (
          <span className="text-xs opacity-60">{combos.nothingLeft}</span>
        )}
      </div>
    </ResultCard>
  )
}
