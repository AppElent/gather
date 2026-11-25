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
import { weekdayName } from '@gather/core/week-menu'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { Dialog } from '../app/Dialog'
import { InsetList, InsetRow } from '../app/InsetList'
import { RowMenu } from '../app/RowMenu'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import type { WeekData } from './data'
import { useMealPlannerNotices } from './MealPlannerNotices'
import { Chip, labelClass, MealThumb } from './parts'

interface QuickDraft {
  id?: Id<'mealEntries'>
  name: string
  minutes: string
}

/**
 * Pick a meal for one slot: the Group's recipes, filtered by its meal
 * preferences unless the chip is off, by a time chip and by search; then the
 * quick meals without a recipe, which are added, changed and deleted here.
 */
export function PickDialog({
  date,
  slot,
  replacing,
  week,
  onClose,
}: {
  date: string
  slot: MealSlot
  /** Something else: the meal Pick replaces, keeping its servings. */
  replacing?: Id<'plannedDinners'>
  week: WeekData
  onClose: () => void
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const pickWords = words.pick
  const { fail } = useMealPlannerNotices()
  const { confirm, dialog } = useConfirmAction()
  const candidates = useQuery(api.mealPlan.candidates, { groupSlug })
  const plan = useMutation(api.mealPlan.plan)
  const addQuick = useMutation(api.kitchen.addMealEntry)
  const updateQuick = useMutation(api.kitchen.updateMealEntry)
  const removeQuick = useMutation(api.kitchen.removeMealEntry)
  const searchRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState(true)
  const [limit, setLimit] = useState<PickTimeLimit>()
  const [composer, setComposer] = useState<QuickDraft | null>(null)
  const [savingQuick, setSavingQuick] = useState(false)
  const [quickFailed, setQuickFailed] = useState(false)

  const weekday = weekdayIndex(date)
  const needle = search.trim().toLocaleLowerCase(locale)
  const found = <T extends { title: string }>(rows: readonly T[]) =>
    needle
      ? rows.filter((row) =>
          row.title.toLocaleLowerCase(locale).includes(needle),
        )
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
  const hidden = searched.length - shown.length
  const reasons = clashReasons(
    searched
      .filter((recipe) => !fitsPreferences(recipe.clashes))
      .flatMap((recipe) => recipe.clashes),
    t.mealPreferences,
  ).join(', ')
  const quickMeals = eligibleDinnerCandidates(
    found(
      (candidates?.mealEntries ?? []).map((entry) => ({
        ...entry,
        id: entry._id,
      })),
    ),
    limit,
  )

  const choose = (pick: {
    recipeId?: Id<'recipes'>
    mealEntryId?: Id<'mealEntries'>
  }) => {
    onClose()
    plan({
      groupSlug,
      date,
      slot,
      ...pick,
      replace: Boolean(replacing),
      replaceId: replacing,
    }).catch(() => fail())
  }

  const saveQuick = () => {
    if (!composer?.name.trim() || savingQuick) return
    setSavingQuick(true)
    setQuickFailed(false)
    const fields = {
      groupSlug,
      title: composer.name.trim(),
      prepMinutes: Number(composer.minutes) || undefined,
    }
    const write: Promise<unknown> = composer.id
      ? updateQuick({ ...fields, id: composer.id })
      : addQuick(fields)
    write
      .then(() => setComposer(null))
      .catch(() => setQuickFailed(true))
      .finally(() => setSavingQuick(false))
  }

  const alreadyOn = (recipeId: string) =>
    week.meals
      .filter((meal) => meal.recipeId === recipeId)
      .map((meal) => weekdayName(meal.date, locale))

  const editor = composer ? (
    <li className="list-none p-3">
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          saveQuick()
        }}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: opened by the button it replaces
          autoFocus
          value={composer.name}
          maxLength={120}
          aria-label={pickWords.quickName}
          placeholder={pickWords.quickName}
          onChange={(event) =>
            setComposer({ ...composer, name: event.target.value })
          }
          className={inputClass}
        />
        <input
          value={composer.minutes}
          inputMode="numeric"
          aria-label={pickWords.quickMinutes}
          placeholder={pickWords.quickMinutes}
          onChange={(event) =>
            setComposer({
              ...composer,
              minutes: event.target.value.replace(/\D/g, ''),
            })
          }
          className={inputClass}
        />
        {quickFailed ? (
          <p
            role="alert"
            className="m-0 text-footnote font-semibold text-[var(--danger)]"
          >
            {words.failed}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setComposer(null)}
            className={buttonClass.small}
          >
            {t.common.actions.cancel}
          </button>
          <button
            type="submit"
            disabled={!composer.name.trim() || savingQuick}
            className={buttonClass.small}
          >
            {pickWords.save}
          </button>
        </div>
      </form>
    </li>
  ) : null

  return (
    <>
      <Dialog
        title={fmt(pickWords.title, {
          slot: words.slots[slot],
          weekday: localMidnight(date).toLocaleDateString(locale, {
            weekday: 'long',
          }),
        })}
        onClose={onClose}
        initialFocus={searchRef}
      >
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={plural(locale, recipes.length, pickWords.search)}
          placeholder={plural(locale, recipes.length, pickWords.search)}
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2">
          <Chip
            label={pickWords.matches}
            on={matches}
            onClick={() => setMatches(!matches)}
          />
          {PICK_TIME_LIMITS.map((minutes) => (
            <Chip
              key={minutes}
              label={fmt(pickWords.upTo, { minutes })}
              on={limit === minutes}
              onClick={() => setLimit(limit === minutes ? undefined : minutes)}
            />
          ))}
        </div>
        {hidden > 0 ? (
          <p className="m-0 text-footnote text-[var(--muted)]">
            {fmt(plural(locale, hidden, pickWords.hidden), { reasons })}
          </p>
        ) : null}
        {!candidates ? (
          <p aria-busy="true" className="m-0 text-subhead text-[var(--muted)]">
            {t.common.errors.loading}
          </p>
        ) : shown.length === 0 ? (
          <p className="m-0 text-subhead text-[var(--muted)]">
            {pickWords.noMatches}
          </p>
        ) : (
          <div className="rounded-[var(--radius-card)] bg-[var(--ground)] p-1">
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
                // A certain clash first; else one combined "check yourself".
                const clash = describeClashes(recipe.clashes, t.mealPreferences)
                return (
                  <InsetRow
                    key={recipe._id}
                    title={recipe.title}
                    footnote={clash ?? (facts.join(' · ') || undefined)}
                    footnoteTone={
                      recipe.clashes.some((entry) => !entry.uncertain)
                        ? 'danger'
                        : 'muted'
                    }
                    leading={
                      <MealThumb imageUrl={recipe.imageUrl} quick={false} />
                    }
                    onClick={() => choose({ recipeId: recipe._id })}
                  />
                )
              })}
            </InsetList>
          </div>
        )}

        <h3 className={labelClass}>{pickWords.quickMeals}</h3>
        <div className="rounded-[var(--radius-card)] bg-[var(--ground)] p-1">
          <InsetList>
            {quickMeals.map((entry) =>
              composer?.id === entry._id ? (
                editor
              ) : (
                <InsetRow
                  key={entry._id}
                  title={entry.title}
                  footnote={
                    entry.prepMinutes
                      ? fmt(words.minutes, { minutes: entry.prepMinutes })
                      : undefined
                  }
                  leading={<MealThumb quick />}
                  onClick={() => choose({ mealEntryId: entry._id })}
                  menu={
                    <RowMenu
                      item={entry.title}
                      actions={[
                        {
                          id: 'edit',
                          label: pickWords.edit,
                          onSelect: () => {
                            setQuickFailed(false)
                            setComposer({
                              id: entry._id,
                              name: entry.title,
                              minutes: entry.prepMinutes
                                ? String(entry.prepMinutes)
                                : '',
                            })
                          },
                        },
                        {
                          id: 'delete',
                          label: pickWords.delete,
                          danger: true,
                          onSelect: () =>
                            confirm({
                              title: fmt(pickWords.deleteTitle, {
                                title: entry.title,
                              }),
                              body: pickWords.deleteBody,
                              confirmLabel: pickWords.delete,
                              errorFallback: words.failed,
                              run: () =>
                                removeQuick({ groupSlug, id: entry._id }),
                            }),
                        },
                      ]}
                    />
                  }
                />
              ),
            )}
            {composer && !composer.id ? (
              editor
            ) : (
              <InsetRow
                title={pickWords.newQuickMeal}
                leading={<Plus className="size-5" aria-hidden="true" />}
                onClick={() => {
                  setQuickFailed(false)
                  setComposer({ name: '', minutes: '' })
                }}
              />
            )}
          </InsetList>
        </div>
        <p className="m-0 text-footnote text-[var(--muted)]">
          {pickWords.quickMealsFooter}
        </p>
      </Dialog>
      {dialog}
    </>
  )
}
