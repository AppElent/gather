import { useState } from 'react'
import { useMessages } from '../../lib/i18n'
import { IconPickerSheet } from './IconPickerSheet'

/**
 * The emoji a food or a one-off may wear, curated (#94, #75).
 *
 * Forty, not every emoji there is. A full picker is a large component or a
 * dependency, with a search box in front of thousands of glyphs that are not
 * food — and the thing being answered here is "which of the handful of shapes
 * food comes in is this one?", which a grid answers faster than a search does.
 * Widening it later costs nothing: what is stored is a string either way, so a
 * value that is no longer in this list still renders.
 *
 * Chosen to cover, in this order: what a kitchen is made of (grains, fruit,
 * vegetables, pulses, protein, dairy), then what a meal looks like when it is
 * not an ingredient — which is the one-off case, a restaurant plate with no
 * food behind it — then drinks and the sweet things people log most. Every
 * Catalog fixture's icon comes from this list, so a built-in food never wears
 * something nobody could have picked.
 *
 * The emoji themselves are **content, not display strings**: they are stored
 * on the row and never translated (ADR-0011), exactly like a serving's label.
 * Only the words around the grid live in the message tree.
 */
export const FOOD_ICONS = [
  // Grains and bread
  '🍞',
  '🥐',
  '🌾',
  '🍚',
  '🍝',
  // Fruit
  '🍎',
  '🍌',
  '🍊',
  '🍓',
  '🍇',
  // Vegetables
  '🥔',
  '🥕',
  '🍅',
  '🥦',
  '🥬',
  // Pulses, aromatics and nuts
  '🧅',
  '🧄',
  '🫑',
  '🫘',
  '🥜',
  // Protein
  '🥚',
  '🍗',
  '🥩',
  '🐟',
  '🍤',
  // Dairy and fats
  '🥛',
  '🧀',
  '🧈',
  '🫒',
  // A plate rather than an ingredient — what a one-off usually is
  '🥣',
  '🥗',
  '🥪',
  '🍕',
  '🍲',
  // Drinks and sweet things
  '💧',
  '☕',
  '🍵',
  '🍷',
  '🍫',
  '🍬',
]

interface Props {
  /** The chosen emoji, or nothing. Never an empty string. */
  value?: string
  /**
   * `undefined` when it is cleared — never `''`. A set-but-empty icon would
   * sit in front of the generic glyph in the tile's fallback chain and render
   * a blank square, so "no icon" has to be the absence of one.
   */
  onChange: (icon: string | undefined) => void
  disabled?: boolean
}

/**
 * Pick one, or none.
 *
 * A grid of full-size targets rather than a dropdown or a text field: a person
 * logging lunch is holding a phone in one hand, and every cell here is a
 * 44px tap target reachable without aiming. Pressing the chosen one again
 * clears it, and the ✕ that appears alongside says so for anybody who would
 * not think to try — an always-present clear over an empty grid would be a
 * control that does nothing, which is the same rule the search field follows.
 */
export function IconPicker({ value, onChange, disabled }: Props) {
  const { icon } = useMessages().common
  const [open, setOpen] = useState(false)

  return (
    <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <legend className="px-1 text-sm font-medium">{icon.label}</legend>
      <p className="mb-2 text-xs opacity-60">{icon.hint}</p>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={value === undefined ? icon.choose : icon.change}
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] text-xl"
      >
        {value ?? '🍽️'}
      </button>
      <IconPickerSheet
        open={open}
        icons={FOOD_ICONS}
        value={value}
        disabled={disabled}
        onChoose={(candidate) => {
          onChange(candidate === value ? undefined : candidate)
          setOpen(false)
        }}
        onClear={() => onChange(undefined)}
        onClose={() => setOpen(false)}
      />
    </fieldset>
  )
}
