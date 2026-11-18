/**
 * Eetvoorkeuren (APP-318): the household's standing meal preferences, design
 * section 2 of designs/meal-planner/README.md.
 *
 * One document per Group that every Member reads and changes. Each control
 * saves at once with an optimistic update that answers what the server will
 * (`applyMealPreferencesPatch`), so a switch never flicks back while its write
 * is in flight; a refused write drops the patch, the old value reappears and
 * the screen says it did not save. The only typed value, the weekly budget,
 * commits on blur (docs/standards/number-fields.md).
 *
 * Diets, allergens and dislikes are written one item at a time
 * (`setDiet`/`setAllergen`/`setDislike`), never as a whole list, so another
 * Member's change made at the same moment is never lost.
 */
import {
  ALLERGENS,
  applyMealPreferencesPatch,
  applyMemberDefault,
  budgetText,
  type CookingMinutes,
  CUISINES,
  DIETS,
  listChangePatch,
  MEAL_PREFERENCE_LIMITS,
  MEAL_SLOTS,
  type MealPreferencesListChange,
  type MealPreferencesPatch,
  nextCookingMinutes,
  normalizeDislike,
  parseBudgetCents,
  SMART_SWITCHES,
  toggleDay,
  toggleIn,
} from '@gather/core/meal-preferences'
import type { OptimisticLocalStore } from 'convex/browser'
import { useMutation } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import {
  BlockRow,
  Chip,
  ChipWrap,
  Coin,
  DayChips,
  MinutesGrid,
  PrefSection,
  Stepper,
} from './controls'

const LIMITS = MEAL_PREFERENCE_LIMITS

export function MealPreferencesScreen() {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const m = t.mealPreferences
  const { group } = useGroup()
  const groupSlug = group.slug

  const prefs = useQuery(api.mealPreferences.get, { groupSlug })
  const [failed, setFailed] = useState(false)
  const [dislikeDraft, setDislikeDraft] = useState('')
  const [dislikeFull, setDislikeFull] = useState(false)
  // The typed budget while it is being edited; `null` reads the stored one.
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null)
  const [budgetInvalid, setBudgetInvalid] = useState(false)

  const update = useMutation(api.mealPreferences.update).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.mealPreferences.get, { groupSlug })
      if (current)
        store.setQuery(
          api.mealPreferences.get,
          { groupSlug },
          {
            ...current,
            ...applyMealPreferencesPatch(
              current,
              args.patch as MealPreferencesPatch,
            ),
          },
        )
    },
  )
  const setMemberDefault = useMutation(
    api.mealPreferences.setMemberDefault,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.mealPreferences.get, { groupSlug })
    if (current)
      store.setQuery(
        api.mealPreferences.get,
        { groupSlug },
        {
          ...current,
          ...applyMemberDefault(current, args.userId, args.eatsByDefault),
        },
      )
  })

  // The same answer the server gives for one list item, shown at once.
  const optimisticList = (
    store: OptimisticLocalStore,
    change: MealPreferencesListChange,
  ) => {
    const current = store.getQuery(api.mealPreferences.get, { groupSlug })
    if (!current) return
    const result = listChangePatch(current, change)
    if (result.ok)
      store.setQuery(
        api.mealPreferences.get,
        { groupSlug },
        { ...current, ...applyMealPreferencesPatch(current, result.patch) },
      )
  }
  const setDiet = useMutation(api.mealPreferences.setDiet).withOptimisticUpdate(
    (store, args) =>
      optimisticList(store, { list: 'diets', value: args.diet, on: args.on }),
  )
  const setAllergen = useMutation(
    api.mealPreferences.setAllergen,
  ).withOptimisticUpdate((store, args) =>
    optimisticList(store, {
      list: 'allergens',
      value: args.allergen,
      on: args.on,
    }),
  )
  const setDislike = useMutation(
    api.mealPreferences.setDislike,
  ).withOptimisticUpdate((store, args) =>
    optimisticList(store, {
      list: 'dislikes',
      value: args.dislike,
      on: args.on,
    }),
  )

  const failedToSave = () => {
    haptics.actionFailed()
    setFailed(true)
  }

  function save(patch: MealPreferencesPatch) {
    setFailed(false)
    update({ groupSlug, patch }).catch(failedToSave)
  }

  function saveItem(change: MealPreferencesListChange) {
    setFailed(false)
    const written =
      change.list === 'diets'
        ? setDiet({ groupSlug, diet: change.value, on: change.on })
        : change.list === 'allergens'
          ? setAllergen({ groupSlug, allergen: change.value, on: change.on })
          : setDislike({ groupSlug, dislike: change.value, on: change.on })
    written.catch(failedToSave)
  }

  const decimal: ',' | '.' = locale === 'nl' ? ',' : '.'

  // Leaving the screen with the budget field focused may not blur it, so a
  // typed budget still pending is saved on the way out.
  const stored = prefs?.weeklyBudgetCents
  const leaving = useRef({ budgetDraft, decimal, groupSlug, stored, update })
  leaving.current = { budgetDraft, decimal, groupSlug, stored, update }
  useEffect(
    () => () => {
      const pending = leaving.current
      if (pending.budgetDraft === null) return
      const parsed = parseBudgetCents(pending.budgetDraft, pending.decimal)
      if (!parsed.ok || parsed.cents === pending.stored) return
      pending
        .update({
          groupSlug: pending.groupSlug,
          patch: { weeklyBudgetCents: parsed.cents },
        })
        .catch(() => haptics.actionFailed())
    },
    [],
  )

  if (prefs === undefined) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={styles.content}
      >
        <LoadingSkeleton rows={6} label={t.actions.loading} />
      </ScrollView>
    )
  }

  const eaters = prefs.defaultEaterIds.length
  const nameOf = new Map(prefs.members.map((p) => [p.userId, p.name]))

  function setServings(next: number) {
    // Stepping onto the number of people eating is "the same as who eats":
    // stored as no override, so it follows the switches again.
    save({ servingsPerMeal: next === Math.max(1, eaters) ? null : next })
  }

  function addDislike() {
    const text = normalizeDislike(dislikeDraft)
    if (!text || !prefs) return
    const exists = prefs.dislikes.some(
      (d) => d.toLocaleLowerCase() === text.toLocaleLowerCase(),
    )
    if (!exists && prefs.dislikes.length >= LIMITS.dislikes.count) {
      haptics.actionFailed()
      setDislikeFull(true)
      return
    }
    setDislikeFull(false)
    setDislikeDraft('')
    if (!exists) saveItem({ list: 'dislikes', value: text, on: true })
  }

  function commitBudget() {
    if (budgetDraft === null || !prefs) return
    const parsed = parseBudgetCents(budgetDraft, decimal)
    if (!parsed.ok) {
      haptics.actionFailed()
      setBudgetInvalid(true)
      return
    }
    setBudgetInvalid(false)
    setBudgetDraft(null)
    if (parsed.cents === prefs.weeklyBudgetCents) return
    // A refused save puts back what was typed, not the old amount.
    const typed = budgetDraft
    setFailed(false)
    update({ groupSlug, patch: { weeklyBudgetCents: parsed.cents } }).catch(
      () => {
        failedToSave()
        setBudgetDraft(typed)
      },
    )
  }

  const minutesValue = (minutes: CookingMinutes | null) =>
    minutes === null ? m.time.none : fmt(m.time.minutes, { minutes })

  return (
    <ScrollView
      testID="meal-prefs-screen"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 40 },
      ]}
    >
      <Text style={[styles.subhead, { color: tokens.muted }]}>
        {fmt(m.subhead, { group: group.name })}
      </Text>
      {failed ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: tokens.danger }]}
        >
          {m.saveFailed}
        </Text>
      ) : null}

      <PrefSection heading={m.who.heading} footnote={m.who.footnote}>
        <InsetList>
          {prefs.memberDefaults.map(({ userId, eatsByDefault }) => {
            const name = nameOf.get(userId) ?? ''
            return (
              <InsetRow
                key={userId}
                leading={<Coin name={name} />}
                title={name}
                subtitle={
                  eatsByDefault ? m.who.eatsByDefault : m.who.notByDefault
                }
                trailing={
                  <Switch
                    testID={`meal-prefs-eats-${userId}`}
                    value={eatsByDefault}
                    accessibilityLabel={name}
                    trackColor={{ false: tokens.surface2 }}
                    onValueChange={(next) => {
                      haptics.selectionChanged()
                      setFailed(false)
                      setMemberDefault({
                        groupSlug,
                        userId: userId as Id<'users'>,
                        eatsByDefault: next,
                      }).catch(failedToSave)
                    }}
                  />
                }
              />
            )
          })}
          <BlockRow
            title={m.who.servings}
            subtitle={
              prefs.servingsOverride === null
                ? fmt(m.who.servingsSame, { count: Math.max(1, eaters) })
                : fmt(m.who.servingsAdjusted, { count: eaters })
            }
            trailing={
              <Stepper
                testID="meal-prefs-servings"
                value={String(prefs.servingsPerMeal)}
                label={m.who.servings}
                decreaseLabel={m.variety.decrease}
                increaseLabel={m.variety.increase}
                canDecrease={prefs.servingsPerMeal > LIMITS.servings.min}
                canIncrease={prefs.servingsPerMeal < LIMITS.servings.max}
                onDecrease={() => setServings(prefs.servingsPerMeal - 1)}
                onIncrease={() => setServings(prefs.servingsPerMeal + 1)}
              />
            }
          >
            {prefs.servingsOverride !== null ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => save({ servingsPerMeal: null })}
                style={styles.textButton}
              >
                <Text style={[TYPE.subhead, { color: tokens.accentText }]}>
                  {m.who.servingsReset}
                </Text>
              </Pressable>
            ) : null}
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.plan.heading} footnote={m.plan.footnote}>
        <InsetList>
          {MEAL_SLOTS.map((slot) => {
            const plan = prefs.slots[slot]
            return (
              <BlockRow
                key={slot}
                title={m.plan.slots[slot]}
                trailing={
                  <Switch
                    testID={`meal-prefs-slot-${slot}`}
                    value={plan.enabled}
                    accessibilityLabel={m.plan.slots[slot]}
                    trackColor={{ false: tokens.surface2 }}
                    onValueChange={(enabled) => {
                      haptics.selectionChanged()
                      save({
                        slots: { ...prefs.slots, [slot]: { ...plan, enabled } },
                      })
                    }}
                  />
                }
              >
                {plan.enabled ? (
                  <DayChips
                    testID={`meal-prefs-slot-${slot}-day`}
                    selected={plan.days}
                    short={m.dayShort}
                    long={m.dayLong}
                    onToggle={(day) =>
                      save({
                        slots: {
                          ...prefs.slots,
                          [slot]: { ...plan, days: toggleDay(plan.days, day) },
                        },
                      })
                    }
                  />
                ) : null}
              </BlockRow>
            )
          })}
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.time.heading} footnote={m.time.footnote}>
        <InsetList>
          <BlockRow>
            <MinutesGrid
              minutes={prefs.cookingMinutes}
              dayShort={m.dayShort}
              formatMinutes={minutesValue}
              hint={m.time.hint}
              labelOf={(day, minutes) =>
                minutes === null
                  ? fmt(m.time.cellLabelNone, { day: m.dayLong[day] })
                  : fmt(m.time.cellLabel, { day: m.dayLong[day], minutes })
              }
              onCycle={(day) => {
                const next = [...prefs.cookingMinutes]
                next[day] = nextCookingMinutes(next[day] ?? null)
                save({ cookingMinutes: next })
              }}
            />
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.diet.heading} footnote={m.diet.footnote}>
        <InsetList>
          <BlockRow>
            <ChipWrap>
              {DIETS.map((diet) => (
                <Chip
                  key={diet}
                  testID={`meal-prefs-diet-${diet}`}
                  label={m.diet.names[diet]}
                  selected={prefs.diets.includes(diet)}
                  onPress={() =>
                    saveItem({
                      list: 'diets',
                      value: diet,
                      on: !prefs.diets.includes(diet),
                    })
                  }
                />
              ))}
            </ChipWrap>
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection
        heading={m.allergies.heading}
        footnote={m.allergies.footnote}
      >
        <InsetList>
          <BlockRow>
            <ChipWrap>
              {ALLERGENS.map((allergen) => (
                <Chip
                  key={allergen}
                  testID={`meal-prefs-allergen-${allergen}`}
                  label={m.allergies.names[allergen]}
                  selected={prefs.allergens.includes(allergen)}
                  onPress={() =>
                    saveItem({
                      list: 'allergens',
                      value: allergen,
                      on: !prefs.allergens.includes(allergen),
                    })
                  }
                />
              ))}
            </ChipWrap>
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.dislikes.heading}>
        <InsetList>
          <BlockRow>
            {prefs.dislikes.length > 0 ? (
              <View style={styles.tags}>
                {prefs.dislikes.map((dislike) => (
                  <View
                    key={dislike}
                    style={[styles.tag, { backgroundColor: tokens.surface2 }]}
                  >
                    <Text style={[TYPE.subhead, { color: tokens.ink }]}>
                      {dislike}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={fmt(m.dislikes.remove, {
                        name: dislike,
                      })}
                      hitSlop={6}
                      onPress={() => {
                        setDislikeFull(false)
                        saveItem({ list: 'dislikes', value: dislike, on: false })
                      }}
                      style={({ pressed }) => [
                        styles.tagRemove,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <UI_ICONS.X
                        size={14}
                        strokeWidth={2.6}
                        color={tokens.muted}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[TYPE.subhead, { color: tokens.muted }]}>
                {m.dislikes.empty}
              </Text>
            )}
            <View style={[styles.addField, { backgroundColor: tokens.ground }]}>
              <UI_ICONS.Plus
                size={16}
                strokeWidth={2.4}
                color={tokens.muted}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <TextInput
                testID="meal-prefs-dislike-input"
                value={dislikeDraft}
                onChangeText={(text) => {
                  setDislikeDraft(text)
                  setDislikeFull(false)
                }}
                onSubmitEditing={addDislike}
                submitBehavior="submit"
                returnKeyType="done"
                autoCapitalize="none"
                maxLength={LIMITS.dislikes.length}
                placeholder={m.dislikes.placeholder}
                placeholderTextColor={tokens.muted}
                accessibilityLabel={m.dislikes.heading}
                style={[styles.addInput, { color: tokens.ink }]}
              />
            </View>
            {dislikeFull ? (
              <Text style={[TYPE.footnoteStrong, { color: tokens.danger }]}>
                {m.dislikes.tooMany}
              </Text>
            ) : null}
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.variety.heading}>
        <InsetList>
          <BlockRow
            title={m.variety.noRepeat}
            trailing={
              <Stepper
                testID="meal-prefs-no-repeat"
                value={plural(locale, prefs.noRepeatDays, m.variety.noRepeatValue)}
                label={m.variety.noRepeat}
                decreaseLabel={m.variety.decrease}
                increaseLabel={m.variety.increase}
                canDecrease={prefs.noRepeatDays > LIMITS.noRepeatDays.min}
                canIncrease={prefs.noRepeatDays < LIMITS.noRepeatDays.max}
                onDecrease={() =>
                  save({ noRepeatDays: prefs.noRepeatDays - 1 })
                }
                onIncrease={() =>
                  save({ noRepeatDays: prefs.noRepeatDays + 1 })
                }
              />
            }
          />
          <BlockRow
            title={m.variety.meatFree}
            trailing={
              <Stepper
                testID="meal-prefs-meat-free"
                value={plural(
                  locale,
                  prefs.meatFreeNights,
                  m.variety.meatFreeValue,
                )}
                label={m.variety.meatFree}
                decreaseLabel={m.variety.decrease}
                increaseLabel={m.variety.increase}
                canDecrease={prefs.meatFreeNights > LIMITS.meatFreeNights.min}
                canIncrease={prefs.meatFreeNights < LIMITS.meatFreeNights.max}
                onDecrease={() =>
                  save({ meatFreeNights: prefs.meatFreeNights - 1 })
                }
                onIncrease={() =>
                  save({ meatFreeNights: prefs.meatFreeNights + 1 })
                }
              />
            }
          />
          <BlockRow title={m.variety.fishNight}>
            <DayChips
              testID="meal-prefs-fish-day"
              selected={prefs.fishDays}
              short={m.dayShort}
              long={m.dayLong}
              onToggle={(day) =>
                save({ fishDays: toggleDay(prefs.fishDays, day) })
              }
            />
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection
        heading={m.leftovers.heading}
        footnote={m.leftovers.footnote}
      >
        <InsetList>
          <BlockRow title={m.leftovers.cookDouble}>
            <DayChips
              testID="meal-prefs-leftover-day"
              selected={prefs.leftoverDays}
              short={m.dayShort}
              long={m.dayLong}
              onToggle={(day) =>
                save({ leftoverDays: toggleDay(prefs.leftoverDays, day) })
              }
            />
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.extra.heading} footnote={m.extra.footnote}>
        <InsetList>
          <BlockRow
            title={m.extra.budget}
            trailing={
              <View style={styles.budget}>
                <Text style={[TYPE.body, { color: tokens.muted }]}>€</Text>
                <TextInput
                  testID="meal-prefs-budget"
                  value={
                    budgetDraft ??
                    budgetText(prefs.weeklyBudgetCents, decimal)
                  }
                  onChangeText={(text) => {
                    setBudgetDraft(text)
                    setBudgetInvalid(false)
                  }}
                  onBlur={commitBudget}
                  onSubmitEditing={commitBudget}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                  placeholder={m.extra.budgetPlaceholder}
                  placeholderTextColor={tokens.muted}
                  accessibilityLabel={m.extra.budgetLabel}
                  style={[styles.budgetInput, { color: tokens.ink }]}
                />
              </View>
            }
          >
            {budgetInvalid ? (
              <Text
                accessibilityRole="alert"
                style={[TYPE.footnoteStrong, { color: tokens.danger }]}
              >
                {m.extra.budgetInvalid}
              </Text>
            ) : null}
          </BlockRow>
          <BlockRow title={m.extra.cuisines}>
            <ChipWrap>
              {CUISINES.map((cuisine) => (
                <Chip
                  key={cuisine}
                  testID={`meal-prefs-cuisine-${cuisine}`}
                  label={m.extra.cuisineNames[cuisine]}
                  selected={prefs.cuisines.includes(cuisine)}
                  onPress={() =>
                    save({ cuisines: toggleIn(prefs.cuisines, cuisine) })
                  }
                />
              ))}
            </ChipWrap>
          </BlockRow>
        </InsetList>
      </PrefSection>

      <PrefSection heading={m.smart.heading} footnote={m.smart.footnote}>
        <InsetList>
          {SMART_SWITCHES.map((key) => (
            <InsetRow
              key={key}
              title={m.smart[key]}
              trailing={
                <Switch
                  testID={`meal-prefs-smart-${key}`}
                  value={prefs.smart[key]}
                  accessibilityLabel={m.smart[key]}
                  trackColor={{ false: tokens.surface2 }}
                  onValueChange={(next) => {
                    haptics.selectionChanged()
                    save({ smart: { ...prefs.smart, [key]: next } })
                  }}
                />
              }
            />
          ))}
        </InsetList>
      </PrefSection>

      <Text style={[styles.closing, { color: tokens.muted }]}>
        {fmt(m.closing, { group: group.name })}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACE[4],
    paddingTop: SPACE[2],
    gap: SPACE[5],
  },
  subhead: { ...TYPE.subhead, paddingHorizontal: SPACE[1] },
  error: { ...TYPE.footnoteStrong, paddingHorizontal: SPACE[1] },
  closing: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  textButton: { alignSelf: 'flex-start' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  tag: {
    minHeight: 36,
    paddingLeft: SPACE[3],
    paddingRight: SPACE[1],
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tagRemove: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addField: {
    minHeight: 44,
    paddingHorizontal: SPACE[3],
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
  },
  addInput: { ...TYPE.body, flex: 1, paddingVertical: 10 },
  budget: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  budgetInput: { ...TYPE.body, minWidth: 72, textAlign: 'right' },
})
