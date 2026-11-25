import { SWAP_CHIPS, type SwapChip } from '@gather/core/meal-ideas'
import type { MealSlot } from '@gather/core/meal-planner'
import {
  busyEvent,
  clock,
  mealIn,
  sentenceCase,
  weekdayInText,
} from '@gather/core/week-menu'
import { IDEA_SERVINGS, type IdeaRow, ideaRows } from '@gather/core/week-menu-idea'
import { swapReason } from '@gather/core/week-menu-plan'
import { WISH_MAX } from '@gather/core/week-plan'
import {
  useAction,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ChevronLeft, ChevronRight, Clock, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import { eatingCount, type WeekData } from './data'
import { useMealPlannerNotices } from './MealPlannerNotices'
import { Chip, LimitCard, labelClass, MealThumb, Stepper } from './parts'

type Alternative = Extract<
  FunctionReturnType<typeof api.mealIdeas.swap>,
  { alternatives: unknown }
>['alternatives'][number]
type Idea = Extract<
  FunctionReturnType<typeof api.mealIdeas.idea>,
  { idea: unknown }
>['idea']

/** What Choose put in the slot, for Undo and for the next Choose. */
interface Chosen {
  key: string
  id: Id<'plannedDinners'>
  recipeId?: Id<'recipes'>
  mealEntryId?: Id<'mealEntries'>
  title: string
  /** The slot before the first Choose: Undo puts it back. */
  previous: FunctionReturnType<typeof api.mealIdeas.choose>['previous']
}

type SwapState =
  | { kind: 'asking' }
  | { kind: 'shown'; alternatives: Alternative[]; fallback: boolean }
  | { kind: 'limit' }
  | { kind: 'failed' }

type IdeaState =
  | { kind: 'asking' }
  | { kind: 'shown'; idea: Idea }
  | { kind: 'none' | 'unavailable' | 'limit' | 'failed' }

export interface SwapTarget {
  date: string
  slot: MealSlot
  /** The planned meal Choose replaces; none on a proposal's slot. */
  replacing?: Id<'plannedDinners'>
  /** What the slot shows now: the meal, or the draft. */
  current?: { title: string; prepMinutes?: number }
}

const altKey = (alt: Pick<Alternative, 'recipeId' | 'mealEntryId' | 'title'>) =>
  alt.recipeId ?? alt.mealEntryId ?? alt.title

/**
 * Something else and New idea for one slot: one dialog with two views. It
 * asks once on open for three alternatives from the Group's recipes; a wish
 * or a chip asks again, each ask one smart action. Choose puts an alternative
 * in the slot at once, with Undo. New idea asks for one new recipe; saving
 * makes it an ordinary Recipe and can plan it in the slot.
 */
export function SwapDialog({
  date,
  slot,
  replacing,
  current,
  data,
  onClose,
  onChooseYourself,
}: SwapTarget & {
  data: WeekData
  onClose: () => void
  /** From the Limit card: Pick for this slot. */
  onChooseYourself: () => void
}) {
  const group = useRequiredCurrentGroup()
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const swapWords = words.swap
  const ideaWords = words.idea
  const { show } = useMealPlannerNotices()
  const online = useConvexConnectionState().isWebSocketConnected
  const usage = useQuery(api.aiUsage.today, {})
  const staples = useQuery(api.groceryStaples.list, { groupSlug: group.slug })
  const askSwap = useAction(api.mealIdeas.swap)
  const askIdea = useAction(api.mealIdeas.idea)
  const choose = useMutation(api.mealIdeas.choose)
  const unchoose = useMutation(api.mealIdeas.unchoose)
  const saveIdea = useMutation(api.mealIdeas.saveIdea)

  const [view, setView] = useState<'swap' | 'idea'>('swap')
  const [wish, setWish] = useState('')
  const [chip, setChip] = useState<SwapChip | null>(null)
  const [swap, setSwap] = useState<SwapState>({ kind: 'asking' })
  const [idea, setIdea] = useState<IdeaState>({ kind: 'asking' })
  const [servings, setServings] = useState(1)
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [saving, setSaving] = useState<'plan' | 'only' | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [chooseFailed, setChooseFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const turnedDown = useRef<string[]>([])
  const asked = useRef(false)
  // Only the latest ask may set the state; an older answer arriving late is dropped.
  const swapAsk = useRef(0)
  const ideaAsk = useRef(0)
  const ideaBusy = useRef(false)
  const lastSwapAsk = useRef<string | null>(null)

  const weekday = weekdayInText(date, locale)
  const meal = replacing
    ? data.meals.find((each) => each._id === replacing)
    : mealIn(data.meals, date, slot)
  const people = eatingCount(data, date, slot, meal)
  const busy = slot === 'dinner' ? busyEvent(data.events, date) : undefined
  const subhead = [
    current ? fmt(swapWords.now, { title: current.title }) : null,
    plural(locale, people, words.people),
    busy?.startMinutes !== undefined
      ? fmt(swapWords.busyUntil, {
          time: clock(busy.endMinutes ?? busy.startMinutes + 60),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const usageLeft = left ?? usage?.left ?? null
  const limit = usage?.limit ?? 0
  const stockNames = (staples?.staples ?? []).map((staple) => staple.name)
  const trimmedWish = wish.trim() ? wish.trim().slice(0, WISH_MAX) : undefined
  const ask = { groupSlug: group.slug, date, slot, locale }
  const swapKey = (nextChip: SwapChip | null) =>
    `${trimmedWish ?? ''}|${nextChip ?? ''}`

  const runSwap = (nextChip: SwapChip | null) => {
    if (!online) return
    const id = ++swapAsk.current
    lastSwapAsk.current = swapKey(nextChip)
    setChooseFailed(false)
    setSwap({ kind: 'asking' })
    askSwap({ ...ask, wish: trimmedWish, chip: nextChip ?? undefined })
      .then((result) => {
        if (id !== swapAsk.current) return
        if (result.status === 'limit') {
          setLeft(0)
          setSwap({ kind: 'limit' })
          return
        }
        setLeft(result.left)
        setSwap({
          kind: 'shown',
          alternatives: result.alternatives,
          fallback: result.status === 'fallback',
        })
      })
      .catch(() => {
        if (id === swapAsk.current) setSwap({ kind: 'failed' })
      })
  }

  // Not while an ask is out, and not for the wish and chip already showing:
  // each ask costs a smart action.
  const onWish = () => {
    if (swap.kind === 'asking') return
    if (swap.kind === 'shown' && lastSwapAsk.current === swapKey(chip)) return
    runSwap(chip)
  }

  // One ask when the dialog opens, or as soon as it is back online.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `online` is the only signal; the ref keeps it to one ask
  useEffect(() => {
    if (asked.current || !online) return
    asked.current = true
    runSwap(chip)
  }, [online])

  const runIdea = () => {
    setView('idea')
    if (!online || ideaBusy.current) return
    const id = ++ideaAsk.current
    ideaBusy.current = true
    setSaveFailed(false)
    setIdea({ kind: 'asking' })
    askIdea({
      ...ask,
      wish: trimmedWish,
      chip: chip ?? undefined,
      avoidTitles: turnedDown.current,
    })
      .then((result) => {
        if (id !== ideaAsk.current) return
        if (result.status === 'limit') {
          setLeft(0)
          setIdea({ kind: 'limit' })
          return
        }
        setLeft(result.left)
        if (result.status !== 'ai') {
          setIdea({ kind: result.status })
          return
        }
        turnedDown.current = [...turnedDown.current, result.idea.title].slice(-10)
        setServings(result.idea.servings)
        setIdea({ kind: 'shown', idea: result.idea })
      })
      .catch(() => {
        if (id === ideaAsk.current) setIdea({ kind: 'failed' })
      })
      .finally(() => {
        if (id === ideaAsk.current) ideaBusy.current = false
      })
  }

  const onChoose = (alt: Alternative) => {
    const key = altKey(alt)
    if (!online || choosing || chosen?.key === key) return
    setChooseFailed(false)
    setChoosing(key)
    choose({
      groupSlug: group.slug,
      date,
      slot,
      recipeId: alt.recipeId,
      mealEntryId: alt.mealEntryId,
      replaceId: chosen?.id ?? replacing,
    })
      .then((result) =>
        setChosen({
          key,
          id: result.id,
          recipeId: alt.recipeId,
          mealEntryId: alt.mealEntryId,
          title: alt.title,
          previous: chosen ? chosen.previous : result.previous,
        }),
      )
      // The slot changed meanwhile: the alternatives stay and the line says
      // nothing changed; the week catches up on its own.
      .catch(() => setChooseFailed(true))
      .finally(() => setChoosing(null))
  }

  const onUndo = () => {
    if (!chosen || !online) return
    const was = chosen
    setChosen(null)
    setChooseFailed(false)
    unchoose({
      groupSlug: group.slug,
      id: was.id,
      chosen: { recipeId: was.recipeId, mealEntryId: was.mealEntryId },
      previous: was.previous,
    }).catch(() => {
      setChosen(was)
      setChooseFailed(true)
    })
  }

  const rowsOf = (shown: Idea) =>
    ideaRows({
      idea: shown,
      servings,
      stockNames,
      locale,
      units: t.tasks.grocery.units,
    })

  const onSave = (shown: Idea, plan: boolean) => {
    if (saving || !online) return
    setSaveFailed(false)
    setSaving(plan ? 'plan' : 'only')
    const { title } = shown
    saveIdea({
      groupSlug: group.slug,
      title,
      ingredients: rowsOf(shown).map((row) => row.line),
      steps: shown.steps,
      prepMinutes: shown.prepMinutes,
      servings,
      plan: plan
        ? { date, slot, replaceId: chosen?.id ?? replacing }
        : undefined,
    })
      .then((result) => {
        onClose()
        show({
          message: !plan
            ? fmt(ideaWords.saved, { title })
            : result.mealId
              ? fmt(ideaWords.savedPlanned, {
                  weekday: sentenceCase(weekday),
                  title,
                })
              : fmt(ideaWords.takenMeanwhile, { title, weekday }),
        })
      })
      // The idea stays: it cost an action, and saving again should not.
      .catch(() => setSaveFailed(true))
      .finally(() => setSaving(null))
  }

  const cost =
    usageLeft !== null && limit > 0 ? (
      <p className="m-0 text-center text-footnote text-[var(--muted)]">
        {fmt(swapWords.cost, { left: usageLeft, limit })}
      </p>
    ) : null
  const limitCard = (
    <LimitCard used={limit} limit={limit} onChooseYourself={onChooseYourself} />
  )
  const offline = online ? null : (
    <p role="status" className="m-0 text-subhead text-[var(--muted)]">
      {words.plan.offline}
    </p>
  )
  const failure = (text: string) => (
    <p role="alert" className="m-0 text-subhead font-semibold text-[var(--danger)]">
      {text}
    </p>
  )
  const working = (text: string) => (
    <p role="status" aria-busy="true" className="m-0 py-4 text-center text-subhead text-[var(--muted)]">
      {text}
    </p>
  )

  if (view === 'idea') {
    return (
      <Dialog
        title={ideaWords.title}
        onClose={onClose}
        actions={
          idea.kind === 'limit' || idea.kind === 'asking' ? undefined : (
            <div className="grid w-full gap-2">
              {saveFailed ? failure(ideaWords.failed) : null}
              {idea.kind === 'shown' ? (
                <button
                  type="button"
                  disabled={saving !== null || !online}
                  onClick={() => onSave(idea.idea, true)}
                  className={`${buttonClass.primary} w-full`}
                >
                  {saving === 'plan'
                    ? t.common.actions.working
                    : fmt(ideaWords.savePlan, { weekday })}
                </button>
              ) : null}
              <div className="flex flex-wrap gap-2 *:flex-1">
                {idea.kind === 'shown' ? (
                  <button
                    type="button"
                    disabled={saving !== null || !online}
                    onClick={() => onSave(idea.idea, false)}
                    className={buttonClass.secondary}
                  >
                    {saving === 'only'
                      ? t.common.actions.working
                      : ideaWords.saveOnly}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving !== null || !online}
                  onClick={runIdea}
                  className={buttonClass.secondary}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {ideaWords.another}
                </button>
              </div>
              {idea.kind === 'shown' ? (
                <p className="m-0 text-center text-footnote text-[var(--muted)]">
                  {fmt(ideaWords.saveNote, { group: group.name })}
                </p>
              ) : (
                cost
              )}
            </div>
          )
        }
      >
        <div>
          <button
            type="button"
            onClick={() => setView('swap')}
            className="inline-flex min-h-[var(--size-control-min)] cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-subhead font-semibold text-[var(--kitchen-text)]"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {ideaWords.back}
          </button>
        </div>
        {idea.kind === 'limit' ? limitCard : null}
        {offline}
        {idea.kind === 'asking' && online ? working(ideaWords.working) : null}
        {idea.kind === 'none' || idea.kind === 'unavailable' ? (
          <div
            role="status"
            className="grid gap-1 rounded-[var(--radius-control)] bg-[var(--ground)] p-4"
          >
            <p className="m-0 text-body font-semibold">
              {idea.kind === 'none'
                ? ideaWords.noneTitle
                : ideaWords.unavailableTitle}
            </p>
            <p className="m-0 text-subhead text-[var(--muted)]">
              {idea.kind === 'none'
                ? ideaWords.noneBody
                : ideaWords.unavailableBody}
            </p>
          </div>
        ) : null}
        {idea.kind === 'failed' ? failure(ideaWords.askFailed) : null}
        {idea.kind === 'shown' ? (
          <IdeaDraft
            idea={idea.idea}
            servings={servings}
            rows={rowsOf(idea.idea)}
            onServings={setServings}
          />
        ) : null}
      </Dialog>
    )
  }

  return (
    <Dialog title={fmt(swapWords.title, { weekday })} onClose={onClose}>
      <p className="m-0 text-subhead text-[var(--muted)]">{subhead}</p>
      {swap.kind === 'limit' ? (
        limitCard
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onWish()
            }}
          >
            <input
              value={wish}
              maxLength={WISH_MAX}
              disabled={!online}
              aria-label={swapWords.wish}
              placeholder={swapWords.wishPlaceholder}
              enterKeyHint="search"
              onChange={(event) => setWish(event.target.value)}
              className={inputClass}
            />
          </form>
          <div className="flex flex-wrap gap-2">
            {SWAP_CHIPS.map((key) => (
              <Chip
                key={key}
                label={swapWords.chips[key]}
                on={chip === key}
                disabled={!online || swap.kind === 'asking'}
                onClick={() => {
                  const next = chip === key ? null : key
                  setChip(next)
                  runSwap(next)
                }}
              />
            ))}
          </div>

          {offline}
          {swap.kind === 'asking' && online ? working(swapWords.working) : null}
          {swap.kind === 'failed' || chooseFailed
            ? failure(swapWords.failed)
            : null}
          {swap.kind === 'shown' && swap.fallback ? (
            <p className="m-0 flex gap-2 rounded-[var(--radius-control)] bg-[var(--surface-2)] p-3 text-footnote">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              {swapWords.fallbackBody}
            </p>
          ) : null}
          {swap.kind === 'shown' && swap.alternatives.length === 0 ? (
            <p className="m-0 text-subhead text-[var(--muted)]">
              {swapWords.none}
            </p>
          ) : null}
          {swap.kind === 'shown' && swap.alternatives.length > 0 ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {swap.alternatives.map((alt) => {
                const key = altKey(alt)
                const reason = swapReason(alt, words, locale)
                const isChosen = chosen?.key === key
                const meta = [
                  alt.prepMinutes
                    ? fmt(words.minutes, { minutes: alt.prepMinutes })
                    : null,
                  alt.recipeId
                    ? alt.rating
                      ? fmt(words.pick.stars, { rating: alt.rating })
                      : null
                    : swapWords.quickMeal,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li
                    key={key}
                    className={`flex items-center gap-3 rounded-[var(--radius-control)] border bg-[var(--ground)] p-3 ${
                      isChosen
                        ? 'border-[var(--kitchen-text)]'
                        : 'border-transparent'
                    }`}
                  >
                    <MealThumb imageUrl={alt.imageUrl} quick={!alt.recipeId} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold break-words">
                        {alt.title}
                      </span>
                      {meta ? (
                        <span className="block text-footnote text-[var(--muted)]">
                          {meta}
                        </span>
                      ) : null}
                      {reason ? (
                        <span className="block text-footnote">{reason}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label={fmt(swapWords.chooseLabel, {
                        title: alt.title,
                        day: weekday,
                      })}
                      aria-pressed={isChosen}
                      aria-busy={choosing === key}
                      disabled={choosing !== null || !online}
                      onClick={() => onChoose(alt)}
                      className={`min-h-[var(--size-control-min)] shrink-0 rounded-[var(--radius-pill)] px-4 text-subhead font-semibold disabled:opacity-60 ${
                        isChosen
                          ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                          : 'bg-[var(--surface-2)] text-[var(--ink)]'
                      }`}
                    >
                      {isChosen ? swapWords.chosen : swapWords.choose}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div role="status">
            {chosen ? (
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-4 py-2 text-subhead">
                {current
                  ? fmt(swapWords.chosenToast, {
                      weekday: sentenceCase(weekday),
                      new: chosen.title,
                      old: current.title,
                    })
                  : fmt(swapWords.chosenToastEmpty, {
                      weekday: sentenceCase(weekday),
                      new: chosen.title,
                    })}
                <button
                  type="button"
                  disabled={!online}
                  onClick={onUndo}
                  className="min-h-[var(--size-control-min)] cursor-pointer border-0 bg-transparent px-2 font-semibold text-[var(--ink)]"
                >
                  {swapWords.undo}
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!online}
            // Back from an idea and in again shows the same idea.
            onClick={() =>
              idea.kind === 'shown' ? setView('idea') : runIdea()
            }
            className="flex min-h-[var(--size-row-min)] items-center gap-3 rounded-[var(--radius-control)] bg-[var(--ground)] p-3 text-left disabled:opacity-60"
          >
            <Sparkles
              className="size-5 shrink-0 text-[var(--kitchen-text)]"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">
                {swapWords.newIdea}
              </span>
              <span className="block text-footnote text-[var(--muted)]">
                {swapWords.newIdeaSub}
              </span>
            </span>
            <ChevronRight
              className="size-4 text-[var(--muted)]"
              aria-hidden="true"
            />
          </button>
          {cost}
        </>
      )}
    </Dialog>
  )
}

/** The idea as a draft recipe: what it is, its amounts, its steps. */
function IdeaDraft({
  idea,
  servings,
  rows,
  onServings,
}: {
  idea: Idea
  servings: number
  rows: IdeaRow[]
  onServings: (servings: number) => void
}) {
  const words = useI18n().messages.mealPlanner.idea
  const facts = [
    { value: idea.prepMinutes ?? '–', label: words.minutes },
    { value: servings, label: words.people },
    { value: idea.ingredients.length, label: words.ingredients },
  ]
  return (
    <>
      <div className="grid gap-1">
        <p className="m-0 flex items-center gap-1.5 text-footnote font-semibold text-[var(--kitchen-text)]">
          <Sparkles className="size-3" aria-hidden="true" />
          {words.eyebrow}
        </p>
        <h3 className="m-0 font-rounded text-title-2 font-bold break-words">
          {idea.title}
        </h3>
        {idea.why ? (
          <p className="m-0 text-subhead text-[var(--muted)]">{idea.why}</p>
        ) : null}
      </div>
      <dl className="m-0 grid grid-cols-3 rounded-[var(--radius-control)] bg-[var(--ground)] py-3 text-center">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col-reverse [&+&]:border-l-[0.5px] [&+&]:border-[var(--hair)]"
          >
            <dt className="text-footnote text-[var(--muted)]">{fact.label}</dt>
            <dd className="m-0 font-rounded text-title-2 font-bold tabular-nums">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3">
        <h4 className={labelClass}>{words.ingredientsHeading}</h4>
        <Stepper
          label={words.people}
          value={servings}
          less={words.fewer}
          more={words.more}
          canLess={servings > IDEA_SERVINGS.min}
          canMore={servings < IDEA_SERVINGS.max}
          onLess={() => onServings(servings - 1)}
          onMore={() => onServings(servings + 1)}
        />
      </div>
      <ul className="m-0 list-none rounded-[var(--radius-control)] bg-[var(--ground)] px-3 py-0">
        {rows.map((row, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: an idea's ingredients never move, and a name may repeat
            key={index}
            className="flex min-h-10 items-center gap-3 py-2 text-subhead [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
          >
            <span className="min-w-0 flex-1">
              {row.name}
              {row.inStock ? (
                <span className="text-footnote text-[var(--muted)]">
                  {' · '}
                  {words.inStock}
                </span>
              ) : null}
            </span>
            {row.amount ? (
              <span className="shrink-0 font-semibold tabular-nums">
                {row.amount}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <h4 className={labelClass}>{words.steps}</h4>
      <ol className="m-0 grid gap-2 pl-5 text-subhead">
        {idea.steps.map((step, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: steps are in order and never move
          <li key={index}>{step}</li>
        ))}
      </ol>
      <p className="m-0 text-footnote text-[var(--muted)]">{words.footnote}</p>
    </>
  )
}
