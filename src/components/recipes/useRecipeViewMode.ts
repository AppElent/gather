import { useEffect, useState } from 'react'
import type { RecipeViewMode } from './RecipeCard'

const STORAGE_KEY = 'gather.recipes.viewMode'
// The inset list is the approved look (APP-639); grid and banner stay a
// choice for whoever picked one.
const DEFAULT_MODE: RecipeViewMode = 'compact'

function readStoredMode(): RecipeViewMode {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'grid' || stored === 'banner' || stored === 'compact') {
    return stored
  }
  return DEFAULT_MODE
}

export function useRecipeViewMode(): [
  RecipeViewMode,
  (mode: RecipeViewMode) => void,
] {
  const [mode, setModeState] = useState<RecipeViewMode>(DEFAULT_MODE)

  // Read localStorage after mount (not during the initial render) so
  // server-rendered and first-client-render markup match; avoids a
  // hydration mismatch on this TanStack Start (SSR) app.
  useEffect(() => {
    setModeState(readStoredMode())
  }, [])

  const setMode = (next: RecipeViewMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return [mode, setMode]
}
