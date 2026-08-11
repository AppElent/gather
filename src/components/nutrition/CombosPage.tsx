import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { comboEntries } from '../../../convex/lib/combos'
import { sumFacts } from '../../../convex/lib/consumption'
import { fmt, plural, useI18n } from '../../lib/i18n'
import type { NutritionNav } from './nutritionNav'

/**
 * The Combos library: what you have saved, in one place (#100).
 *
 * A Combo is Personal (ADR-0012), so `combos.list` resolves the caller and
 * returns their own rows — there is no Group argument to pass, and the page
 * therefore reads the same from every Group even though its address names one.
 *
 * Browsing only. Logging a Combo is something that happens *into a meal*, which
 * this page has no day and no slot for, and there is deliberately no builder
 * here: a Combo is made by saving a meal slot you have already filled in, which
 * is what the empty state explains instead of offering a button that would have
 * to invent one.
 */
export function CombosPage({ nav }: { nav: NutritionNav }) {
  const { locale, messages } = useI18n()
  const library = messages.nutrition.combosLibrary
  const { combos: comboWords, personalNote } = messages.nutrition.diary
  const combos = useQuery(api.combos.list, {})

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{library.title}</h1>
      <p className="mb-4 text-sm text-[var(--app-muted)]">{personalNote}</p>

      <Link
        {...nav.diary}
        className="mb-6 inline-flex min-h-11 items-center text-sm underline"
      >
        {library.back}
      </Link>

      {combos === undefined && (
        <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
      )}

      {combos?.length === 0 && (
        <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-4">
          <p className="mb-1 font-medium">{library.empty}</p>
          <p className="text-sm opacity-70">{library.emptyHow}</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3">
        {combos?.map((combo) => {
          const totals = sumFacts(
            comboEntries(combo.components).map((entry) => entry.nutrition),
          )
          return (
            <li
              key={combo._id}
              className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 truncate font-medium">{combo.name}</h2>
                {totals.calories !== undefined && (
                  <span className="shrink-0 text-sm opacity-60">
                    {fmt(comboWords.kcal, {
                      calories: Math.round(totals.calories),
                    })}
                  </span>
                )}
              </div>
              <p className="mb-2 text-xs opacity-60">
                {fmt(
                  plural(locale, combo.components.length, comboWords.itemCount),
                  { count: combo.components.length },
                )}
              </p>
              <ul className="grid gap-1">
                {combo.components.map((component) => (
                  <li
                    key={component.id}
                    className={`flex items-baseline justify-between gap-3 text-sm ${
                      component.available ? '' : 'opacity-50'
                    }`}
                  >
                    <span className="min-w-0 truncate">{component.label}</span>
                    <span className="shrink-0 text-xs opacity-60">
                      {component.available
                        ? fmt(comboWords.amount, {
                            quantity: component.quantity,
                            unit: messages.nutrition.units[
                              component.quantityUnit
                            ],
                          })
                        : comboWords.unavailable}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
