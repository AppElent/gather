import { plural, useI18n } from '../../lib/i18n'

const STAR_VALUES = [1, 2, 3, 4, 5]

interface StarRatingProps {
  value?: number
  onChange: (value: number | undefined) => void
}

export function StarRating({ value, onChange }: StarRatingProps) {
  const { locale, messages } = useI18n()
  const rating = messages.recipes.rating

  return (
    <div role="radiogroup" aria-label={rating.label} className="flex gap-1">
      {STAR_VALUES.map((star) => (
        // biome-ignore lint/a11y/useSemanticElements: custom radio-group widget (WAI-ARIA radio pattern) needs a clickable button, not a native input, to render the star glyph
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={plural(locale, star, rating.stars)}
          className="text-2xl leading-none"
          onClick={() => onChange(value === star ? undefined : star)}
        >
          <span
            aria-hidden="true"
            className={
              value != null && star <= value ? 'opacity-100' : 'opacity-30'
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  )
}
