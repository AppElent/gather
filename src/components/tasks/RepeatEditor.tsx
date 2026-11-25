import type { Task } from '@gather/core/task-model'
import {
  AFTER_DONE_UNITS,
  firstScheduledDate,
  ISO_WEEKDAYS,
  nextDueDate,
  REPEAT_EVERY_MAX,
  REPEAT_UNITS,
  type RepeatUnit,
  sameRepeat,
  type TaskRepeat,
  upcomingDates,
  weekdayName,
} from '@gather/core/task-repeat'
import {
  type Draft,
  draftRule,
  repeatDraft,
} from '@gather/core/task-repeat-draft'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { dateInWords } from '../../lib/rowDate'
import { buttonClass } from '../app/buttons'
import { ChoiceList } from './ChoiceList'
import { useGroupToday } from './data'

/**
 * Never, on a fixed schedule, or a set time after it was done (APP-303). A
 * rule is several choices at once, so it is written by Done, not by each one.
 */
export function RepeatEditor({
  task,
  onSave,
  onClose,
}: {
  task: Pick<Task, 'repeat' | 'dueDate'>
  onSave: (rule: TaskRepeat | null) => void
  onClose: () => void
}) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.repeat
  const today = useGroupToday()
  const [draft, setDraft] = useState(() => repeatDraft(task, today))
  const rule = draftRule(draft, task.dueDate ?? today)
  const invalid = draft.mode !== 'none' && !rule

  const setFixed = (change: Partial<Draft['fixed']>) =>
    setDraft((now) => ({ ...now, fixed: { ...now.fixed, ...change } }))
  const setAfterDone = (change: Partial<Draft['afterDone']>) =>
    setDraft((now) => ({ ...now, afterDone: { ...now.afterDone, ...change } }))

  return (
    <div className="grid gap-3">
      <ChoiceList
        label={words.title}
        current={draft.mode}
        options={(['none', 'fixed', 'afterDone'] as const).map((mode) => ({
          id: mode,
          label: words.modes[mode],
        }))}
        onChoose={(mode) => setDraft((now) => ({ ...now, mode }))}
      />

      {draft.mode === 'fixed' ? (
        <>
          <Interval
            label={words.every}
            every={draft.fixed.every}
            unit={draft.fixed.unit}
            units={REPEAT_UNITS}
            onEvery={(every) => setFixed({ every })}
            onUnit={(unit) => setFixed({ unit })}
          />
          {draft.fixed.unit === 'week' ? (
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-2 p-0 px-1 text-footnote font-semibold text-[var(--muted)]">
                {words.on}
              </legend>
              <div className="flex gap-1">
                {ISO_WEEKDAYS.map((day) => {
                  const on = draft.fixed.weekdays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={weekdayName(day, locale, 'long')}
                      onClick={() =>
                        setFixed({
                          weekdays: on
                            ? draft.fixed.weekdays.filter((each) => each !== day)
                            : [...draft.fixed.weekdays, day].sort(),
                        })
                      }
                      className={`min-h-[var(--size-control-min)] min-w-0 flex-1 cursor-pointer rounded-[var(--radius-control)] border-0 px-0 text-footnote font-semibold ${
                        on
                          ? 'bg-[var(--ink)] text-[var(--on-ink)]'
                          : 'bg-[var(--surface-2)] text-[var(--ink)]'
                      }`}
                    >
                      {weekdayName(day, locale)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : null}
          <AnchorDay rule={rule} locale={locale} />
        </>
      ) : null}

      {draft.mode === 'afterDone' ? (
        <Interval
          label={words.afterDone}
          every={draft.afterDone.every}
          unit={draft.afterDone.unit}
          units={AFTER_DONE_UNITS}
          onEvery={(every) => setAfterDone({ every })}
          onUnit={(unit) => setAfterDone({ unit })}
        />
      ) : null}

      <div
        role="status"
        className="rounded-[var(--radius-control)] bg-[var(--ground)] px-3.5 py-2.5"
      >
        <p className="m-0 text-footnote font-semibold text-[var(--muted)]">
          {words.next}
        </p>
        <p className="m-0 mt-0.5 text-body">
          {preview(draft, rule, task.dueDate, today, locale, words)}
        </p>
      </div>
      <p className="m-0 px-1 text-footnote text-[var(--muted)]">
        {draft.mode === 'none' ? words.footnoteNever : words.footnote}
      </p>
      <button
        type="button"
        disabled={invalid}
        onClick={() => {
          if (!sameRepeat(rule, task.repeat)) onSave(rule)
          onClose()
        }}
        className={buttonClass.primary}
      >
        {words.done}
      </button>
    </div>
  )
}

function preview(
  draft: Draft,
  rule: TaskRepeat | null,
  dueDate: string | undefined,
  today: string,
  locale: string,
  words: ReturnType<typeof useI18n>['messages']['tasks']['repeat'],
): string {
  const day = (iso: string) => dateInWords(iso, locale)
  if (draft.mode === 'none') return words.nextNever
  if (!rule) return words.pickDay
  if (rule.mode === 'afterDone') {
    return fmt(words.nextIfDoneToday, {
      date: day(nextDueDate(rule, { today })),
    })
  }
  if (!dueDate) {
    const first = firstScheduledDate(rule, today, today)
    return [first, ...upcomingDates(rule, first, 2)].map(day).join(' · ')
  }
  return fmt(words.nextAfter, {
    date: day(dueDate),
    dates: upcomingDates(rule, dueDate, 3).map(day).join(' · '),
  })
}

/** The day a monthly or yearly rule falls on, which follows the date. */
function AnchorDay({
  rule,
  locale,
}: {
  rule: TaskRepeat | null
  locale: string
}) {
  const words = useI18n().messages.tasks.repeat
  if (!rule || rule.monthDay === undefined) return null
  const on =
    rule.unit === 'month'
      ? fmt(words.onMonthDay, { day: rule.monthDay })
      : rule.unit === 'year' && rule.month !== undefined
        ? fmt(words.onDate, {
            date: new Date(
              Date.UTC(2024, rule.month - 1, rule.monthDay),
            ).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }),
          })
        : null
  if (!on) return null
  return (
    <div className="px-1">
      <p className="m-0 text-body">{on}</p>
      <p className="m-0 text-footnote text-[var(--muted)]">
        {words.followsDate}
        {rule.monthDay > 28
          ? ` ${fmt(words.lastDayHint, { day: rule.monthDay })}`
          : ''}
      </p>
    </div>
  )
}

function Interval<Unit extends RepeatUnit>({
  label,
  every,
  unit,
  units,
  onEvery,
  onUnit,
}: {
  label: string
  every: number
  unit: Unit
  units: readonly Unit[]
  onEvery: (every: number) => void
  onUnit: (unit: Unit) => void
}) {
  const words = useI18n().messages.tasks.repeat
  const round =
    'grid size-[var(--size-control-min)] cursor-pointer place-items-center rounded-[var(--radius-pill)] border-0 bg-[var(--surface-2)] text-[var(--ink)] disabled:opacity-40'
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <span className="mr-auto text-body">{label}</span>
      <button
        type="button"
        aria-label={words.decrease}
        disabled={every <= 1}
        onClick={() => onEvery(every - 1)}
        className={round}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        className="min-w-6 text-center text-body font-semibold tabular-nums"
      >
        {every}
      </span>
      <button
        type="button"
        aria-label={words.increase}
        disabled={every >= REPEAT_EVERY_MAX}
        onClick={() => onEvery(every + 1)}
        className={round}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <select
        aria-label={label}
        value={unit}
        onChange={(event) => onUnit(event.target.value as Unit)}
        className="min-h-[var(--size-control-min)] rounded-[var(--radius-pill)] border-0 bg-[var(--surface-2)] px-3 text-[16px] text-[var(--ink)]"
      >
        {units.map((each) => (
          <option key={each} value={each}>
            {every === 1 ? words.units[each].one : words.units[each].other}
          </option>
        ))}
      </select>
    </div>
  )
}
