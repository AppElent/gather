import { createFileRoute } from '@tanstack/react-router'
import { CombosPage } from '../../components/nutrition/CombosPage'

/**
 * The Combos library. A sibling of `/nutrition` rather than a page beneath it:
 * that route is a layout rendering the diary itself, so the add sheet can sit
 * over a page that never went away, and a library nested under it would open
 * below the whole day.
 */
export const Route = createFileRoute('/_app/combos')({
  component: CombosPage,
})
