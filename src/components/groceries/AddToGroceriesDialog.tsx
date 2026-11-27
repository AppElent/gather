import {
  formatGroceryAmount,
  type GroceryAmount,
} from '@gather/core/groceries'
import type { AiCount } from '@gather/core/grocery-ai-batches'
import {
  groceryListsOf,
  inStockOf,
  openGroceryList,
} from '@gather/core/grocery-list'
import {
  type PickRow,
  pickRows,
  type RowMeta,
  type SourceLine,
  sectionsByAisle,
  settleLine,
} from '@gather/core/grocery-pick'
import { useMutation, useQuery } from 'convex/react'
import { Minus, Plus } from 'lucide-react'
import { type ReactNode, useId, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { InsetList, InsetRow } from '../app/InsetList'
import { ModuleTile } from '../app/ModuleTile'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { fieldClass } from '../recipes/fields'
import { readLastGroceryList, writeLastGroceryList } from './preferences'
import { useAisleOf, useRecipeLines } from './useRecipeLines'

export interface AddToGroceriesSource {
  title: string
  subtitle: string
  icon?: string
}

/**
 * Source-agnostic Add-to-groceries dialog (APP-316, APP-312; reused by
 * recipes and the week menu, APP-322): servings stepper or day grid, target
 * list selector, ingredient checkboxes with live scaling, merge previews, In
 * stock defaults and AI count.
 */
export function AddToGroceriesDialog({
  source,
  lines,
  servings,
  aiCount,
  readingAsText = false,
  preferredListId,
  days,
  byAisle = false,
  after,
  footnote,
  onAdded,
  onSending,
  onClose,
}: {
  source: AddToGroceriesSource
  /**
   * The lines, or what they are given the keys of the rows the person ticked
   * or unticked: the week menu keeps a line they touched while it was being
   * read apart from the item it merges into (APP-479).
   */
  lines:
    | readonly SourceLine[]
    | ((touched: ReadonlySet<string>) => readonly SourceLine[])
  servings?: { value: number; onChange: (value: number) => void }
  aiCount: AiCount | null
  readingAsText?: boolean
  preferredListId?: string
  /** The week menu's day grid, under the source card. */
  days?: ReactNode
  /** One section per aisle, in walking order, instead of one list. */
  byAisle?: boolean
  /** Below the lines: the week menu's meals to check, given the chosen list. */
  after?: (listId: Id<'taskLists'> | undefined) => ReactNode
  footnote?: string
  onAdded?: (listName: string) => void
  /** Told while the lines are being sent, so the days stay as they were. */
  onSending?: (sending: boolean) => void
  onClose: () => void
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const words = g.addLines
  const allLists = useQuery(api.taskLists.list, { groupSlug })
  const staples = useQuery(api.groceryStaples.list, { groupSlug })
  const addLines = useMutation(api.groceryLines.add)

  const lists = useMemo(
    () =>
      groceryListsOf(allLists ?? []).filter(
        (list) => list.provider === 'local' && list.writable,
      ),
    [allLists],
  )
  const [chosenListId, setChosenListId] = useState<string>()
  const list = openGroceryList(
    lists,
    chosenListId ?? preferredListId ?? readLastGroceryList(groupSlug),
  )
  const listId = list?._id

  const tasks = useQuery(
    api.tasks.listByList,
    listId ? { groupSlug, listId } : 'skip',
  )

  const inStock = useMemo(() => inStockOf(staples?.staples), [staples])
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const listSelectId = useId()
  const servingsLabelId = useId()

  const shown = useMemo(
    () =>
      typeof lines === 'function' ? lines(new Set(Object.keys(ticks))) : lines,
    [lines, ticks],
  )
  const detailed = shown.some((line) => line.detail)
  const pick = useMemo(
    () =>
      pickRows({
        lines: shown,
        servings: servings?.value,
        items: (tasks ?? []).map((task) => ({
          id: task._id,
          title: task.title,
          quantity: task.quantity,
          unit: task.unit,
          done: task.done,
        })),
        ticks,
        inStock,
        readingAsText,
      }),
    [shown, servings?.value, tasks, ticks, inStock, readingAsText],
  )

  const amountText = (amount: GroceryAmount) =>
    formatGroceryAmount(amount.quantity, amount.unit, locale, g.units)
  const amountOrOne = (amount: GroceryAmount) => amountText(amount) ?? '1'

  const metaText = (meta: RowMeta | null): string | null => {
    if (!meta) return null
    switch (meta.kind) {
      case 'merge':
        return fmt(words.merge, {
          from: amountOrOne(meta.from),
          to: amountOrOne(meta.to),
        })
      case 'already':
        return words.alreadyOn
      case 'covered':
        return meta.have.quantity === undefined && meta.have.unit === undefined
          ? words.alreadyOn
          : fmt(words.covered, { amount: amountOrOne(meta.have) })
      case 'inStock':
        // Under a meal ("Shakshuka · Tue · in stock"), the short form.
        if (detailed)
          return meta.adding ? words.inStockShortAdding : words.inStockShort
        return meta.adding ? words.inStockAdding : words.inStock
      case 'ai':
        return meta.earlier || !aiCount
          ? words.readWithAiEarlier
          : fmt(words.readWithAi, {
              used: String(aiCount.used),
              limit: String(aiCount.limit),
            })
      case 'reading':
        return readingAsText ? words.readingAsText : words.reading
      case 'text':
        return words.asText
    }
  }

  const toggle = (row: PickRow) => {
    if (busy) return
    const line = shown.find((candidate) => candidate.key === row.key) ?? row
    setTicks((current) => settleLine(current, line, !row.on))
  }

  const aisleTitles = useMemo(
    () =>
      byAisle
        ? pick.rows
            .filter(
              (row) => row.meta?.kind !== 'reading' && row.meta?.kind !== 'text',
            )
            .map((row) => row.title)
        : [],
    [byAisle, pick.rows],
  )
  const aisleOf = useAisleOf(groupSlug, listId, aisleTitles)
  const sections = byAisle
    ? sectionsByAisle(pick.rows, aisleOf)
    : [{ id: null, rows: pick.rows }]

  const count = pick.lines.length

  const submit = async () => {
    if (!list || count === 0 || busy) return
    setBusy(true)
    setFailed(false)
    onSending?.(true)
    try {
      await addLines({
        groupSlug,
        listId: list._id,
        source: source.title,
        lines: pick.lines,
      })
      writeLastGroceryList(groupSlug, list._id)
      onAdded?.(list.name)
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
      onSending?.(false)
    }
  }

  return (
    <Dialog
      title={words.title}
      onClose={onClose}
      actions={
        <div className="grid w-full gap-2">
          {failed ? (
            <p
              role="alert"
              className="m-0 text-footnote font-semibold text-[var(--danger)]"
            >
              {words.failed}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={buttonClass.secondary}
            >
              {messages.common.actions.cancel}
            </button>
            <button
              type="button"
              disabled={!list || count === 0 || pick.reading || busy}
              onClick={() => void submit()}
              className={buttonClass.primary}
            >
              {busy
                ? messages.common.actions.working
                : plural(locale, count, words.add)}
            </button>
          </div>
          <p className="m-0 text-right text-footnote text-[var(--muted)]">
            {footnote ?? words.footnote}
          </p>
        </div>
      }
    >
      <div className="grid gap-4" data-group="kitchen">
        <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-[var(--ground)] p-3">
          <ModuleTile
            group="kitchen"
            icon={source.icon ?? 'BookOpen'}
            size="m"
          />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-body font-semibold text-[var(--ink)]">
              {source.title}
            </p>
            <p className="m-0 text-footnote text-[var(--muted)]">
              {source.subtitle}
            </p>
          </div>
        </div>

        {days}

        <div className="flex flex-wrap items-end gap-3">
          {servings ? (
            <div className="grid gap-1.5">
              <span
                id={servingsLabelId}
                className="text-footnote font-semibold text-[var(--muted)]"
              >
                {words.servings}
              </span>
              <div
                role="group"
                aria-labelledby={servingsLabelId}
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] p-1"
              >
                <button
                  type="button"
                  aria-label={words.fewer}
                  disabled={servings.value <= 1}
                  onClick={() =>
                    servings.onChange(Math.max(1, servings.value - 1))
                  }
                  className="grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  data-testid="servings-value"
                  className="min-w-8 text-center font-rounded text-title-2 font-bold tabular-nums"
                >
                  {servings.value}
                </span>
                <button
                  type="button"
                  aria-label={words.more}
                  disabled={servings.value >= 99}
                  onClick={() =>
                    servings.onChange(Math.min(99, servings.value + 1))
                  }
                  className="grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid min-w-[160px] flex-1 gap-1.5">
            <label
              htmlFor={listSelectId}
              className="text-footnote font-semibold text-[var(--muted)]"
            >
              {words.toList}
            </label>
            {lists.length > 0 ? (
              <select
                id={listSelectId}
                value={listId ?? ''}
                onChange={(event) => setChosenListId(event.target.value)}
                className={fieldClass}
              >
                {lists.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="m-0 py-2 text-subhead text-[var(--muted)]">
                {words.noList}
              </p>
            )}
          </div>
        </div>

        {sections.map((section) => (
        <fieldset
            key={section.id ?? 'all'}
            className="m-0 grid gap-1 border-0 p-0"
          >
          <legend className="mb-1 text-footnote font-semibold text-[var(--muted)]">
            {section.id ? g.aisles[section.id] : words.ingredients}
          </legend>
          <div className="rounded-[var(--radius-control)] bg-[var(--ground)] px-3">
            {section.rows.map((row) => {
              const amount = row.adds
                ? `+${amountOrOne(row.adds)}`
                : row.amount.quantity === undefined
                  ? amountText(row.amount)
                  : amountOrOne(row.amount)
              const strongMeta = row.meta?.kind === 'merge' && row.on
              const why = metaText(row.meta)
              // "Already on: 3, becomes 5" says it all; the rest follow the meals.
              const meta = strongMeta
                ? why
                : [row.detail, why].filter(Boolean).join(' · ')
              return (
                <label
                  key={row.key}
                  className="flex min-h-[var(--size-row-min)] cursor-pointer items-center gap-3 py-2 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
                >
                  <input
                    type="checkbox"
                    checked={row.on}
                    disabled={busy}
                    onChange={() => toggle(row)}
                    className="size-5 shrink-0 accent-[var(--accent-text)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-body ${
                        row.on
                          ? 'font-semibold text-[var(--ink)]'
                          : 'text-[var(--muted)]'
                      }`}
                    >
                      {row.title}
                    </span>
                    {meta ? (
                      <span
                        className={`block text-footnote text-[var(--muted)] ${
                          strongMeta ? 'font-semibold text-[var(--ink)]' : ''
                        }`}
                      >
                        {meta}
                      </span>
                    ) : null}
                  </span>
                  {amount ? (
                    <span
                      className={`shrink-0 text-subhead font-bold tabular-nums ${
                        row.on ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {amount}
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>
        ))}

        {after?.(listId)}
      </div>
    </Dialog>
  )
}

/** Add-to-groceries dialog bound to a single Recipe. */
export function RecipeToGroceriesDialog({
  recipe,
  startServings,
  preferredListId,
  onAdded,
  onClose,
}: {
  recipe: {
    _id: string
    title: string
    ingredients: readonly string[]
    servings?: number
  }
  /** Where the stepper starts: a planned meal's servings. */
  startServings?: number
  preferredListId?: string
  onAdded?: (listName: string) => void
  onClose: () => void
}) {
  const { locale, messages } = useI18n()
  const words = messages.tasks.grocery.addLines
  const { lines, aiCount, readingAsText } = useRecipeLines({
    id: recipe._id,
    ingredients: recipe.ingredients,
    servings: recipe.servings,
  })
  const [servings, setServings] = useState(
    startServings ?? recipe.servings ?? 0,
  )

  return (
    <AddToGroceriesDialog
      source={{
        title: recipe.title,
        subtitle: recipe.servings
          ? plural(locale, recipe.servings, words.recipeServes)
          : words.recipe,
        icon: 'BookOpen',
      }}
      lines={lines}
      servings={
        recipe.servings ? { value: servings, onChange: setServings } : undefined
      }
      aiCount={aiCount}
      readingAsText={readingAsText}
      preferredListId={preferredListId}
      onAdded={onAdded}
      onClose={onClose}
    />
  )
}

/**
 * Chooser opened from Groceries' "From a recipe" button: pick a recipe from
 * the Current Group to open its Add-to-groceries dialog.
 */
export function FromRecipeDialog({
  preferredListId,
  onAdded,
  onClose,
}: {
  preferredListId?: Id<'taskLists'>
  onAdded?: (listName: string) => void
  onClose: () => void
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const recipes = useQuery(api.recipes.list, { groupSlug })
  const [pickedId, setPickedId] = useState<string | null>(null)

  const usable = useMemo(
    () => (recipes ?? []).filter((recipe) => recipe.ingredients.length > 0),
    [recipes],
  )
  const picked = usable.find((recipe) => recipe._id === pickedId)

  if (picked) {
    return (
      <RecipeToGroceriesDialog
        recipe={picked}
        preferredListId={preferredListId}
        onAdded={onAdded}
        onClose={onClose}
      />
    )
  }

  return (
    <Dialog
      title={g.web.fromRecipe}
      onClose={onClose}
      actions={
        <button
          type="button"
          onClick={onClose}
          className={buttonClass.secondary}
        >
          {messages.common.actions.cancel}
        </button>
      }
    >
      {recipes === undefined ? (
        <p className="m-0 text-subhead text-[var(--muted)]">
          {messages.common.errors.loading}
        </p>
      ) : usable.length === 0 ? (
        <p className="m-0 text-subhead text-[var(--muted)]">
          {g.web.chooseRecipeEmpty}
        </p>
      ) : (
        <div className="rounded-[var(--radius-control)] bg-[var(--ground)] p-2">
          <InsetList label={messages.modules.byId.recipes.label}>
            {usable.map((recipe) => (
              <InsetRow
                key={recipe._id}
                title={recipe.title}
                footnote={
                  recipe.servings
                    ? plural(locale, recipe.servings, g.addLines.recipeServes)
                    : plural(
                        locale,
                        recipe.ingredients.length,
                        messages.recipes.detail.ingredientCount,
                      )
                }
                leading={
                  <ModuleTile group="kitchen" icon="ChefHat" size="s" />
                }
                chevron
                onClick={() => setPickedId(recipe._id)}
              />
            ))}
          </InsetList>
        </div>
      )}
    </Dialog>
  )
}
