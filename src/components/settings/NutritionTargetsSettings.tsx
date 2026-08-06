import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { errorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'
import { NutrientInputGrid } from '../nutrition/NutrientInputGrid'
import {
  nutrientInputsToFacts,
  toNutrientInputs,
} from '../nutrition/nutrientInputs'

/**
 * The anchor the diary's "edit targets" link lands on.
 *
 * Exported rather than written twice: the link and the thing it scrolls to are
 * a pair, and a hash that matches nothing fails silently.
 */
export const NUTRITION_TARGETS_ANCHOR = 'nutrition-targets'

interface FormProps {
  targets?: NutritionFacts
  saving: boolean
  error?: string | null
  onSave: (targets: NutritionFacts) => void
}

/**
 * The eight targets, as a form. Presentational: it knows nothing about Convex,
 * which is what keeps it renderable in a test with no backend.
 */
export function NutritionTargetsForm({
  targets,
  saving,
  error,
  onSave,
}: FormProps) {
  const messages = useMessages()
  const { nutritionTargets } = messages.settings
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
    <SurfaceCard>
      <h2
        id={NUTRITION_TARGETS_ANCHOR}
        className="m-0 mb-1 scroll-mt-20 text-base font-semibold"
      >
        {nutritionTargets.title}
      </h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        {nutritionTargets.description}
      </p>
      <NutrientInputGrid
        values={inputs}
        onChange={(key, value) =>
          setInputs((prev) => ({ ...prev, [key]: value }))
        }
        disabled={saving}
      />
      {error && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={saving}
        className="mt-3 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 py-1.5 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => onSave(nutrientInputsToFacts(inputs))}
      >
        {saving ? messages.common.actions.saving : nutritionTargets.save}
      </button>
    </SurfaceCard>
  )
}

/**
 * Your daily nutrition targets, where the rest of your personal preferences
 * are.
 *
 * They are Personal (ADR-0003) — they belong to you and read the same in every
 * Group — which is why they sit on `/settings` and not on a Group's. They used
 * to be an editing form permanently expanded above the food diary, so the page
 * you opened to see today's food opened on a form instead. The diary now shows
 * the target as context on the day's totals and links here.
 */
export function NutritionTargetsSettings() {
  const me = useQuery(api.users.me)
  const setTargets = useMutation(api.users.setNutritionTargets)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { nutritionTargets } = useMessages().settings

  return (
    <NutritionTargetsForm
      targets={me?.nutritionTargets}
      saving={saving}
      error={error}
      onSave={async (targets) => {
        setSaving(true)
        setError(null)
        try {
          await setTargets({ targets })
        } catch (err) {
          setError(errorMessage(err, nutritionTargets.saveFailed))
        } finally {
          setSaving(false)
        }
      }}
    />
  )
}
