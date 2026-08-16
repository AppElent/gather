/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The **second axis**, and it is no longer a design question. Each Module
 * declares the kind of its own quick action (`actions.ts`), so the launcher has
 * nothing to decide — this store only lets you *force* every action to one kind
 * so the same action can be tried both ways.
 *
 * That is the work still left: `kind` is now a per-action judgement, and this is
 * how you make it. Is "Import from a link" better as a row than a sheet? Force
 * `row`, try it, force `sheet`, try it, then write the answer into `actions.ts`.
 *
 * `declared` is the default and the only setting that shows the real design.
 * The other three are a measuring instrument and would not exist in the app.
 */
import { useSyncExternalStore } from 'react'

import type { QuickActionKind } from './actions'

export const OVERRIDES = ['declared', 'row', 'sheet', 'handoff'] as const
export type Override = (typeof OVERRIDES)[number]

export const OVERRIDE_NAMES: Record<Override, string> = {
  declared: 'as each Module declares',
  row: 'force every action into the row',
  sheet: 'force every action into the sheet',
  handoff: 'force every action to hand off',
}

let current: Override = 'declared'
const listeners = new Set<() => void>()

export function setOverride(next: Override) {
  current = next
  for (const listener of listeners) listener()
}

export function cycleOverride(step: 1 | -1) {
  const index = OVERRIDES.indexOf(current)
  setOverride(OVERRIDES[(index + step + OVERRIDES.length) % OVERRIDES.length])
}

export function useOverride(): Override {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => current,
    () => current,
  )
}

/** What the launcher should actually do for this action, right now. */
export function effectiveKind(
  declared: QuickActionKind,
  override: Override,
): QuickActionKind {
  return override === 'declared' ? declared : override
}
