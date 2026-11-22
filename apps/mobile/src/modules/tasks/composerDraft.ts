/**
 * What the keyboard composer holds for a new task (APP-587), and the task it
 * saves. Kept apart from the component so it can be tested without a React
 * Native tree.
 *
 * A detail comes from one of two places: a chip the person tapped, or words
 * the line recognised (APP-307). Both fill the same chip, and the rules for
 * which wins are here:
 *
 * - A tap is a `choice`. `undefined` is "not chosen", so recognition (or
 *   nothing) decides; `null` is "chosen: none", which also hides what the
 *   line recognised.
 * - Tapping a value for a detail the line recognised takes those words out of
 *   the line, so the field never highlights one date while the chip says
 *   another.
 * - Typing a new recognised part replaces a tapped value of the same kind:
 *   the later of the two is what the person meant (`afterTyping`).
 * - Removing a recognised chip leaves its words in the title: that is the
 *   parser's `dismissed`, which the line keeps.
 */
import { addDays, mondayStart } from '@gather/core/civil-date'
import type {
  QuickAdd,
  QuickAddKind,
  QuickAddPart,
} from '@gather/core/task-quick-add'
import type { TaskRepeat } from '@gather/core/task-repeat'

import type { Priority } from './types'

/** A reminder's wall clock on this phone; the zone is added when it saves. */
export interface ReminderPick {
  date: string
  time: string
}

/** The details a tap can set. `undefined`: not chosen; `null`: chosen none. */
export interface TaskChoices {
  dueDate?: string | null
  priority?: Priority | null
  assigneeId?: string | null
  reminder?: ReminderPick | null
  repeat?: TaskRepeat | null
  /** Labels picked from the menu; the line's `#labels` are added to them. */
  labels: string[]
}

/** Where the composer was opened, and what that place chooses up front. */
export interface TaskPreset {
  /** The list on screen; otherwise the last one used, else the first. */
  listId?: string
  /** Today on the Today smart list. */
  dueDate?: string
  /** Me on My tasks. */
  assigneeId?: string
}

/** Everything a closed composer keeps until it saves (`useComposerDraft`). */
export interface TaskDraft {
  line: string
  dismissed: readonly string[]
  body: string
  /** The description line is showing (from the + menu, or a body typed). */
  showBody: boolean
  /** The list picked on the chip; `null` until one is. */
  listId: string | null
  choices: TaskChoices
  /**
   * Sent as `tasks.add`'s idempotency key: this draft saves one task however
   * often it is sent, across a close and a reopen. A new draft has a new one.
   */
  saveKey: string
}

/** The fields one new task is saved with. */
export interface ComposedTask {
  title: string
  dueDate?: string
  repeat?: TaskRepeat
  assigneeId?: string
  labels: string[]
  priority?: Priority
  notes?: string
  reminder?: ReminderPick
}

export function presetChoices(preset: TaskPreset): TaskChoices {
  return {
    ...(preset.dueDate ? { dueDate: preset.dueDate } : {}),
    ...(preset.assigneeId ? { assigneeId: preset.assigneeId } : {}),
    labels: [],
  }
}

export function emptyDraft(preset: TaskPreset, saveKey = newSaveKey()): TaskDraft {
  return {
    line: '',
    dismissed: [],
    body: '',
    showBody: false,
    listId: preset.listId ?? null,
    choices: presetChoices(preset),
    saveKey,
  }
}

/** A key no other draft on this phone has; the server needs 8 to 100 characters. */
export function newSaveKey(): string {
  return `composer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * After a save: empty and ready for the next one, on the same list, with the
 * place's own date and person back and every other detail cleared.
 */
export function nextDraft(draft: TaskDraft, preset: TaskPreset): TaskDraft {
  return { ...emptyDraft(preset), listId: draft.listId }
}

/** Whether closing should keep it: a word typed or a detail changed. */
export function isDirty(draft: TaskDraft, preset: TaskPreset): boolean {
  if (draft.line.trim() || draft.body.trim()) return true
  const base = presetChoices(preset)
  const { choices } = draft
  return (
    choices.labels.length > 0 ||
    choices.dueDate !== base.dueDate ||
    choices.assigneeId !== base.assigneeId ||
    choices.priority !== undefined ||
    choices.reminder !== undefined ||
    choices.repeat !== undefined
  )
}

/** Which tapped detail a recognised part of the line stands for. */
const CHOICE_OF: Record<
  Exclude<QuickAddKind, 'label'>,
  keyof Omit<TaskChoices, 'labels'>
> = {
  date: 'dueDate',
  time: 'reminder',
  repeat: 'repeat',
  member: 'assigneeId',
}

/**
 * The task the draft stands for. The title is the line without what was
 * recognised in it; each detail is the tap, else the line, else nothing.
 */
export function composedTask(draft: TaskDraft, parsed: QuickAdd): ComposedTask {
  const { choices } = draft
  const pick = <T>(choice: T | null | undefined, read: T | undefined) =>
    choice === null ? undefined : (choice ?? read)
  const dueDate = pick(choices.dueDate, parsed.dueDate)
  // A typed time is a reminder on the task's day; a time alone is on the
  // day the parser gave it.
  const typedReminder = parsed.time
    ? { date: dueDate ?? parsed.dueDate ?? '', time: parsed.time }
    : undefined
  const reminder = pick(
    choices.reminder,
    typedReminder?.date ? typedReminder : undefined,
  )
  const labels = Array.from(new Set([...choices.labels, ...parsed.labels]))
  const notes = draft.body.trim()
  const repeat = pick(choices.repeat, parsed.repeat)
  const assigneeId = pick(choices.assigneeId, parsed.assigneeId)
  const priority = choices.priority ?? undefined
  return {
    title: parsed.title,
    labels,
    ...(dueDate ? { dueDate } : {}),
    ...(repeat ? { repeat } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(priority ? { priority } : {}),
    ...(notes ? { notes } : {}),
    ...(reminder ? { reminder } : {}),
  }
}

/** A quick-add line on its own, as the Add tab and a list's row save it. */
export function parsedTask(parsed: QuickAdd): ComposedTask {
  return composedTask(emptyDraft({}), parsed)
}

/** The line with one recognised part's words taken out, spaces tidied. */
export function withoutPart(line: string, part: Pick<QuickAddPart, 'start' | 'end'>) {
  return `${line.slice(0, part.start)} ${line.slice(part.end)}`
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * The line once a tap has set `kind`: the words the line recognised for it
 * come out, last first so the earlier spans stay where they are.
 */
export function lineAfterChoice(
  line: string,
  parsed: QuickAdd,
  kind: Exclude<QuickAddKind, 'label'>,
): string {
  return parsed.parts
    .filter((part) => part.kind === kind)
    .sort((a, b) => b.start - a.start)
    .reduce((rest, part) => withoutPart(rest, part), line)
}

/**
 * After typing: a part of a kind that was not recognised before replaces a
 * value tapped for that detail. `before` is the parts' keys the last time.
 */
export function afterTyping(
  choices: TaskChoices,
  before: ReadonlySet<string>,
  parts: readonly QuickAddPart[],
): TaskChoices {
  let next = choices
  for (const part of parts) {
    if (part.kind === 'label' || before.has(part.key)) continue
    const key = CHOICE_OF[part.kind]
    if (next[key] === undefined) continue
    next = { ...next }
    delete next[key]
  }
  return next
}

/** The date menu's shortcuts: today, tomorrow, the weekend, next Monday. */
export function dateShortcuts(today: string, weekend: string) {
  return {
    today,
    tomorrow: addDays(today, 1),
    weekend,
    nextWeek: mondayStart(addDays(today, 7)),
  }
}

/** The short repeats the Repeat menu offers before Custom…. */
export const QUICK_REPEATS = {
  day: { mode: 'fixed', unit: 'day', every: 1 },
  week: { mode: 'fixed', unit: 'week', every: 1 },
  month: { mode: 'fixed', unit: 'month', every: 1 },
} as const satisfies Record<string, TaskRepeat>
