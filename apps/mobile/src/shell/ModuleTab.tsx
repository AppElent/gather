/**
 * The three tabs that are a Module and nothing else yet.
 *
 * Recipes, Tasks and Nutrition are nailed to the bar because five slots are
 * fixed for everybody (`SHELL_TABS`), which is a decision about navigation and
 * not a claim about what is built. Each of them is a leaf: there is nothing to
 * push into yet, so there is no stack, and therefore nothing for a Group switch
 * to reset — the two tabs that do have one key it with the active Group.
 *
 * One component keeps the three fixed tabs on the exact same placeholder as a
 * Module opened from Home or All.
 */
import { type ModuleId, moduleById } from '@gather/core/modules'

import { ModulePlaceholder } from '../components/ModulePlaceholder'

export interface ModuleTabProps {
  tab: Extract<ModuleId, 'recipes' | 'tasks' | 'nutrition'>
}

export function ModuleTab({ tab }: ModuleTabProps) {
  const module = moduleById(tab)
  if (!module) throw new Error(`Unknown fixed Module tab: ${tab}`)

  return <ModulePlaceholder module={module} />
}
