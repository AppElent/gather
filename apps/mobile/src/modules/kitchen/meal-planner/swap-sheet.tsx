/**
 * Iets anders and Nieuw idee (designs/meal-planner §4, APP-320): one sheet
 * with two views. Swap asks once on open for three alternatives from the
 * Group's recipes; a wish or one of the three chips asks again, each ask one
 * slimme actie. Kies puts an alternative in the slot at once, with Undo.
 * Nieuw idee asks for one new recipe as a draft; saving makes it an ordinary
 * Recipe tagged AI and, with Bewaar en zet op, plans it in the slot. Over the
 * day's cap both show the Limit card, whose Zelf kiezen opens Pick.
 */
import {
  formatGroceryAmount,
  GROCERY_UNITS,
  type GroceryUnit,
  groceryLineText,
  scaleGroceryQuantity,
} from '@gather/core/groceries'
import { SWAP_CHIPS, type SwapChip } from '@gather/core/meal-ideas'
import type { MealSlot } from '@gather/core/meal-planner'
import { stockUsed, WISH_MAX } from '@gather/core/week-plan'
import { useAction, useConvexConnectionState, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { NativeSheet } from '../../../components/NativeSheet'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { useSheetDraft } from '../../../ui/sheet-drafts'
import { Chip, MealThumb } from './parts'
import { LimitCard, PrimaryButton } from './plan-sheet'
import {
  busyEvent,
  clock,
  eatersOf,
  mealIn,
  sentenceCase,
  servingsOf,
  type WeekData,
  weekdayInText,
} from './week'
import { swapReason } from './week-plan'

type SwapAnswer = FunctionReturnType<typeof api.mealIdeas.swap>
type Alternative = Extract<SwapAnswer, { alternatives: unknown }>['alternatives'][number]
type IdeaAnswer = FunctionReturnType<typeof api.mealIdeas.idea>
type Idea = Extract<IdeaAnswer, { idea: unknown }>['idea']
type Snapshot = FunctionReturnType<typeof api.mealIdeas.choose>['previous']

/** What Kies put in the slot, for Undo and for the next Kies. */
interface Chosen {
  key: string
  id: Id<'plannedDinners'>
  recipeId?: Id<'recipes'>
  mealEntryId?: Id<'mealEntries'>
  title: string
  /** The slot before the first Kies: Undo puts it back. */
  previous: Snapshot
}

type SwapState =
  | { kind: 'asking' }
  | { kind: 'shown'; alternatives: Alternative[]; fallback: boolean }
  | { kind: 'limit' }
  | { kind: 'failed' }

/** What a share keeps of the sheet (`useSheetDraft`). */
interface SwapDraft {
  view: 'swap' | 'idea'
  wish: string
  chip: SwapChip | null
  swap?: SwapState
  idea?: IdeaState
  servings: number
  chosen: Chosen | null
  turnedDown: string[]
  lastSwapAsk: string | null
}

type IdeaState =
  | { kind: 'asking' }
  | { kind: 'shown'; idea: Idea }
  | { kind: 'none' | 'unavailable' | 'limit' | 'failed' }

const altKey = (alt: Pick<Alternative, 'recipeId' | 'mealEntryId' | 'title'>) =>
  alt.recipeId ?? alt.mealEntryId ?? alt.title

const UNITS = new Set<string>(GROCERY_UNITS)
const asUnit = (unit: string | undefined) =>
  unit && UNITS.has(unit) ? (unit as GroceryUnit) : undefined

export function SwapSheet({
  date,
  slot,
  replacing,
  current,
  data,
  onClose,
  onChooseYourself,
  onSaved,
}: {
  date: string
  slot: MealSlot
  /** The planned meal Kies replaces; none on a proposal's draft slot. */
  replacing?: Id<'plannedDinners'>
  /** What the slot shows now: the meal, or the draft. */
  current?: { title: string; prepMinutes?: number }
  data: WeekData
  onClose: () => void
  /** Zelf kiezen from the Limit card. */
  onChooseYourself: () => void
  /** After Bewaren, with the screen toast's words. */
  onSaved: (message: string) => void
}) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const swapWords = words.swap
  const ideaWords = words.idea
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const online = useConvexConnectionState().isWebSocketConnected
  const usage = useQuery(api.aiUsage.today, {})
  const staples = useQuery(api.groceryStaples.list, { groupSlug: group.slug })
  const askSwap = useAction(api.mealIdeas.swap)
  const askIdea = useAction(api.mealIdeas.idea)
  const choose = useMutation(api.mealIdeas.choose)
  const unchoose = useMutation(api.mealIdeas.unchoose)
  const saveIdea = useMutation(api.mealIdeas.saveIdea)

  // A share keeps the wish and the answers already paid for (APP-622): a kept
  // answer is shown again rather than asked for again.
  const draft = useSheetDraft<SwapDraft>(`meal-planner:swap:${date}:${slot}`)
  const kept = draft.kept
  const [view, setView] = useState<'swap' | 'idea'>(
    // An idea still being asked for is not kept: back to the swaps.
    kept?.idea ? kept.view : 'swap',
  )
  const [wish, setWish] = useState(kept?.wish ?? '')
  const [chip, setChip] = useState<SwapChip | null>(kept?.chip ?? null)
  const [swap, setSwap] = useState<SwapState>(kept?.swap ?? { kind: 'asking' })
  const [idea, setIdea] = useState<IdeaState>(kept?.idea ?? { kind: 'asking' })
  const [servings, setServings] = useState(kept?.servings ?? 1)
  const [chosen, setChosen] = useState<Chosen | null>(kept?.chosen ?? null)
  const [choosing, setChoosing] = useState<string | null>(null)
  const [saving, setSaving] = useState<'plan' | 'only' | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [chooseFailed, setChooseFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const turnedDown = useRef<string[]>(kept?.turnedDown ?? [])
  const asked = useRef(kept?.swap !== undefined)
  // Only the latest ask may set the state; an older answer arriving late is dropped.
  const swapAsk = useRef(0)
  const ideaAsk = useRef(0)
  const ideaBusy = useRef(false)
  const lastSwapAsk = useRef<string | null>(kept?.lastSwapAsk ?? null)
  // Only a shown answer is worth keeping; one still out is asked again.
  draft.track(
    {
      view,
      wish,
      chip,
      swap: swap.kind === 'shown' ? swap : undefined,
      idea: idea.kind === 'shown' ? idea : undefined,
      servings,
      chosen,
      turnedDown: turnedDown.current,
      lastSwapAsk: lastSwapAsk.current,
    },
    { holding: saving !== null || choosing !== null },
  )

  const weekday = weekdayInText(date, locale)
  const meal = replacing ? data.meals.find((m) => m._id === replacing) : mealIn(data.meals, date, slot)
  const eaters = eatersOf(data, date, slot, meal?.eaterIds)
  const people = servingsOf(data, meal?.servings, eaters.length)
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

  const swapKey = (nextChip: SwapChip | null) => `${trimmedWish ?? ''}|${nextChip ?? ''}`

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
          haptics.actionFailed()
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
        if (id !== swapAsk.current) return
        haptics.actionFailed()
        setSwap({ kind: 'failed' })
      })
  }

  // The wish asks again on return, but not while an ask is out, and not for
  // the same wish and chip that are already showing: each ask costs a call.
  const onWish = () => {
    if (swap.kind === 'asking') return
    if (swap.kind === 'shown' && lastSwapAsk.current === swapKey(chip)) return
    runSwap(chip)
  }

  // One ask when the sheet opens, or as soon as it is back online.
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
          haptics.actionFailed()
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
        if (id !== ideaAsk.current) return
        haptics.actionFailed()
        setIdea({ kind: 'failed' })
      })
      .finally(() => {
        if (id === ideaAsk.current) ideaBusy.current = false
      })
  }

  const onChip = (next: SwapChip) => {
    haptics.selectionChanged()
    const value = chip === next ? null : next
    setChip(value)
    runSwap(value)
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
      .then((result) => {
        haptics.itemSaved()
        setChosen({
          key,
          id: result.id,
          recipeId: alt.recipeId,
          mealEntryId: alt.mealEntryId,
          title: alt.title,
          previous: chosen ? chosen.previous : result.previous,
        })
      })
      .catch(() => {
        // The slot changed under us (filled, deleted, recipe unshared): the
        // alternatives stay, the message says nothing changed, and the week
        // query catches up on its own.
        haptics.actionFailed()
        draft.failed()
        setChooseFailed(true)
      })
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
      haptics.actionFailed()
      setChosen(was)
      setChooseFailed(true)
    })
  }

  const scaled = (shown: Idea) =>
    shown.ingredients.map((ingredient) => {
      const unit = asUnit(ingredient.unit)
      const quantity =
        ingredient.quantity === undefined
          ? undefined
          : scaleGroceryQuantity(ingredient.quantity, unit, servings / shown.servings)
      const amount =
        quantity === undefined
          ? null
          : unit || !ingredient.unit
            ? (formatGroceryAmount(quantity, unit, locale, t.tasks.grocery.units) ??
              String(quantity))
            : `${quantity} ${ingredient.unit}`
      const line =
        quantity === undefined
          ? ingredient.name
          : unit || !ingredient.unit
            ? groceryLineText(ingredient.name, quantity, unit)
            : `${quantity} ${ingredient.unit} ${ingredient.name}`
      return {
        name: ingredient.name,
        amount,
        line,
        inStock: stockUsed({ ingredients: [ingredient.name] }, stockNames).length > 0,
      }
    })

  const onSave = (shown: Idea, plan: boolean) => {
    if (saving || !online) return
    setSaveFailed(false)
    setSaving(plan ? 'plan' : 'only')
    saveIdea({
      groupSlug: group.slug,
      title: shown.title,
      ingredients: scaled(shown).map((row) => row.line),
      steps: shown.steps,
      prepMinutes: shown.prepMinutes,
      servings,
      plan: plan ? { date, slot, replaceId: chosen?.id ?? replacing } : undefined,
    })
      .then((result) => {
        haptics.itemSaved()
        const title = shown.title
        onSaved(
          !plan
            ? fmt(ideaWords.saved, { title })
            : result.mealId
              ? fmt(ideaWords.savedPlanned, { weekday: sentenceCase(weekday), title })
              : fmt(ideaWords.takenMeanwhile, { title, weekday }),
        )
      })
      .catch(() => {
        // Keep the draft: it cost a call, and saving again should not.
        haptics.actionFailed()
        draft.failed()
        setSaveFailed(true)
      })
      .finally(() => setSaving(null))
  }

  const cost =
    usageLeft !== null && limit > 0 ? (
      <Text style={[styles.footnote, styles.center, { color: tokens.muted }]}>
        {fmt(swapWords.cost, { left: usageLeft, limit })}
      </Text>
    ) : null
  const limitCard = (
    <LimitCard
      used={limit}
      limit={limit}
      testID="swap-limit"
      onChooseYourself={onChooseYourself}
    />
  )
  const offline = !online ? (
    <Text accessibilityLiveRegion="polite" style={[styles.subhead, styles.center, { color: tokens.muted }]}>
      {words.plan.offline}
    </Text>
  ) : null

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ideaWords.back}
      testID="idea-back"
      onPress={() => setView('swap')}
      hitSlop={12}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <UI_ICONS.ChevronLeft size={20} color={tint.text} strokeWidth={2.4} />
      <Text style={[styles.backLabel, { color: tint.text }]}>{ideaWords.back}</Text>
    </Pressable>
  )

  return (
    <NativeSheet
      title={view === 'swap' ? fmt(swapWords.title, { weekday }) : ideaWords.title}
      subtitle={view === 'swap' ? subhead : undefined}
      leading={view === 'idea' ? back : undefined}
      onClose={onClose}
      maxHeight={0.92}
      fill
      background="ground"
    >
      {view === 'swap' ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          testID="swap-sheet"
        >
          {swap.kind === 'limit' ? (
            limitCard
          ) : (
            <>
              <View style={styles.section}>
                <View style={[styles.wish, { backgroundColor: tokens.surface }]}>
                  <UI_ICONS.Spark size={18} color={tokens.muted} strokeWidth={2} />
                  <TextInput
                    testID="swap-wish"
                    value={wish}
                    onChangeText={setWish}
                    onSubmitEditing={onWish}
                    maxLength={WISH_MAX}
                    placeholder={swapWords.wishPlaceholder}
                    placeholderTextColor={tokens.muted}
                    accessibilityLabel={swapWords.wish}
                    returnKeyType="search"
                    editable={online}
                    style={[styles.wishInput, { color: tokens.ink }]}
                  />
                </View>
                <View style={styles.chips}>
                  {SWAP_CHIPS.map((key) => (
                    <Chip
                      key={key}
                      label={swapWords.chips[key]}
                      on={chip === key}
                      testID={`swap-chip-${key}`}
                      onPress={() => online && swap.kind !== 'asking' && onChip(key)}
                    />
                  ))}
                </View>
              </View>

              {offline}
              {swap.kind === 'asking' && online ? (
                <View style={styles.working} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={tokens.muted} />
                  <Text style={[styles.subhead, { color: tokens.muted }]}>{swapWords.working}</Text>
                </View>
              ) : null}
              {swap.kind === 'failed' || chooseFailed ? (
                <Text accessibilityLiveRegion="polite" style={[styles.subhead, styles.center, { color: tokens.danger }]}>
                  {swapWords.failed}
                </Text>
              ) : null}
              {swap.kind === 'shown' && swap.fallback ? (
                <View style={[styles.note, { backgroundColor: tokens.surface2 }]} testID="swap-fallback">
                  <UI_ICONS.Clock size={16} color={tokens.ink} strokeWidth={2.2} />
                  <Text style={[styles.footnoteFlex, { color: tokens.ink }]}>{swapWords.fallbackBody}</Text>
                </View>
              ) : null}
              {swap.kind === 'shown' && swap.alternatives.length === 0 ? (
                <Text style={[styles.subhead, styles.center, { color: tokens.muted }]}>{swapWords.none}</Text>
              ) : null}
              {swap.kind === 'shown' ? (
                <View style={styles.cards}>
                  {swap.alternatives.map((alt) => {
                    const key = altKey(alt)
                    const reason = swapReason(alt, words, locale)
                    const isChosen = chosen?.key === key
                    const meta = [
                      alt.prepMinutes ? fmt(words.minutes, { minutes: alt.prepMinutes }) : null,
                      alt.recipeId
                        ? alt.rating
                          ? fmt(words.pick.stars, { rating: alt.rating })
                          : null
                        : swapWords.quickMeal,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <View
                        key={key}
                        testID={`swap-alt-${key}`}
                        style={[
                          styles.alt,
                          {
                            backgroundColor: tokens.surface,
                            borderColor: isChosen ? tint.text : 'transparent',
                          },
                        ]}
                      >
                        <MealThumb imageUrl={alt.imageUrl} quick={!alt.recipeId} />
                        <View style={styles.altText}>
                          <Text style={[styles.altTitle, { color: tokens.ink }]}>{alt.title}</Text>
                          {meta ? (
                            <Text style={[styles.meta, { color: tokens.muted }]}>{meta}</Text>
                          ) : null}
                          {reason ? (
                            <Text testID={`swap-reason-${key}`} style={[styles.meta, { color: tokens.ink }]}>
                              {reason}
                            </Text>
                          ) : null}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={fmt(swapWords.chooseLabel, { title: alt.title, day: weekday })}
                          accessibilityState={{ selected: isChosen, busy: choosing === key }}
                          testID={`swap-choose-${key}`}
                          disabled={choosing !== null || !online}
                          onPress={() => onChoose(alt)}
                          style={({ pressed }) => [
                            styles.choose,
                            { backgroundColor: isChosen ? tokens.accent : tokens.surface2 },
                            !online && styles.inert,
                            pressed && styles.pressed,
                          ]}
                        >
                          {choosing === key ? (
                            <ActivityIndicator size="small" color={tokens.ink} />
                          ) : (
                            <Text
                              maxFontSizeMultiplier={1.6}
                              style={[styles.chooseLabel, { color: isChosen ? tokens.onAccent : tokens.ink }]}
                            >
                              {isChosen ? swapWords.chosen : swapWords.choose}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
              ) : null}

              {chosen ? (
                <View
                  accessibilityRole="alert"
                  testID="swap-toast"
                  style={[styles.toast, { backgroundColor: tokens.ink }]}
                >
                  <Text style={[styles.toastText, { color: tokens.onInk }]}>
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
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    testID="swap-undo"
                    disabled={!online}
                    onPress={onUndo}
                    hitSlop={8}
                    style={({ pressed }) => [styles.undo, !online && styles.inert, pressed && styles.pressed]}
                  >
                    <Text style={[styles.undoLabel, { color: tokens.onInk }]}>{swapWords.undo}</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                testID="swap-new-idea"
                disabled={!online}
                // Back from an idea and in again shows the same idea; Ander idee asks anew.
                onPress={() => (idea.kind === 'shown' ? setView('idea') : runIdea())}
                style={({ pressed }) => [
                  styles.ideaRow,
                  { backgroundColor: tokens.surface },
                  !online && styles.inert,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.ideaTile, { backgroundColor: tint.wash }]}>
                  <UI_ICONS.Spark size={16} color={tint.text} strokeWidth={2} />
                </View>
                <View style={styles.altText}>
                  <Text style={[styles.altTitle, { color: tokens.ink }]}>{swapWords.newIdea}</Text>
                  <Text style={[styles.meta, { color: tokens.muted }]}>{swapWords.newIdeaSub}</Text>
                </View>
                <UI_ICONS.ChevronRight size={16} color={tokens.muted} strokeWidth={2.6} />
              </Pressable>
              {cost}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} testID="idea-sheet">
          {idea.kind === 'limit' ? limitCard : null}
          {offline}
          {idea.kind === 'asking' && online ? (
            <View style={styles.working} accessibilityLiveRegion="polite">
              <ActivityIndicator color={tokens.muted} />
              <Text style={[styles.subhead, { color: tokens.muted }]}>{ideaWords.working}</Text>
            </View>
          ) : null}
          {idea.kind === 'none' || idea.kind === 'unavailable' ? (
            <View style={[styles.card, { backgroundColor: tokens.surface }]} testID={`idea-${idea.kind}`}>
              <Text style={[styles.altTitle, { color: tokens.ink }]}>
                {idea.kind === 'none' ? ideaWords.noneTitle : ideaWords.unavailableTitle}
              </Text>
              <Text style={[styles.subhead, { color: tokens.muted }]}>
                {idea.kind === 'none' ? ideaWords.noneBody : ideaWords.unavailableBody}
              </Text>
            </View>
          ) : null}
          {idea.kind === 'failed' ? (
            <Text accessibilityLiveRegion="polite" style={[styles.subhead, styles.center, { color: tokens.danger }]}>
              {ideaWords.askFailed}
            </Text>
          ) : null}
          {idea.kind === 'shown' ? (
            <IdeaDraft
              idea={idea.idea}
              servings={servings}
              rows={scaled(idea.idea)}
              onServings={setServings}
            />
          ) : null}
          {idea.kind !== 'limit' && idea.kind !== 'asking' ? (
            <View style={styles.section}>
              {saveFailed ? (
                <Text
                  accessibilityLiveRegion="polite"
                  testID="idea-save-failed"
                  style={[styles.subhead, styles.center, { color: tokens.danger }]}
                >
                  {ideaWords.failed}
                </Text>
              ) : null}
              {idea.kind === 'shown' ? (
                <PrimaryButton
                  label={fmt(ideaWords.savePlan, { weekday })}
                  testID="idea-save-plan"
                  busy={saving === 'plan'}
                  disabled={saving !== null || !online}
                  onPress={() => onSave(idea.idea, true)}
                  minHeight={50}
                />
              ) : null}
              <View style={styles.row}>
                {idea.kind === 'shown' ? (
                  <SecondaryButton
                    label={ideaWords.saveOnly}
                    testID="idea-save-only"
                    busy={saving === 'only'}
                    disabled={saving !== null || !online}
                    onPress={() => onSave(idea.idea, false)}
                  />
                ) : null}
                <SecondaryButton
                  label={ideaWords.another}
                  testID="idea-another"
                  icon
                  disabled={!online || saving !== null}
                  onPress={runIdea}
                />
              </View>
              {idea.kind === 'shown' ? (
                <Text style={[styles.footnote, styles.center, { color: tokens.muted }]}>
                  {fmt(ideaWords.saveNote, { group: group.name })}
                </Text>
              ) : (
                cost
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </NativeSheet>
  )
}

/** The idea as a draft recipe: eyebrow, title, why, facts, ingredients, steps. */
function IdeaDraft({
  idea,
  servings,
  rows,
  onServings,
}: {
  idea: Idea
  servings: number
  rows: { name: string; amount: string | null; inStock: boolean }[]
  onServings: (servings: number) => void
}) {
  const { t } = useI18n()
  const words = t.mealPlanner.idea
  const tokens = useTokens('kitchen')
  const tint = tokens.tintOf('kitchen')
  const facts = [
    { value: idea.prepMinutes ?? '–', label: words.minutes },
    { value: servings, label: words.people },
    { value: idea.ingredients.length, label: words.ingredients },
  ]
  return (
    <>
      <View style={styles.headline}>
        <View style={styles.eyebrow}>
          <UI_ICONS.Spark size={12} color={tint.text} strokeWidth={2.4} />
          <Text style={[styles.eyebrowText, { color: tint.text }]}>{words.eyebrow}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.recordTitle, { color: tokens.ink }]}>
          {idea.title}
        </Text>
        {idea.why ? (
          <Text style={[styles.subhead, { color: tokens.muted }]}>{idea.why}</Text>
        ) : null}
      </View>
      <View style={[styles.facts, { backgroundColor: tokens.surface }]}>
        {facts.map((fact, index) => (
          <View
            key={fact.label}
            accessible
            style={[
              styles.fact,
              index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: tokens.hair },
            ]}
          >
            <Text style={[styles.factValue, { color: tokens.ink }]}>{fact.value}</Text>
            <Text style={[styles.meta, { color: tokens.muted }]}>{fact.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={[styles.heading, styles.grow, { color: tokens.muted }]}>
            {words.ingredientsHeading}
          </Text>
          <Stepper
            label={words.fewer}
            testID="idea-fewer"
            disabled={servings <= 1}
            onPress={() => onServings(Math.max(1, servings - 1))}
            Icon={UI_ICONS.Minus}
          />
          <Stepper
            label={words.more}
            testID="idea-more"
            disabled={servings >= 20}
            onPress={() => onServings(Math.min(20, servings + 1))}
            Icon={UI_ICONS.Plus}
          />
        </View>
        <View style={[styles.list, { backgroundColor: tokens.surface }]}>
          {rows.map((row, index) => (
            <View
              key={`${row.name}-${index}`}
              style={[
                styles.listRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.hair },
              ]}
            >
              <Text style={[styles.body, styles.grow, { color: tokens.ink }]}>{row.name}</Text>
              {row.inStock ? (
                <Text style={[styles.meta, { color: tokens.muted }]}>{words.inStock}</Text>
              ) : null}
              {row.amount ? (
                <Text style={[styles.amount, { color: tokens.ink }]}>{row.amount}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.heading, { color: tokens.muted }]}>
          {words.steps}
        </Text>
        <View style={[styles.list, { backgroundColor: tokens.surface }]}>
          {idea.steps.map((step, index) => (
            <View
              key={`${index}-${step.slice(0, 12)}`}
              style={[
                styles.stepRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.hair },
              ]}
            >
              <Text style={[styles.stepNumber, { color: tint.text }]}>{index + 1}</Text>
              <Text style={[styles.body, styles.grow, { color: tokens.ink }]}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[styles.footnote, { color: tokens.muted }]} testID="idea-footnote">
        {words.footnote}
      </Text>
    </>
  )
}

function Stepper({
  label,
  testID,
  disabled,
  onPress,
  Icon,
}: {
  label: string
  testID: string
  disabled: boolean
  onPress: () => void
  Icon: (typeof UI_ICONS)[keyof typeof UI_ICONS]
}) {
  const tokens = useTokens('kitchen')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        haptics.selectionChanged()
        onPress()
      }}
      style={({ pressed }) => [
        styles.stepper,
        { backgroundColor: tokens.surface },
        disabled && styles.inert,
        pressed && styles.pressed,
      ]}
    >
      <Icon size={14} color={tokens.ink} strokeWidth={2.6} />
    </Pressable>
  )
}

function SecondaryButton({
  label,
  testID,
  onPress,
  disabled = false,
  busy = false,
  icon = false,
}: {
  label: string
  testID: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  icon?: boolean
}) {
  const tokens = useTokens('kitchen')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        { backgroundColor: tokens.surface },
        (disabled || busy) && styles.inert,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tokens.ink} />
      ) : icon ? (
        <UI_ICONS.Regenerate size={16} color={tokens.ink} strokeWidth={2.2} />
      ) : null}
      <Text maxFontSizeMultiplier={2} style={[styles.body, styles.shrink, { color: tokens.ink }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { gap: SPACE[4], paddingTop: SPACE[4], paddingBottom: SPACE[6] },
  section: { gap: SPACE[2] },
  heading: { ...TYPE.footnoteStrong, paddingHorizontal: SPACE[1] },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  card: { borderRadius: RADIUS.card, borderCurve: 'continuous', padding: SPACE[4], gap: SPACE[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  wish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: 48,
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
  },
  wishInput: { ...TYPE.body, flex: 1, minHeight: SIZE.hitMin },
  working: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[2], minHeight: 120 },
  note: {
    flexDirection: 'row',
    gap: SPACE[2],
    alignItems: 'flex-start',
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    padding: SPACE[3],
  },
  cards: { gap: SPACE[3] },
  alt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  altText: { flex: 1, minWidth: 0 },
  altTitle: { ...TYPE.bodyStrong },
  meta: { ...TYPE.footnote },
  choose: {
    minHeight: SIZE.hitMin,
    minWidth: 72,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[4],
  },
  chooseLabel: { ...TYPE.subhead, fontWeight: '600' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    paddingLeft: SPACE[4],
    paddingRight: SPACE[2],
    paddingVertical: SPACE[1],
  },
  toastText: { ...TYPE.subhead, flex: 1 },
  undo: { minHeight: 36, justifyContent: 'center', paddingHorizontal: SPACE[3] },
  undoLabel: { ...TYPE.subhead, fontWeight: '700' },
  ideaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: SPACE[4],
  },
  ideaTile: {
    width: SIZE.tileS,
    height: SIZE.tileS,
    borderRadius: RADIUS.tileS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.hitMin, marginRight: SPACE[1] },
  backLabel: { ...TYPE.body },
  headline: { gap: 6, paddingHorizontal: SPACE[1] },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  eyebrowText: { ...TYPE.footnoteStrong },
  recordTitle: { ...TYPE.recordTitle },
  facts: { flexDirection: 'row', borderRadius: RADIUS.card, borderCurve: 'continuous' },
  fact: { flex: 1, alignItems: 'center', paddingVertical: SPACE[3] },
  factValue: { ...TYPE.numeralL },
  list: { borderRadius: RADIUS.card, borderCurve: 'continuous', paddingLeft: SPACE[4] },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: 48,
    paddingVertical: SPACE[2],
    paddingRight: SPACE[4],
  },
  stepRow: { flexDirection: 'row', gap: SPACE[3], paddingVertical: SPACE[3], paddingRight: SPACE[4] },
  stepNumber: { ...TYPE.bodyStrong, fontWeight: '700', width: 24, fontVariant: ['tabular-nums'] },
  amount: { ...TYPE.bodyStrong, fontVariant: ['tabular-nums'] },
  stepper: {
    width: SIZE.hitMin,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: SPACE[2] },
  secondary: {
    flex: 1,
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACE[3],
  },
  body: { ...TYPE.body },
  subhead: { ...TYPE.subhead },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  footnoteFlex: { ...TYPE.footnote, flex: 1 },
  center: { textAlign: 'center' },
  grow: { flex: 1 },
  shrink: { flexShrink: 1, textAlign: 'center' },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
})
