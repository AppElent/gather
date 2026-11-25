import { todayIn } from '@gather/core/civil-date'
import type { MealSlot } from '@gather/core/meal-planner'
import { weekRange } from '@gather/core/week-menu'
import {
  defaultPlanSlots,
  emptyTargets,
  type PlanUse,
  planDays,
  planSlotChoices,
  planUses,
  slotChipLabel,
} from '@gather/core/week-menu-plan'
import {
  WEEK_PLAN_WISHES,
  type WeekPlanWish,
  WISH_MAX,
} from '@gather/core/week-plan'
import { useAction, useConvexConnectionState, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Calendar, House, Sliders, Sparkles, Users } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { InsetList, InsetRow } from '../app/InsetList'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import type { WeekData } from './data'
import { Chip, DayCell, LimitCard, labelClass } from './parts'

type Outcome = Exclude<
  FunctionReturnType<typeof api.mealPlanDrafts.propose>,
  { status: 'limit' }
>

const USE_ICONS: Record<PlanUse['kind'], typeof Sliders> = {
  preferences: Sliders,
  calendar: Calendar,
  eaters: Users,
  stock: House,
}

/**
 * Plan my week: which days to fill, which slots, an optional wish, what
 * Gather takes into account, and one button that asks for a proposal. Over
 * the day's cap it shows the Limit card instead of the form.
 */
export function PlanDialog({
  weekStart,
  data,
  stored,
  onClose,
  onPlanned,
  onChooseYourself,
}: {
  weekStart: string
  data: WeekData
  /** What the week's open proposal was planned with. */
  stored?: { wishes: WeekPlanWish[]; wish: string }
  onClose: () => void
  /** After a plan came back; the dialog has closed itself. */
  onPlanned: (outcome: Outcome) => void
  /** Choose yourself from the Limit card: Pick for the first empty slot. */
  onChooseYourself: (date: string, slot: MealSlot) => void
}) {
  const group = useRequiredCurrentGroup()
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const plan = words.plan
  const usage = useQuery(api.aiUsage.today, {})
  const staples = useQuery(api.groceryStaples.list, { groupSlug: group.slug })
  const propose = useAction(api.mealPlanDrafts.propose)
  const online = useConvexConnectionState().isWebSocketConnected
  const wishId = useId()

  const choices = useMemo(
    () => planSlotChoices(data.preferences),
    [data.preferences],
  )
  const [slots, setSlots] = useState<MealSlot[]>(() => defaultPlanSlots(choices))
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set())
  const [wish, setWish] = useState(stored?.wish ?? '')
  const [wishes, setWishes] = useState<WeekPlanWish[]>(stored?.wishes ?? [])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [overCap, setOverCap] = useState(false)

  const today = todayIn(group.timeZone)
  const days = planDays(weekStart, data, choices, slots, flipped, today)
  const fillDates = days
    .filter((day) => day.state === 'fill')
    .map((day) => day.date)
  const targets = emptyTargets(data, choices, slots, fillDates)
  const lowNames = (staples?.staples ?? [])
    .filter((staple) => staple.low)
    .map((staple) => staple.name)
  const uses = planUses({
    data,
    dates: fillDates,
    lowNames,
    stockNames: (staples?.staples ?? [])
      .filter((staple) => !staple.low)
      .map((staple) => staple.name),
    words,
    prefWords: t.mealPreferences,
    locale,
  })
  const limited = overCap || usage?.left === 0
  const wishChips = WEEK_PLAN_WISHES.filter(
    (key) => key !== 'useLow' || lowNames.length > 0,
  )

  const toggleDay = (date: string) =>
    setFlipped((current) => {
      const next = new Set(current)
      if (!next.delete(date)) next.add(date)
      return next
    })

  const submit = () => {
    if (busy || targets.length === 0) return
    setBusy(true)
    setFailed(false)
    propose({
      groupSlug: group.slug,
      weekStart,
      dates: fillDates,
      slots,
      locale,
      wishes,
      wish: wish.trim() ? wish.trim().slice(0, WISH_MAX) : undefined,
    })
      .then((result) => {
        if (result.status === 'limit') {
          setOverCap(true)
          return
        }
        onPlanned(result)
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  const chooseYourself = () => {
    const [first] = emptyTargets(
      data,
      choices,
      choices.map((choice) => choice.slot),
      days.filter((day) => day.date >= today).map((day) => day.date),
    )
    const target = first ?? {
      date: today < weekStart ? weekStart : today,
      slot: 'dinner' as const,
    }
    onChooseYourself(target.date, target.slot)
  }

  return (
    <Dialog
      title={plan.title}
      onClose={onClose}
      actions={
        limited ? undefined : (
          <div className="grid w-full gap-2">
            {failed ? (
              <p
                role="alert"
                className="m-0 text-footnote font-semibold text-[var(--danger)]"
              >
                {plan.failed}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!online || busy || targets.length === 0}
              onClick={submit}
              className={`${buttonClass.primary} w-full`}
            >
              <Sparkles className="size-[18px]" aria-hidden="true" />
              {!online
                ? plan.offline
                : busy
                  ? plan.working
                  : fillDates.length === 0
                    ? plan.ctaNothing
                    : plural(locale, fillDates.length, plan.cta)}
            </button>
            {usage ? (
              <p className="m-0 text-center text-footnote text-[var(--muted)]">
                {fmt(plan.cost, { left: usage.left, limit: usage.limit })}
              </p>
            ) : null}
          </div>
        )
      }
    >
      <p className="m-0 text-subhead text-[var(--muted)]">
        {fmt(plan.subhead, { range: weekRange(weekStart, locale) })}
      </p>
      {limited ? (
        <LimitCard
          used={usage?.used ?? usage?.limit ?? 0}
          limit={usage?.limit ?? 0}
          onChooseYourself={chooseYourself}
        />
      ) : (
        <>
          <div className="grid gap-2">
            <h3 className={labelClass}>{plan.days}</h3>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const planned = day.state === 'planned'
                const on = day.state === 'fill'
                return (
                  <DayCell
                    key={day.date}
                    short={t.mealPreferences.dayShort[index]}
                    state={
                      planned
                        ? plan.dayPlanned
                        : on
                          ? plan.dayFill
                          : plan.daySkip
                    }
                    on={on}
                    locked={planned}
                    disabled={planned || busy}
                    label={fmt(
                      planned
                        ? plan.dayPlannedLabel
                        : on
                          ? plan.dayFillLabel
                          : plan.daySkipLabel,
                      { day: t.mealPreferences.dayLong[index] },
                    )}
                    onClick={() => toggleDay(day.date)}
                  />
                )
              })}
            </div>
            {choices.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {choices.map((choice) => (
                  <Chip
                    key={choice.slot}
                    label={slotChipLabel(choice, words, t.mealPreferences)}
                    on={slots.includes(choice.slot)}
                    disabled={busy}
                    onClick={() =>
                      setSlots((current) =>
                        current.includes(choice.slot)
                          ? current.filter((slot) => slot !== choice.slot)
                          : [...current, choice.slot],
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor={wishId} className={labelClass}>
              {plan.wish}
            </label>
            <input
              id={wishId}
              value={wish}
              maxLength={WISH_MAX}
              placeholder={plan.wishPlaceholder}
              onChange={(event) => setWish(event.target.value)}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-2">
              {wishChips.map((key) => (
                <Chip
                  key={key}
                  label={fmt(plan.wishes[key], {
                    item: (lowNames[0] ?? '').toLocaleLowerCase(locale),
                  })}
                  on={wishes.includes(key)}
                  onClick={() =>
                    setWishes((current) =>
                      current.includes(key)
                        ? current.filter((entry) => entry !== key)
                        : [...current, key],
                    )
                  }
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <h3 className={labelClass}>{plan.uses}</h3>
            <div className="rounded-[var(--radius-card)] bg-[var(--ground)] p-1">
              <InsetList>
                {uses.map((use) => {
                  const Icon = USE_ICONS[use.kind]
                  const preferences = use.kind === 'preferences'
                  return (
                    <InsetRow
                      key={use.kind}
                      title={use.label}
                      footnote={use.sub}
                      leading={<Icon className="size-5" aria-hidden="true" />}
                      link={
                        preferences ? linkTo('mealPlannerSettings') : undefined
                      }
                      trailing={preferences ? plan.adjust : undefined}
                    />
                  )
                })}
              </InsetList>
            </div>
          </div>
        </>
      )}
    </Dialog>
  )
}
