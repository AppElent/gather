import type { LucideIcon } from 'lucide-react'
import { GalleryVerticalEnd, LayoutGrid, Rows3 } from 'lucide-react'
import { useMessages } from '../../lib/i18n'
import type { RecipeViewMode } from './RecipeCard'

/** Which layouts there are and which glyph each wears — not a translator's call. */
const OPTIONS: Array<{ mode: RecipeViewMode; icon: LucideIcon }> = [
  { mode: 'grid', icon: LayoutGrid },
  { mode: 'banner', icon: GalleryVerticalEnd },
  { mode: 'compact', icon: Rows3 },
]

interface ViewModeToggleProps {
  mode: RecipeViewMode
  onChange: (mode: RecipeViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  const viewMode = useMessages().recipes.viewMode

  return (
    <div
      role="radiogroup"
      aria-label={viewMode.label}
      className="flex gap-1 rounded-lg border p-1"
    >
      {OPTIONS.map(({ mode: optionMode, icon: Icon }) => (
        // biome-ignore lint/a11y/useSemanticElements: custom radio-group widget (WAI-ARIA radio pattern) needs a clickable button, not a native input, to render the icon
        <button
          key={optionMode}
          type="button"
          role="radio"
          aria-checked={mode === optionMode}
          aria-label={viewMode[optionMode]}
          onClick={() => onChange(optionMode)}
          className={`rounded-md p-1.5 ${mode === optionMode ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
