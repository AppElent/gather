/**
 * Pick a meal for one slot (designs/meal-planner §1, Pick): the Group's
 * recipes, filtered by its meal preferences unless the chip is off, by a time
 * chip, and by search; then the quick meals without a recipe, which are added,
 * changed and deleted here.
 *
 * The preference filter hides a recipe only on a certain clash; a "controleer
 * zelf" stays in the list with its reason. Row text and the hidden line's
 * reasons come from `describeClashes` (one line, however many "controleer zelf") and `clashReasons`.
 */
import { localMidnight } from '@gather/core/civil-date'
import {
  eligibleDinnerCandidates,
  type MealSlot,
  PICK_TIME_LIMITS,
  type PickTimeLimit,
  weekdayIndex,
} from '@gather/core/meal-planner'
import {
  clashReasons,
  describeClashes,
  fitsPreferences,
  recipeClashes,
} from '@gather/core/meal-preferences'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { NativeSheet } from '../../../components/NativeSheet'
import { SearchField } from '../../../components/SearchField'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { confirmDestructive } from '../../../feedback/confirmDestructive'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { InsetAddRow, InsetList, InsetRow } from '../../../ui/inset-list'
import { Chip, MealThumb } from './parts'
import { type WeekData, weekdayName } from './week'

export function PickSheet({
  date,
  slot,
  replacing,
  week,
  onClose,
  onFailed,
}: {
  date: string
  slot: MealSlot
  replacing?: Id<'plannedDinners'>
  week: WeekData
  onClose: () => void
  onFailed: () => void
}) {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.mealPlanner
  const pickWords = words.pick
  const tokens = useTokens('kitchen')
  const candidates = useQuery(api.mealPlan.candidates, {
    groupSlug: group.slug,
  })
  const plan = useMutation(api.mealPlan.plan)
  const addQuick = useMutation(api.kitchen.addMealEntry)
  const updateQuick = useMutation(api.kitchen.updateMealEntry)
  const removeQuick = useMutation(api.kitchen.removeMealEntry)

  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState(true)
  const [limit, setLimit] = useState<PickTimeLimit | undefined>()
  const [composer, setComposer] = useState<{
    id?: Id<'mealEntries'>
    name: string
    minutes: string
  } | null>(null)

  const weekday = weekdayIndex(date)
  const weekdayWord = localMidnight(date).toLocaleDateString(locale, {
    weekday: 'long',
  })
  const needle = search.trim().toLocaleLowerCase(locale)
  const found = <T extends { title: string }>(rows: readonly T[]) =>
    needle
      ? rows.filter((row) => row.title.toLocaleLowerCase(locale).includes(needle))
      : [...rows]

  const recipes = useMemo(
    () =>
      (candidates?.recipes ?? []).map((recipe) => ({
        ...recipe,
        id: recipe._id,
        clashes: recipeClashes(recipe, week.preferences, weekday),
      })),
    [candidates, week.preferences, weekday],
  )
  const searched = eligibleDinnerCandidates(found(recipes), limit)
  const shown = matches
    ? searched.filter((recipe) => fitsPreferences(recipe.clashes))
    : searched
  const hidden = matches ? searched.length - shown.length : 0
  const reasons = clashReasons(
    searched
      .filter((recipe) => !fitsPreferences(recipe.clashes))
      .flatMap((recipe) => recipe.clashes),
    t.mealPreferences,
  ).join(', ')
  const quickMeals = eligibleDinnerCandidates(
    found(
      (candidates?.mealEntries ?? []).map((entry) => ({ ...entry, id: entry._id })),
    ),
    limit,
  )

  const choose = (pick: { recipeId?: Id<'recipes'>; mealEntryId?: Id<'mealEntries'> }) => {
    onClose()
    plan({
      groupSlug: group.slug,
      date,
      slot,
      ...pick,
      replace: Boolean(replacing),
      replaceId: replacing,
    })
      .then(() => haptics.itemSaved())
      .catch(() => {
        haptics.actionFailed()
        onFailed()
      })
  }

  const saveQuick = () => {
    if (!composer?.name.trim()) return
    const prepMinutes = Number(composer.minutes) || undefined
    const write = composer.id
      ? updateQuick({
          groupSlug: group.slug,
          id: composer.id,
          title: composer.name.trim(),
          prepMinutes,
        })
      : addQuick({ groupSlug: group.slug, title: composer.name.trim(), prepMinutes })
    write
      .then(() => {
        haptics.itemSaved()
        setComposer(null)
      })
      .catch(() => haptics.actionFailed())
  }

  const alreadyOn = (recipeId: string) =>
    week.meals
      .filter((meal) => meal.recipeId === recipeId)
      .map((meal) => weekdayName(meal.date, locale))

  return (
    <NativeSheet
      title={fmt(pickWords.title, { slot: words.slots[slot], weekday: weekdayWord })}
      onClose={onClose}
      maxHeight={0.9}
      fill
      background="ground"
    >
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder={plural(locale, recipes.length, pickWords.search)}
        clearAccessibilityLabel={t.search.clear}
        testID="pick-search"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipRow}
      >
        <Chip
          label={pickWords.matches}
          on={matches}
          testID="pick-matches"
          icon={UI_ICONS.Sliders}
          onPress={() => setMatches(!matches)}
        />
        {PICK_TIME_LIMITS.map((minutes) => (
          <Chip
            key={minutes}
            label={fmt(pickWords.upTo, { minutes })}
            on={limit === minutes}
            testID={`pick-limit-${minutes}`}
            onPress={() => setLimit(limit === minutes ? undefined : minutes)}
          />
        ))}
      </ScrollView>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        {hidden > 0 ? (
          <Text
            testID="pick-hidden"
            style={[styles.status, { color: tokens.muted }]}
          >
            {fmt(plural(locale, hidden, pickWords.hidden), { reasons })}
          </Text>
        ) : null}
        {candidates && shown.length === 0 ? (
          <Text style={[styles.status, { color: tokens.muted }]}>
            {pickWords.noMatches}
          </Text>
        ) : null}
        {shown.length > 0 ? (
          <InsetList>
            {shown.map((recipe) => {
              const days = alreadyOn(recipe._id)
              const facts = [
                recipe.prepMinutes
                  ? fmt(words.minutes, { minutes: recipe.prepMinutes })
                  : null,
                recipe.rating
                  ? fmt(pickWords.stars, { rating: recipe.rating })
                  : null,
                days.length > 0
                  ? fmt(pickWords.alreadyOn, { day: days.join(', ') })
                  : null,
              ].filter(Boolean)
              // A certain clash first; else one combined "controleer zelf".
              const clash = describeClashes(recipe.clashes, t.mealPreferences)
              const certainClash = recipe.clashes.some((entry) => !entry.uncertain)
              return (
                <InsetRow
                  key={recipe._id}
                  testID={`pick-recipe-${recipe.title}`}
                  title={recipe.title}
                  subtitle={clash ?? (facts.join(' · ') || undefined)}
                  subtitleTone={certainClash ? 'danger' : 'muted'}
                  leading={<MealThumb imageUrl={recipe.imageUrl} quick={false} />}
                  onPress={() => choose({ recipeId: recipe._id })}
                />
              )
            })}
          </InsetList>
        ) : null}

        <View style={styles.quick}>
          <Text style={[styles.heading, { color: tokens.muted }]}>
            {pickWords.quickMeals}
          </Text>
          <InsetList>
            {quickMeals.map((entry) =>
              composer?.id === entry._id ? (
                <QuickComposer
                  key={entry._id}
                  value={composer}
                  onChange={setComposer}
                  onSave={saveQuick}
                />
              ) : (
                <InsetRow
                  key={entry._id}
                  testID={`pick-quick-${entry.title}`}
                  title={entry.title}
                  subtitle={
                    entry.prepMinutes
                      ? fmt(words.minutes, { minutes: entry.prepMinutes })
                      : undefined
                  }
                  leading={<MealThumb quick />}
                  onPress={() => choose({ mealEntryId: entry._id })}
                  menu={{
                    actions: [
                      { id: 'edit', title: pickWords.edit },
                      {
                        id: 'delete',
                        title: pickWords.delete,
                        attributes: { destructive: true },
                      },
                    ],
                    onAction: (action) => {
                      if (action === 'edit') {
                        setComposer({
                          id: entry._id,
                          name: entry.title,
                          minutes: entry.prepMinutes ? String(entry.prepMinutes) : '',
                        })
                        return
                      }
                      confirmDestructive({
                        title: fmt(pickWords.deleteTitle, { title: entry.title }),
                        message: pickWords.deleteBody,
                        confirm: pickWords.delete,
                        cancel: t.common.actions.cancel,
                        onConfirm: () =>
                          removeQuick({ groupSlug: group.slug, id: entry._id }).catch(
                            () => haptics.actionFailed(),
                          ),
                      })
                    },
                  }}
                />
              ),
            )}
            {composer && !composer.id ? (
              <QuickComposer value={composer} onChange={setComposer} onSave={saveQuick} />
            ) : (
              <InsetAddRow
                group="kitchen"
                label={pickWords.newQuickMeal}
                testID="pick-quick-add"
                onPress={() => setComposer({ name: '', minutes: '' })}
              />
            )}
          </InsetList>
          <Text style={[styles.status, { color: tokens.muted }]}>
            {pickWords.quickMealsFooter}
          </Text>
        </View>
      </ScrollView>
    </NativeSheet>
  )
}

function QuickComposer({
  value,
  onChange,
  onSave,
}: {
  value: { id?: Id<'mealEntries'>; name: string; minutes: string }
  onChange: (next: { id?: Id<'mealEntries'>; name: string; minutes: string }) => void
  onSave: () => void
}) {
  const { t } = useI18n()
  const pickWords = t.mealPlanner.pick
  const tokens = useTokens('kitchen')
  return (
    <View style={styles.composer}>
      <TextInput
        testID="pick-quick-name"
        autoFocus
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        placeholder={pickWords.quickName}
        placeholderTextColor={tokens.muted}
        accessibilityLabel={pickWords.quickName}
        returnKeyType="next"
        style={[styles.input, { color: tokens.ink, borderBottomColor: tokens.hair }]}
      />
      <View style={styles.composerRow}>
        <TextInput
          testID="pick-quick-minutes"
          value={value.minutes}
          onChangeText={(minutes) => onChange({ ...value, minutes })}
          placeholder={pickWords.quickMinutes}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={pickWords.quickMinutes}
          keyboardType="number-pad"
          style={[styles.input, styles.minutes, { color: tokens.ink }]}
        />
        <Pressable
          accessibilityRole="button"
          testID="pick-quick-save"
          disabled={!value.name.trim()}
          onPress={onSave}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: tokens.accent },
            !value.name.trim() && styles.inert,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.saveLabel, { color: tokens.onAccent }]}>
            {pickWords.save}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: SPACE[3],
    marginHorizontal: -SPACE[4],
  },
  chips: { gap: SPACE[2], paddingHorizontal: SPACE[4] },
  body: { gap: SPACE[3], paddingTop: SPACE[3], paddingBottom: SPACE[6] },
  status: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  quick: { gap: SPACE[2], marginTop: SPACE[2] },
  heading: { ...TYPE.footnoteStrong, paddingHorizontal: SPACE[1] },
  composer: { paddingHorizontal: SPACE[4], paddingVertical: SPACE[2], gap: SPACE[2] },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  input: {
    ...TYPE.body,
    minHeight: SIZE.hitMin,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  minutes: { flex: 1, borderBottomWidth: 0 },
  save: {
    minHeight: 36,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE[4],
    justifyContent: 'center',
  },
  saveLabel: { ...TYPE.bodyStrong },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
})
