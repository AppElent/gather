import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutrientKey,
} from '../../../convex/lib/nutrition'
import { inputClass } from './nutrientInputs'

interface Props {
  values: Record<NutrientKey, string>
  onChange: (key: NutrientKey, value: string) => void
  disabled?: boolean
}

export function NutrientInputGrid({ values, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {NUTRIENT_KEYS.map((key) => (
        <label key={key} className="block text-sm">
          <span className="mb-1 block font-medium">{NUTRIENT_LABELS[key]}</span>
          <input
            inputMode="decimal"
            className={inputClass}
            value={values[key]}
            onChange={(e) => onChange(key, e.target.value)}
            disabled={disabled}
          />
        </label>
      ))}
    </div>
  )
}
