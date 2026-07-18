import { useEffect, useState } from 'react'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { NutrientInputGrid } from './NutrientInputGrid'
import { nutrientInputsToFacts, toNutrientInputs } from './nutrientInputs'

interface Props {
  targets?: NutritionFacts
  saving: boolean
  onSave: (targets: NutritionFacts) => void
}

export function TargetsPanel({ targets, saving, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [inputs, setInputs] = useState(() => toNutrientInputs(targets))

  // `targets` starts undefined while the caller's `users.me` query is still
  // loading and resolves moments later — a lazy useState initializer alone
  // only seeds the form once at mount, so it would keep showing blank
  // fields even after real targets arrive. Convex's useQuery returns
  // referentially stable results when the value hasn't changed, so this
  // effect only re-fires on a genuine value change (initial load, or after
  // this panel's own save round-trips through the reactive subscription).
  useEffect(() => {
    setInputs(toNutrientInputs(targets))
  }, [targets])

  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium"
      >
        Daily targets
        <span className="opacity-60">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <NutrientInputGrid
            values={inputs}
            onChange={(key, value) =>
              setInputs((prev) => ({ ...prev, [key]: value }))
            }
          />
          <button
            type="button"
            disabled={saving}
            className="mt-3 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 py-1.5 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onSave(nutrientInputsToFacts(inputs))}
          >
            {saving ? 'Saving…' : 'Save targets'}
          </button>
        </div>
      )}
    </section>
  )
}
