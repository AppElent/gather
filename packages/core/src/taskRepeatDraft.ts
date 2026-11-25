/**
 * What the Repeat sheet edits (APP-303): a draft of every choice it offers,
 * read from the task's rule and turned back into one. Kept apart from the
 * sheet so it can be tested without a React Native tree.
 */
import { isoWeekday } from './civilDate'
import type { Task } from './taskModel'
import {
  type AFTER_DONE_UNITS,
  normalizeRepeat,
  type RepeatUnit,
  type TaskRepeat,
} from './taskRepeat'

type Mode = 'none' | TaskRepeat['mode']

export interface Draft {
  mode: Mode
  fixed: {
    unit: RepeatUnit
    every: number
    weekdays: number[]
    /**
     * The day (and month) of the task's own monthly or yearly rule. After a
     * clamp the due date is the 30th of a rule on the 31st, so taking the day
     * from the due date would quietly move the rule.
     */
    kept?: Pick<TaskRepeat, 'unit' | 'monthDay' | 'month'>
  }
  afterDone: { unit: (typeof AFTER_DONE_UNITS)[number]; every: number }
}

/** What the sheet opens on: the task's rule, and sensible values for the rest. */
export function repeatDraft(task: Pick<Task, 'repeat' | 'dueDate'>, today: string): Draft {
  const rule = task.repeat
  const anchor = task.dueDate ?? today
  return {
    mode: rule?.mode ?? 'none',
    fixed:
      rule?.mode === 'fixed'
        ? {
            unit: rule.unit,
            every: rule.every,
            weekdays: rule.weekdays ?? [isoWeekday(anchor)],
            ...(rule.unit === 'month' || rule.unit === 'year'
              ? {
                  kept: {
                    unit: rule.unit,
                    monthDay: rule.monthDay,
                    month: rule.month,
                  },
                }
              : {}),
          }
        : { unit: 'week', every: 1, weekdays: [isoWeekday(anchor)] },
    afterDone:
      rule?.mode === 'afterDone' && rule.unit !== 'year'
        ? { unit: rule.unit, every: rule.every }
        : { unit: 'day', every: 3 },
  }
}

/** The rule a draft stands for, anchored on `anchor`; null for Never or an invalid one. */
export function draftRule(draft: Draft, anchor: string): TaskRepeat | null {
  if (draft.mode === 'none') return null
  // The rule's own day holds while its unit does; a new unit starts from the
  // due date.
  const kept =
    draft.fixed.kept?.unit === draft.fixed.unit ? draft.fixed.kept : undefined
  const rule: TaskRepeat =
    draft.mode === 'fixed'
      ? {
          mode: 'fixed',
          unit: draft.fixed.unit,
          every: draft.fixed.every,
          ...(draft.fixed.unit === 'week'
            ? { weekdays: draft.fixed.weekdays }
            : {}),
          ...(kept?.monthDay !== undefined ? { monthDay: kept.monthDay } : {}),
          ...(kept?.unit === 'year' && kept.month !== undefined
            ? { month: kept.month }
            : {}),
        }
      : { mode: 'afterDone', ...draft.afterDone }
  return normalizeRepeat(rule, anchor)
}
