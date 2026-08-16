/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * What Add offers. Stub data, deliberately: #172 says the launcher shows only
 * Module-owned actions that actually work, so this list is drawn from the three
 * live Modules and nothing else. Nothing here writes.
 *
 * ## `kind` is the decision this round settled
 *
 * "Does Add navigate?" has no single answer, because these five actions are not
 * the same kind of thing. So the answer is not a mode of the shell — **each
 * Module declares the kind its action is**, and the launcher obeys:
 *
 * - **`row`** — the whole record is one field, and you often add several in a
 *   row. A task is its title. The field opens inside the row you tapped, the
 *   other actions stay on screen, and saving leaves the launcher open.
 * - **`sheet`** — two or three fields, or an outcome worth showing. An import
 *   needs a link and then has something to report about what it found. The
 *   sheet's body gives it room without becoming a screen.
 * - **`handoff`** — cannot be finished here at all. A barcode needs a camera;
 *   writing a recipe is a long-form job with its own editor. These push the
 *   Module's real create surface, and the launcher gets out of the way.
 *
 * The shell must not decide this. If it did, every action would be dragged to
 * the slowest one's behaviour and Add would stop being a quick add — which is
 * the whole thing the launcher exists for.
 *
 * Note that only Tasks earns `row` among the Modules that are live today. That
 * is not an argument against the kind: a shopping-list item and a note are both
 * one field, and both are coming.
 */
import type { ModuleGroup, ModuleIconName } from '@gather/core/modules'

/** How far a quick action can get before it has to leave the launcher. */
export type QuickActionKind = 'row' | 'sheet' | 'handoff'

export interface QuickAction {
  id: string
  /** English literal on purpose: prototype copy never enters the message tree. */
  label: string
  module: string
  group: ModuleGroup
  icon: ModuleIconName
  /** Declared by the owning Module, not by the shell. */
  kind: QuickActionKind
  /**
   * Placeholders for what the capture collects. One entry for a `row`, two or
   * three for a `sheet`, none for a `handoff`.
   */
  fields?: readonly string[]
  /** What a saved capture is called, for the confirmation line. */
  noun?: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'task-new',
    label: 'Add a task',
    module: 'Tasks',
    group: 'home',
    icon: 'ListChecks',
    kind: 'row',
    fields: ['What needs doing?'],
    noun: 'task',
  },
  {
    id: 'recipe-import',
    label: 'Import from a link',
    module: 'Recipes',
    group: 'kitchen',
    icon: 'ChefHat',
    kind: 'sheet',
    fields: ['Paste a recipe link'],
    noun: 'import',
  },
  {
    id: 'meal-log',
    label: 'Log a meal',
    module: 'Nutrition',
    group: 'kitchen',
    icon: 'Apple',
    kind: 'sheet',
    fields: ['Food', 'How much?'],
    noun: 'meal',
  },
  {
    id: 'recipe-new',
    label: 'Write a recipe',
    module: 'Recipes',
    group: 'kitchen',
    icon: 'ChefHat',
    kind: 'handoff',
  },
  {
    id: 'food-scan',
    label: 'Scan a barcode',
    module: 'Nutrition',
    group: 'kitchen',
    icon: 'Apple',
    kind: 'handoff',
  },
]

/** Shown on each row so the mix of kinds is legible without tapping. */
export const KIND_LABELS: Record<QuickActionKind, string> = {
  row: 'in the row',
  sheet: 'in the sheet',
  handoff: 'opens a form',
}
