import { describeClash } from '@gather/core/meal-preferences'
import {
  awayAt,
  clock,
  dayTitle,
  eatersOf,
  joinNames,
  mealIn,
  servingsOf,
  shortNames,
  weekdayInText,
  weekdayName,
} from '@gather/core/week-menu'
import { draftIn, draftReason } from '@gather/core/week-menu-plan'
import { Link, useNavigate } from '@tanstack/react-router'
import { RefreshCw, Sparkles } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { EmptyState } from '../app/EmptyState'
import { DetailPanelHeader, ListLoadingState } from '../app/ListDetailLayout'
import { ModuleTile } from '../app/ModuleTile'
import { fieldClass } from '../recipes/fields'
import {
  canMoveTo,
  type Draft,
  eatingCount,
  type PlannedMeal,
  recordLink,
  type WeekData,
  weekLink,
} from './data'
import { useWeekDays, useWorkspace } from './MealPlannerWorkspace'
import { labelClass } from './parts'

const NOTE_MAX = 500
const MAX_SERVINGS = 50

/** A board pill: 40 px, the group's wash and text. */
const pillClass =
  'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border-0 bg-[var(--kitchen-wash)] px-4 text-subhead font-semibold text-[var(--kitchen-text)] no-underline disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:min-h-[var(--size-control-min)]'

type Selection = { kind: 'meal' | 'draft'; id: string }

/**
 * The open meal or proposal, or why there is none. When the record it named
 * is replaced (another proposal, an accepted one, Something else), the panel
 * follows its slot to what is there now.
 */
export function RecordPanel({
  selection,
  onClose,
  page = false,
}: {
  selection: Selection
  /** Closes the panel; absent on a page of its own. */
  onClose?: () => void
  page?: boolean
}) {
  const { messages: t } = useI18n()
  const words = t.mealPlanner.web
  const { week, data, drafts } = useWorkspace()
  const navigate = useNavigate()
  const { kind, id } = selection
  const meal =
    kind === 'meal' ? data?.meals.find((each) => each._id === id) : undefined
  const draft =
    kind === 'draft' ? drafts?.find((each) => each._id === id) : undefined
  const record = meal ?? draft

  const seen = useRef<{ id: string; date: string; slot: Draft['slot'] }>(
    undefined,
  )
  if (record) seen.current = { id, date: record.date, slot: record.slot }
  const was = seen.current?.id === id ? seen.current : undefined
  const leaving = useRef<string>(undefined)
  const followMeal =
    !record && was && data ? mealIn(data.meals, was.date, was.slot) : undefined
  const followDraft =
    !record && was && drafts ? draftIn(drafts, was.date, was.slot) : undefined
  const next = followMeal ?? followDraft
  const nextKind = followMeal ? 'meal' : 'draft'
  useEffect(() => {
    if (!next || leaving.current === id) return
    void navigate({
      ...recordLink({ kind: nextKind, id: next._id }, week, !page),
      replace: true,
    })
  }, [next, nextKind, id, week, page, navigate])

  if (!data || !drafts)
    return (
      <div className="p-[18px]">
        <ListLoadingState label={words.loading} sections={1} />
      </div>
    )
  if (meal)
    return (
      <MealPanel
        key={meal._id}
        meal={meal}
        data={data}
        page={page}
        onClose={onClose}
        onRemoved={() => {
          leaving.current = id
          void navigate(weekLink(week))
        }}
      />
    )
  if (draft)
    return (
      <DraftPanel draft={draft} data={data} page={page} onClose={onClose} />
    )
  if (next) return null
  return (
    <div className="p-[18px]">
      <EmptyState
        kind="nothing-found"
        title={words.notFoundTitle}
        body={kind === 'meal' ? words.notFoundBody : words.draftGoneBody}
        action={{ label: words.toWeek, link: weekLink(week) }}
      />
    </div>
  )
}

/** The photo, or the kitchen tile. */
function Photo({ imageUrl, quick }: { imageUrl?: string | null; quick: boolean }) {
  return (
    <div className="grid h-[132px] place-items-center overflow-hidden rounded-2xl bg-[var(--kitchen-wash)]">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <ModuleTile
          group="kitchen"
          icon={quick ? 'Utensils' : 'ChefHat'}
          size="l"
        />
      )}
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-group="kitchen" className="grid grid-cols-[minmax(0,1fr)] gap-3.5 p-[18px]">
      {children}
    </div>
  )
}

/** One planned meal: who eats, servings, where it goes, what to do with it. */
function MealPanel({
  meal,
  data,
  page,
  onClose,
  onRemoved,
}: {
  meal: PlannedMeal
  data: WeekData
  page: boolean
  onClose?: () => void
  onRemoved: () => void
}) {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const mealWords = words.meal
  const { actions, open } = useWorkspace()
  const days = useWeekDays()
  const eaters = eatersOf(data, meal.date, meal.slot, meal.eaterIds)
  const servings = servingsOf(data, meal.servings, eaters.length)
  const away = awayAt(data.events, meal.date, meal.slot)
  const names = shortNames(data.members)
  const nameOf = (member: WeekData['members'][number]) =>
    names.get(member.userId) || member.name
  const fromCalendar = data.members.flatMap((member) => {
    const event = away.get(member.userId)
    return event
      ? [
          fmt(mealWords.calendarItem, {
            name: nameOf(member),
            title: event.title,
            time: clock(event.startMinutes),
          }),
        ]
      : []
  })
  const save = (changes: Parameters<typeof actions.update>[1]) =>
    void actions.update(meal._id, changes).catch(() => {})

  const toggle = (userId: string) =>
    save({
      eaterIds: eaters.includes(userId)
        ? eaters.filter((each) => each !== userId)
        : data.members
            .map((member) => member.userId)
            .filter((each) => each === userId || eaters.includes(each)),
      // Who eats decides the count again, as the design asks.
      ...(meal.servings === undefined ? {} : { servings: null }),
    })
  const meta = [
    meal.prepMinutes ? fmt(words.minutes, { minutes: meal.prepMinutes }) : null,
    meal.recipeId ? mealWords.recipe : mealWords.quickMeal,
  ]
    .filter(Boolean)
    .join(' · ')
  const { recipeId } = meal

  return (
    <Frame>
      <Photo imageUrl={meal.imageUrl} quick={!recipeId} />
      <DetailPanelHeader
        title={meal.title}
        level={page ? 1 : 2}
        subtitle={`${dayTitle(meal.date, locale)} · ${words.slots[meal.slot]} · ${meta}`}
        onClose={onClose}
      />

      {data.members.length > 1 ? (
        <div className="grid gap-2">
          <h3 className={labelClass}>{mealWords.whoEats}</h3>
          <div className="flex flex-wrap gap-2">
            {data.members.map((member) => {
              const on = eaters.includes(member.userId)
              return (
                <button
                  key={member.userId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(member.userId)}
                  className={`min-h-9 cursor-pointer rounded-[var(--radius-pill)] border px-3.5 text-subhead pointer-coarse:min-h-[var(--size-control-min)] ${
                    on
                      ? 'border-[var(--kitchen-text)] bg-[var(--kitchen-wash)] font-semibold text-[var(--kitchen-text)]'
                      : 'border-dashed border-[var(--hair-strong)] bg-transparent text-[var(--muted)] line-through'
                  }`}
                >
                  {nameOf(member)}
                </button>
              )
            })}
          </div>
          {fromCalendar.length > 0 ? (
            <p className="m-0 text-footnote text-[var(--muted)]">
              {fmt(mealWords.fromCalendar, {
                items: joinNames(fromCalendar, words),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        role="group"
        aria-label={mealWords.servings}
        className="flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--ground)] px-3.5 py-1.5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-subhead">{mealWords.servings}</span>
          <span className="block text-footnote text-[var(--muted)]">
            {meal.servings === undefined
              ? mealWords.servingsFollow
              : fmt(mealWords.servingsAdjusted, { count: eaters.length })}
          </span>
        </span>
        <button
          type="button"
          aria-label={mealWords.fewer}
          disabled={servings <= 1}
          onClick={() => save({ servings: servings - 1 })}
          className={`${buttonClass.smallRound} bg-[var(--surface)] pointer-coarse:size-[var(--size-control-min)]`}
        >
          <span aria-hidden="true">−</span>
        </button>
        <span
          aria-live="polite"
          className="min-w-6 text-center font-semibold tabular-nums"
        >
          {servings}
        </span>
        <button
          type="button"
          aria-label={mealWords.moreServings}
          disabled={servings >= MAX_SERVINGS}
          onClick={() => save({ servings: servings + 1 })}
          className={`${buttonClass.smallRound} bg-[var(--surface)] pointer-coarse:size-[var(--size-control-min)]`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <div className="grid gap-2">
        <h3 className={labelClass}>{mealWords.moveTo}</h3>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const here = date === meal.date
            const allowed = canMoveTo(data, meal, date)
            const other = here
              ? undefined
              : mealIn(data.meals, date, meal.slot)
            const day = weekdayName(date, locale)
            const name = here
              ? fmt(words.web.stillHere, { day })
              : !allowed
                ? fmt(words.web.noSlot, { day, slot: words.slots[meal.slot] })
                : other
                  ? fmt(mealWords.swaps, {
                      title: other.title,
                      day: weekdayInText(date, locale),
                    })
                  : fmt(words.web.moveToDay, {
                      day: weekdayInText(date, locale),
                    })
            return (
              <button
                key={date}
                type="button"
                aria-label={name}
                title={name}
                aria-current={here ? 'date' : undefined}
                disabled={!allowed}
                onClick={() => actions.move(data, meal, date)}
                className={`grid h-9 min-w-0 cursor-pointer place-items-center rounded-[10px] border-0 p-0 text-footnote font-semibold disabled:cursor-default pointer-coarse:h-[var(--size-control-min)] ${
                  here
                    ? 'bg-[var(--ink)] text-[var(--surface)]'
                    : allowed
                      ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                      : 'bg-transparent text-[var(--muted)]'
                }`}
              >
                <span className="relative">
                  {t.mealPreferences.dayShort[index]}
                  {other ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 top-0 size-1 rounded-full bg-current"
                    />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <NoteField
        note={meal.note}
        onSave={(note) => actions.update(meal._id, { note: note || null })}
      />

      <div className="flex flex-wrap gap-2">
        {recipeId ? (
          <Link {...linkTo('recipe', { recipeId })} className={pillClass}>
            {mealWords.openRecipe}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() =>
            open({
              kind: 'swap',
              date: meal.date,
              slot: meal.slot,
              replacing: meal._id,
              current: { title: meal.title, prepMinutes: meal.prepMinutes },
            })
          }
          className={pillClass}
        >
          {mealWords.somethingElse}
        </button>
        <button
          type="button"
          onClick={() =>
            open({
              kind: 'pick',
              date: meal.date,
              slot: meal.slot,
              replacing: meal._id,
            })
          }
          className={pillClass}
        >
          {words.plan.chooseYourself}
        </button>
        {recipeId ? (
          <button
            type="button"
            aria-label={mealWords.groceries}
            onClick={() => open({ kind: 'meal-groceries', recipeId, servings })}
            className={pillClass}
          >
            {words.web.toGroceries}
          </button>
        ) : null}
      </div>
      <div>
        <button
          type="button"
          onClick={() => {
            onRemoved()
            actions.remove(meal)
          }}
          className={`${buttonClass.danger} -ml-3 text-subhead`}
        >
          {mealWords.remove}
        </button>
      </div>
    </Frame>
  )
}

/** Saves when left: on blur, and when the panel goes away. */
function NoteField({
  note = '',
  onSave,
}: {
  note?: string
  onSave: (note: string) => Promise<unknown>
}) {
  const words = useI18n().messages.mealPlanner.meal
  const id = useId()
  // The typed note, or null when it is the saved one.
  const [typed, setTyped] = useState<string | null>(null)
  const latest = useRef({ typed, note, onSave })
  latest.current = { typed, note, onSave }

  const commit = () => {
    const { typed: text, note: saved, onSave: write } = latest.current
    if (text === null) return
    const next = text.trim()
    if (next === saved) {
      setTyped(null)
      return
    }
    write(next).then(
      // Typed on meanwhile: that is the next save's.
      () => setTyped((now) => (now === text ? null : now)),
      () => {},
    )
  }
  useEffect(
    () => () => {
      const { typed: text, note: saved, onSave: write } = latest.current
      if (text !== null && text.trim() !== saved)
        write(text.trim()).catch(() => {})
    },
    [],
  )

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={labelClass}>
        {words.note}
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={NOTE_MAX}
        value={typed ?? note}
        placeholder={words.notePlaceholder}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={commit}
        className={`${fieldClass} resize-y`}
      />
    </div>
  )
}

/** One proposed meal: why, and accept, something else or another proposal. */
function DraftPanel({
  draft,
  data,
  page,
  onClose,
}: {
  draft: Draft
  data: WeekData
  page: boolean
  onClose?: () => void
}) {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const { actions, open } = useWorkspace()
  const day = weekdayInText(draft.date, locale)
  const check = draft.check
    ? describeClash(draft.check, t.mealPreferences)
    : null
  const count = eatingCount(data, draft.date, draft.slot)
  const { recipeId } = draft
  const regenerating = actions.regenerating === draft._id

  return (
    <Frame>
      <Photo imageUrl={draft.imageUrl} quick={!recipeId} />
      <DetailPanelHeader
        title={draft.title}
        level={page ? 1 : 2}
        subtitle={`${dayTitle(draft.date, locale)} · ${words.slots[draft.slot]} · ${count}`}
        onClose={onClose}
      />
      <div className="grid gap-1 rounded-2xl border border-dashed border-[var(--kitchen-text)] p-3.5">
        <p className="m-0 flex items-center gap-1.5 text-footnote font-semibold text-[var(--kitchen-text)]">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {fmt(words.proposal.eyebrow, { slot: words.slots[draft.slot] })}
        </p>
        <p className="m-0 text-subhead">{draftReason(draft, words)}</p>
        {check ? (
          <p className="m-0 text-footnote text-[var(--muted)]">{check}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={fmt(words.proposal.acceptLabel, {
          title: draft.title,
          day,
        })}
        onClick={() => actions.accept(draft)}
        className={`${buttonClass.primary} w-full`}
      >
        {words.proposal.accept}
      </button>
      <div className="flex flex-wrap gap-2">
        {recipeId ? (
          <Link {...linkTo('recipe', { recipeId })} className={pillClass}>
            {words.meal.openRecipe}
          </Link>
        ) : null}
        <button
          type="button"
          aria-label={fmt(words.proposal.somethingElseLabel, { day })}
          onClick={() =>
            open({
              kind: 'swap',
              date: draft.date,
              slot: draft.slot,
              current: { title: draft.title, prepMinutes: draft.prepMinutes },
            })
          }
          className={pillClass}
        >
          {words.proposal.somethingElse}
        </button>
        <button
          type="button"
          aria-busy={regenerating}
          disabled={actions.regenerating !== null}
          onClick={() =>
            actions.regenerate(draft, () => open({ kind: 'plan' }))
          }
          className={pillClass}
        >
          <RefreshCw
            className={`size-4 ${regenerating ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
          {fmt(words.proposal.regenerate, { day })}
        </button>
      </div>
    </Frame>
  )
}
