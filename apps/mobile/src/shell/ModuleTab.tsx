/**
 * The three tabs that are a Module and nothing else yet.
 *
 * Recipes, Tasks and Nutrition are nailed to the bar because five slots are
 * fixed for everybody (`SHELL_TABS`), which is a decision about navigation and
 * not a claim about what is built. Each of them is a leaf: there is nothing to
 * push into yet, so there is no stack, and therefore nothing for a Group switch
 * to reset — the two tabs that do have one key it with the active Group.
 *
 * One component for all three so the honest sentence is written once. #163
 * replaces it with the tinted placeholder.
 */
import { ShellStub } from '../components/ShellStub'
import { fmt, useI18n } from '../i18n'

export interface ModuleTabProps {
  tab: 'recipes' | 'tasks' | 'nutrition'
}

export function ModuleTab({ tab }: ModuleTabProps) {
  const { t } = useI18n()
  const name = t.shell.tabs[tab]

  return (
    <ShellStub title={name} body={fmt(t.shell.stub.module, { module: name })} />
  )
}
