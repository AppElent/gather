import {
  ALLERGENS,
  budgetText,
  CUISINES,
  DIETS,
  MEAL_PREFERENCE_LIMITS,
  MEAL_SLOTS,
  type MealPreferencesListChange,
  type MealPreferencesPatch,
  nextCookingMinutes,
  normalizeDislike,
  parseBudgetCents,
  SMART_SWITCHES,
} from '@gather/core/meal-preferences'
import { X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { SectionFooter, SectionLabel } from '../app/InsetList'
import { ListLoadingState } from '../app/ListDetailLayout'
import { ModuleSettingsPage } from '../app/ModuleSettingsPage'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import { Chip, DayCell, Stepper } from './parts'
import { useMealPreferences } from './useMealPreferences'

const LIMITS = MEAL_PREFERENCE_LIMITS
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

/**
 * Meal planner settings: the household's standing meal preferences, as on the
 * phone. Every control saves at once.
 */
export function MealPreferencesPage() {
  const group = useRequiredCurrentGroup()
  return (
    <ModuleSettingsPage moduleId="meal-planner">
      {/* Keyed by Group: a half-typed value must not be saved into another. */}
      <Preferences key={group.slug} />
    </ModuleSettingsPage>
  )
}

function Section({
  heading,
  footnote,
  children,
}: {
  heading: string
  footnote?: string
  children: ReactNode
}) {
  return (
    <section>
      <SectionLabel>{heading}</SectionLabel>
      <div className="rounded-[var(--radius-card)] bg-[var(--surface)] px-4">
        {children}
      </div>
      {footnote ? <SectionFooter>{footnote}</SectionFooter> : null}
    </section>
  )
}

/** A row with a title, a control at its end and what belongs under it. */
function Row({
  title,
  subtitle,
  trailing,
  children,
}: {
  title?: string
  subtitle?: string
  trailing?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="grid gap-2.5 py-3 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="m-0 text-body">{title}</p>
            {subtitle ? (
              <p className="m-0 text-footnote text-[var(--muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {trailing}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** A whole-row switch. */
function SwitchRow({
  title,
  subtitle,
  on,
  onChange,
  children,
}: {
  title: string
  subtitle?: string
  on: boolean
  onChange: (on: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className="grid gap-2.5 py-1.5 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]">
      <label className="flex min-h-[var(--size-row-min)] cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-body">{title}</span>
          {subtitle ? (
            <span className="block text-footnote text-[var(--muted)]">
              {subtitle}
            </span>
          ) : null}
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          onChange={(event) => onChange(event.target.checked)}
          className="size-5 shrink-0 accent-[var(--accent-text)]"
        />
      </label>
      {children}
    </div>
  )
}

function DayChips({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: readonly number[]
  onToggle: (day: (typeof WEEKDAYS)[number], on: boolean) => void
}) {
  const m = useI18n().messages.mealPreferences
  return (
    <div role="group" aria-label={label} className="grid grid-cols-7 gap-1 pb-1.5">
      {WEEKDAYS.map((day) => {
        const on = selected.includes(day)
        return (
          <DayCell
            key={day}
            short={m.dayShort[day]}
            on={on}
            locked={false}
            label={m.dayLong[day]}
            onClick={() => onToggle(day, !on)}
          />
        )
      })}
    </div>
  )
}

function Chips<T extends string>({
  label,
  options,
  names,
  selected,
  onToggle,
}: {
  label: string
  options: readonly T[]
  names: Record<T, string>
  selected: readonly T[]
  onToggle: (option: T, on: boolean) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option)
        return (
          <Chip
            key={option}
            label={names[option]}
            on={on}
            onClick={() => onToggle(option, !on)}
          />
        )
      })}
    </div>
  )
}

function Preferences() {
  const group = useRequiredCurrentGroup()
  const { locale, messages: t } = useI18n()
  const m = t.mealPreferences
  const { prefs, update, setItem, setEats } = useMealPreferences(group.slug)
  const [failed, setFailed] = useState(false)
  const [dislike, setDislike] = useState('')
  const [dislikeFull, setDislikeFull] = useState(false)
  // The typed budget while it is being edited; `null` reads the stored one.
  const [budget, setBudget] = useState<string | null>(null)
  const [budgetInvalid, setBudgetInvalid] = useState(false)
  const decimal: ',' | '.' = locale === 'nl' ? ',' : '.'

  // Leaving with the budget field focused may not blur it, so a typed budget
  // still pending is saved on the way out.
  const stored = prefs?.weeklyBudgetCents
  const leaving = useRef({ budget, decimal, stored, update })
  leaving.current = { budget, decimal, stored, update }
  useEffect(
    () => () => {
      const pending = leaving.current
      if (pending.budget === null) return
      const parsed = parseBudgetCents(pending.budget, pending.decimal)
      if (!parsed.ok || parsed.cents === pending.stored) return
      pending.update({ weeklyBudgetCents: parsed.cents }).catch(() => {})
    },
    [],
  )

  if (prefs === undefined)
    return <ListLoadingState label={t.common.errors.loading} sections={4} />

  const run = (write: Promise<unknown>) => {
    setFailed(false)
    return write.catch(() => setFailed(true))
  }
  const save = (patch: MealPreferencesPatch) => void run(update(patch))
  const saveItem = (change: MealPreferencesListChange) =>
    void run(setItem(change))

  const eaters = prefs.defaultEaterIds.length
  const nameOf = new Map(prefs.members.map((p) => [p.userId, p.name]))
  // Stepping onto the number of people eating is "the same as who eats":
  // stored as no override, so it follows the switches again.
  const setServings = (next: number) =>
    save({ servingsPerMeal: next === Math.max(1, eaters) ? null : next })

  const addDislike = () => {
    const text = normalizeDislike(dislike)
    if (!text) return
    const exists = prefs.dislikes.some(
      (each) => each.toLocaleLowerCase() === text.toLocaleLowerCase(),
    )
    if (!exists && prefs.dislikes.length >= LIMITS.dislikes.count) {
      setDislikeFull(true)
      return
    }
    setDislikeFull(false)
    setDislike('')
    if (!exists) saveItem({ list: 'dislikes', value: text, on: true })
  }

  const commitBudget = () => {
    if (budget === null) return
    const parsed = parseBudgetCents(budget, decimal)
    if (!parsed.ok) {
      setBudgetInvalid(true)
      return
    }
    setBudgetInvalid(false)
    setBudget(null)
    if (parsed.cents === prefs.weeklyBudgetCents) return
    // A refused save puts back what was typed, not the old amount.
    const typed = budget
    setFailed(false)
    update({ weeklyBudgetCents: parsed.cents }).catch(() => {
      setFailed(true)
      setBudget(typed)
    })
  }

  const stepper = (
    label: string,
    value: ReactNode,
    current: number,
    range: { min: number; max: number },
    onChange: (next: number) => void,
  ) => (
    <Stepper
      label={label}
      value={value}
      less={`${label}: ${m.variety.decrease}`}
      more={`${label}: ${m.variety.increase}`}
      canLess={current > range.min}
      canMore={current < range.max}
      onLess={() => onChange(current - 1)}
      onMore={() => onChange(current + 1)}
    />
  )

  return (
    <div data-group="kitchen" className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <p className="mx-1 my-0 text-subhead text-[var(--muted)]">
        {fmt(m.subhead, { group: group.name })}
      </p>
      {failed ? (
        <p
          role="alert"
          className="mx-1 my-0 text-footnote font-semibold text-[var(--danger)]"
        >
          {m.saveFailed}
        </p>
      ) : null}

      <Section heading={m.who.heading} footnote={m.who.footnote}>
        {prefs.memberDefaults.map(({ userId, eatsByDefault }) => (
          <SwitchRow
            key={userId}
            title={nameOf.get(userId) ?? ''}
            subtitle={eatsByDefault ? m.who.eatsByDefault : m.who.notByDefault}
            on={eatsByDefault}
            onChange={(next) => void run(setEats(userId, next))}
          />
        ))}
        <Row
          title={m.who.servings}
          subtitle={
            prefs.servingsOverride === null
              ? fmt(m.who.servingsSame, { count: Math.max(1, eaters) })
              : fmt(m.who.servingsAdjusted, { count: eaters })
          }
          trailing={stepper(
            m.who.servings,
            prefs.servingsPerMeal,
            prefs.servingsPerMeal,
            LIMITS.servings,
            setServings,
          )}
        >
          {prefs.servingsOverride !== null ? (
            <div>
              <button
                type="button"
                onClick={() => save({ servingsPerMeal: null })}
                className="min-h-9 cursor-pointer border-0 bg-transparent p-0 text-subhead text-[var(--accent-text)] pointer-coarse:min-h-[var(--size-control-min)]"
              >
                {m.who.servingsReset}
              </button>
            </div>
          ) : null}
        </Row>
      </Section>

      <Section heading={m.plan.heading} footnote={m.plan.footnote}>
        {MEAL_SLOTS.map((slot) => {
          const plan = prefs.slots[slot]
          return (
            <SwitchRow
              key={slot}
              title={m.plan.slots[slot]}
              subtitle={slot === 'breakfast' ? undefined : m.plan.onChosenDays}
              on={plan.enabled}
              onChange={(on) => saveItem({ list: 'slotEnabled', slot, on })}
            >
              {plan.enabled ? (
                <DayChips
                  label={m.plan.slots[slot]}
                  selected={plan.days}
                  onToggle={(value, on) =>
                    saveItem({ list: 'slotDays', slot, value, on })
                  }
                />
              ) : null}
            </SwitchRow>
          )
        })}
      </Section>

      <Section heading={m.time.heading} footnote={m.time.footnote}>
        <Row>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => {
              const minutes = prefs.cookingMinutes[day] ?? null
              const label =
                minutes === null
                  ? fmt(m.time.cellLabelNone, { day: m.dayLong[day] })
                  : fmt(m.time.cellLabel, { day: m.dayLong[day], minutes })
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={`${label}. ${m.time.hint}`}
                  onClick={() =>
                    saveItem({
                      list: 'cookingMinutes',
                      day,
                      minutes: nextCookingMinutes(minutes),
                    })
                  }
                  className="grid min-h-12 min-w-0 cursor-pointer content-center justify-items-center rounded-[var(--radius-control)] border-0 bg-[var(--ground)] px-0.5 py-1"
                >
                  <span className="text-footnote font-semibold text-[var(--muted)]">
                    {m.dayShort[day]}
                  </span>
                  <span className="max-w-full truncate text-footnote tabular-nums md:text-body">
                    {minutes === null
                      ? m.time.none
                      : fmt(m.time.minutes, { minutes })}
                  </span>
                </button>
              )
            })}
          </div>
        </Row>
      </Section>

      <Section heading={m.diet.heading} footnote={m.diet.footnote}>
        <Row>
          <Chips
            label={m.diet.heading}
            options={DIETS}
            names={m.diet.names}
            selected={prefs.diets}
            onToggle={(value, on) => saveItem({ list: 'diets', value, on })}
          />
        </Row>
      </Section>

      <Section heading={m.allergies.heading} footnote={m.allergies.footnote}>
        <Row>
          <Chips
            label={m.allergies.heading}
            options={ALLERGENS}
            names={m.allergies.names}
            selected={prefs.allergens}
            onToggle={(value, on) => saveItem({ list: 'allergens', value, on })}
          />
        </Row>
      </Section>

      <Section heading={m.dislikes.heading}>
        <Row>
          {prefs.dislikes.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {prefs.dislikes.map((each) => (
                <li
                  key={each}
                  className="inline-flex min-h-9 items-center gap-0.5 rounded-[var(--radius-pill)] bg-[var(--surface-2)] pl-3 text-subhead"
                >
                  {each}
                  <button
                    type="button"
                    aria-label={fmt(m.dislikes.remove, { name: each })}
                    onClick={() => {
                      setDislikeFull(false)
                      saveItem({ list: 'dislikes', value: each, on: false })
                    }}
                    className="grid size-9 cursor-pointer place-items-center rounded-[var(--radius-pill)] border-0 bg-transparent text-[var(--muted)] pointer-coarse:size-[var(--size-control-min)]"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-subhead text-[var(--muted)]">
              {m.dislikes.empty}
            </p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              addDislike()
            }}
          >
            <input
              value={dislike}
              maxLength={LIMITS.dislikes.length}
              aria-label={m.dislikes.heading}
              placeholder={m.dislikes.placeholder}
              onChange={(event) => {
                setDislike(event.target.value)
                setDislikeFull(false)
              }}
              className={`${inputClass} min-h-[var(--size-control-min)]`}
            />
            <button
              type="submit"
              disabled={!dislike.trim()}
              className={`${buttonClass.secondary} disabled:opacity-40`}
            >
              {t.common.actions.add}
            </button>
          </form>
          {dislikeFull ? (
            <p
              role="alert"
              className="m-0 text-footnote font-semibold text-[var(--danger)]"
            >
              {m.dislikes.tooMany}
            </p>
          ) : null}
        </Row>
      </Section>

      <Section heading={m.variety.heading}>
        <Row
          title={m.variety.noRepeat}
          trailing={stepper(
            m.variety.noRepeat,
            plural(locale, prefs.noRepeatDays, m.variety.noRepeatValue),
            prefs.noRepeatDays,
            LIMITS.noRepeatDays,
            (noRepeatDays) => save({ noRepeatDays }),
          )}
        />
        <Row
          title={m.variety.meatFree}
          trailing={stepper(
            m.variety.meatFree,
            plural(locale, prefs.meatFreeNights, m.variety.meatFreeValue),
            prefs.meatFreeNights,
            LIMITS.meatFreeNights,
            (meatFreeNights) => save({ meatFreeNights }),
          )}
        />
        <Row title={m.variety.fishNight} subtitle={m.variety.fishNightSub}>
          <DayChips
            label={m.variety.fishNight}
            selected={prefs.fishDays}
            onToggle={(value, on) => saveItem({ list: 'fishDays', value, on })}
          />
        </Row>
      </Section>

      <Section heading={m.leftovers.heading} footnote={m.leftovers.footnote}>
        <Row title={m.leftovers.cookDouble}>
          <DayChips
            label={m.leftovers.cookDouble}
            selected={prefs.leftoverDays}
            onToggle={(value, on) =>
              saveItem({ list: 'leftoverDays', value, on })
            }
          />
        </Row>
      </Section>

      <Section heading={m.extra.heading} footnote={m.extra.footnote}>
        <Row
          title={m.extra.budget}
          trailing={
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--muted)]" aria-hidden="true">
                €
              </span>
              <input
                value={budget ?? budgetText(prefs.weeklyBudgetCents, decimal)}
                inputMode="decimal"
                aria-label={m.extra.budgetLabel}
                aria-invalid={budgetInvalid}
                placeholder={m.extra.budgetPlaceholder}
                onChange={(event) => {
                  setBudget(event.target.value)
                  setBudgetInvalid(false)
                }}
                onBlur={commitBudget}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitBudget()
                }}
                className={`${inputClass} min-h-[var(--size-control-min)] max-w-28 text-right`}
              />
            </span>
          }
        >
          {budgetInvalid ? (
            <p
              role="alert"
              className="m-0 text-footnote font-semibold text-[var(--danger)]"
            >
              {m.extra.budgetInvalid}
            </p>
          ) : null}
        </Row>
        <Row title={m.extra.cuisines} subtitle={m.extra.cuisinesSub}>
          <Chips
            label={m.extra.cuisines}
            options={CUISINES}
            names={m.extra.cuisineNames}
            selected={prefs.cuisines}
            onToggle={(value, on) => saveItem({ list: 'cuisines', value, on })}
          />
        </Row>
      </Section>

      <Section heading={m.smart.heading} footnote={m.smart.footnote}>
        {SMART_SWITCHES.map((key) => (
          <SwitchRow
            key={key}
            title={m.smart[key]}
            subtitle={m.smart.subs[key]}
            on={prefs.smart[key]}
            onChange={(on) => saveItem({ list: 'smart', key, on })}
          />
        ))}
      </Section>

      <p className="mx-1 my-0 text-footnote text-[var(--muted)]">
        {fmt(m.closing, { group: group.name })}
      </p>
    </div>
  )
}
