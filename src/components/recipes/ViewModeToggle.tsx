import type { LucideIcon } from 'lucide-react'
import { GalleryVerticalEnd, LayoutGrid, Rows3 } from 'lucide-react'
import type { RecipeViewMode } from './RecipeCard'

const OPTIONS: Array<{
  mode: RecipeViewMode
  label: string
  icon: LucideIcon
}> = [
  { mode: 'grid', label: 'Grid view', icon: LayoutGrid },
  { mode: 'banner', label: 'Banner view', icon: GalleryVerticalEnd },
  { mode: 'compact', label: 'Compact view', icon: Rows3 },
]

interface ViewModeToggleProps {
  mode: RecipeViewMode
  onChange: (mode: RecipeViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Recipe view"
      className="flex gap-1 rounded-lg border p-1"
    >
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
        // biome-ignore lint/a11y/useSemanticElements: custom radio-group widget (WAI-ARIA radio pattern) needs a clickable button, not a native input, to render the icon
        <button
          key={optionMode}
          type="button"
          role="radio"
          aria-checked={mode === optionMode}
          aria-label={label}
          onClick={() => onChange(optionMode)}
          className={`rounded-md p-1.5 ${mode === optionMode ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
