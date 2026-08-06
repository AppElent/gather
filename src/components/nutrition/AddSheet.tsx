import { Link } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { type ReactNode, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  computeFoodEntryNutrition,
  computeRecipeEntryNutrition,
  type MealName,
  type QuantityUnit,
} from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import type {
  OffMappedFood,
  OffSearchResult,
} from '../../../convex/lib/offMapping'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { BarcodeScanner } from '../foods/BarcodeScanner'
import { BottomSheet } from './BottomSheet'
import { useJustLogged } from './JustLogged'
import { NutrientInputGrid } from './NutrientInputGrid'
import { NutritionBreakdown } from './NutritionBreakdown'
import {
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from './nutrientInputs'
import type { NutritionNav } from './nutritionNav'
import { ResultCard } from './ResultCard'
import { useFoodSearch } from './useFoodSearch'

/**
 * 16px is load-bearing rather than taste: a mobile browser zooms the page when
 * a field below it takes focus, and the layout never comes back. Fixed by font
 * size, never by disabling user scaling, which would take pinch-zoom away from
 * everybody to spare us one bug.
 */
const fieldClass =
  'min-h-11 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px]'

const confirmClass =
  'min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60'

/** What a food needs to be logged; every source of one produces this much. */
interface FoodSummary {
  _id: Id<'foods'>
  name: string
  brand?: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  servingSize?: number
}

interface Props {
  date: string
  meal: MealName
  nav: NutritionNav
  onClose: () => void
}

/**
 * Adding food: one sheet, one list, no tabs.
 *
 * The dialog this replaces made you choose *what kind of thing* you were
 * logging — Recipes, Foods or Quick add — before you were allowed to search for
 * it. Here there is one search box and one list, with your foods, your Recipes
 * and Open Food Facts in labelled sections. Quick add is not a place any more:
 * it is what the empty result offers you, with the term you already typed as
 * the label.
 */
export function AddSheet({ date, meal, nav, onClose }: Props) {
  const search = useFoodSearch()
  const term = search.term.trim()
  const recipes = useQuery(api.recipes.listAcrossMyGroups, {})
  const createEntry = useMutation(api.consumption.create)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const convex = useConvex()
  const { announce } = useJustLogged()
  const messages = useMessages()
  const { add, foodAdd, meals } = {
    ...messages.nutrition.diary,
    meals: messages.nutrition.meals,
  }

  const [expanded, setExpanded] = useState<string | null>(null)
  const [promotions, setPromotions] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<FoodSummary | null>(null)
  const [scanFailure, setScanFailure] = useState<{
    barcode?: string
    message?: string
  } | null>(null)

  const toggle = (key: string) =>
    setExpanded((current) => (current === key ? null : key))

  /** Writes the entry, reports it so it can be undone, and leaves. */
  async function log(entry: {
    recipeId?: Id<'recipes'>
    foodId?: Id<'foods'>
    label: string
    quantity: number
    quantityUnit: QuantityUnit
    nutrition: NutritionFacts
  }) {
    const id = await createEntry({ date, meal, ...entry })
    announce(entry.label, [id])
    onClose()
  }

  // A barcode's product may already have a local row that a name search would
  // not have surfaced. Reuse it rather than upserting over it — upsertFromOff
  // would replace its name, nutrition and base unit with the mapped data.
  async function importOff(
    mapped: OffMappedFood,
    barcode: string,
  ): Promise<FoodSummary> {
    const existing = await convex.query(api.foods.getByBarcode, { barcode })
    if (existing) return existing
    const id = await upsertFromOff({
      barcode,
      name: mapped.name,
      brand: mapped.brand,
      baseUnit: 'g',
      nutritionPer100: mapped.nutritionPer100,
      servingSize: mapped.servingSize,
      servingLabel: mapped.servingLabel,
    })
    const saved = await convex.query(api.foods.get, { id })
    if (!saved) throw new Error(foodAdd.addFailed)
    return saved
  }

  async function onBarcode(barcode: string) {
    setScanFailure(null)
    try {
      const existing = await convex.query(api.foods.getByBarcode, { barcode })
      const food = existing ?? null
      if (food) {
        setScanned(food)
        setExpanded(`food:${food._id}`)
        setScanning(false)
        return
      }
      const mapped = await lookupBarcode({ barcode })
      if (!mapped) {
        setScanFailure({ barcode })
        return
      }
      const imported = await importOff(mapped, barcode)
      setScanned(imported)
      setExpanded(`food:${imported._id}`)
      setScanning(false)
    } catch {
      setScanFailure({ message: foodAdd.barcodeFailed })
    }
  }

  const foods = search.results ?? []
  const withNutrition = (recipes ?? []).filter((r) => r.nutrition)
  const matchingRecipes = term
    ? withNutrition.filter((r) =>
        r.title.toLowerCase().includes(term.toLowerCase()),
      )
    : withNutrition
  const offResults = search.offResults ?? []
  const foundNothing =
    term.length > 0 &&
    foods.length === 0 &&
    matchingRecipes.length === 0 &&
    offResults.length === 0 &&
    !search.offSearching

  return (
    <BottomSheet
      label={fmt(add.title, { meal: meals[meal] })}
      onClose={onClose}
      promoteToFull={promotions || undefined}
      header={
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {fmt(add.title, { meal: meals[meal] })}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={messages.common.actions.close}
              className="min-h-11 min-w-11 text-lg opacity-60"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search.term}
              onChange={(e) => search.setTerm(e.target.value)}
              onFocus={() => setPromotions((n) => n + 1)}
              placeholder={add.searchPlaceholder}
              aria-label={add.searchPlaceholder}
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => setScanning((on) => !on)}
              className="min-h-11 shrink-0 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm"
            >
              {scanning ? add.hideScanner : add.scan}
            </button>
          </div>
        </div>
      }
    >
      {scanning && (
        <div className="mb-3">
          <BarcodeScanner onDetected={onBarcode} />
        </div>
      )}
      {scanFailure && (
        <p className="mb-3 text-xs opacity-60">
          {scanFailure.message ?? (
            <>
              {foodAdd.notFound}{' '}
              <Link
                {...nav.createFood(scanFailure.barcode)}
                className="underline"
              >
                {foodAdd.addToLibrary}
              </Link>{' '}
              {foodAdd.addToLibraryAfter}
            </>
          )}
        </p>
      )}

      {scanned && (
        <Section title={add.sections.scanned}>
          <FoodCard
            food={scanned}
            expanded={expanded === `food:${scanned._id}`}
            onToggle={() => toggle(`food:${scanned._id}`)}
            onLog={log}
          />
        </Section>
      )}

      {foods.length > 0 && (
        <Section title={add.sections.foods}>
          {foods.map((food) => (
            <FoodCard
              key={food._id}
              food={food}
              expanded={expanded === `food:${food._id}`}
              onToggle={() => toggle(`food:${food._id}`)}
              onLog={log}
            />
          ))}
        </Section>
      )}

      {matchingRecipes.length > 0 && (
        <Section title={add.sections.recipes}>
          {matchingRecipes.map((recipe) => (
            <RecipeCard
              key={recipe._id}
              recipe={{
                _id: recipe._id,
                title: recipe.title,
                // Filtered to recipes that have it, which the type cannot see.
                nutrition: recipe.nutrition as NutritionFacts,
              }}
              expanded={expanded === `recipe:${recipe._id}`}
              onToggle={() => toggle(`recipe:${recipe._id}`)}
              onLog={log}
            />
          ))}
        </Section>
      )}

      {search.offSearching && (
        <p className="py-2 text-xs opacity-60">{foodAdd.searching}</p>
      )}
      {search.offError && (
        <p className="py-2 text-xs text-red-700">{foodAdd[search.offError]}</p>
      )}
      {offResults.length > 0 && (
        <Section title={add.sections.off}>
          {offResults.map((result) => (
            <OffCard
              key={result.barcode}
              result={result}
              expanded={expanded === `off:${result.barcode}`}
              onToggle={() => toggle(`off:${result.barcode}`)}
              onImport={importOff}
              onLog={log}
            />
          ))}
        </Section>
      )}

      {foundNothing && (
        <Section title={fmt(add.nothingFound, { term })}>
          <OneOffCard
            term={term}
            expanded={expanded === 'one-off'}
            onToggle={() => toggle('one-off')}
            onLog={log}
          />
        </Section>
      )}

      {!term && matchingRecipes.length === 0 && !scanned && (
        <p className="py-2 text-sm opacity-60">{add.searchHint}</p>
      )}
    </BottomSheet>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
        {title}
      </h3>
      <ul className="grid gap-2">{children}</ul>
    </div>
  )
}

type LogFn = (entry: {
  recipeId?: Id<'recipes'>
  foodId?: Id<'foods'>
  label: string
  quantity: number
  quantityUnit: QuantityUnit
  nutrition: NutritionFacts
}) => Promise<void>

/**
 * The confirm at the bottom of every expanded card.
 *
 * Disabled until what it would write makes sense, and saying why rather than
 * being mysteriously grey.
 */
function Confirm({
  disabled,
  reason,
  busy,
  error,
  onConfirm,
}: {
  disabled: boolean
  reason: string
  busy: boolean
  error: string | null
  onConfirm: () => void
}) {
  const { add } = useMessages().nutrition.diary
  return (
    <div className="mt-3 grid gap-2">
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onConfirm}
          className={confirmClass}
        >
          {add.confirm}
        </button>
        {disabled && <span className="text-xs opacity-60">{reason}</span>}
      </div>
    </div>
  )
}

/** Everything an expanded card shares: the amount, the figures, the confirm. */
function useLogging() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallback = useMessages().nutrition.diary.add.logFailed
  return {
    busy,
    error,
    run: async (write: () => Promise<void>) => {
      setBusy(true)
      setError(null)
      try {
        await write()
      } catch (err) {
        setError(errorMessage(err, fallback))
      } finally {
        setBusy(false)
      }
    },
  }
}

function FoodCard({
  food,
  expanded,
  onToggle,
  onLog,
}: {
  food: FoodSummary
  expanded: boolean
  onToggle: () => void
  onLog: LogFn
}) {
  const messages = useMessages()
  const { add, foodAdd } = messages.nutrition.diary
  const [amount, setAmount] = useState('100')
  const [unit, setUnit] = useState<'g' | 'ml' | 'piece'>(food.baseUnit)
  const { busy, error, run } = useLogging()

  const quantity = parseDecimal(amount)
  const valid = quantity !== undefined && quantity > 0
  const facts = valid ? computeFoodEntryNutrition(food, quantity, unit) : {}

  return (
    <ResultCard
      title={food.name}
      subtitle={food.brand}
      meta={
        food.nutritionPer100.calories !== undefined
          ? fmt(foodAdd.perHundred, {
              calories: Math.round(food.nutritionPer100.calories),
            })
          : undefined
      }
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={add.amount}
          className={`${fieldClass} w-24`}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'g' | 'ml' | 'piece')}
          aria-label={add.unit}
          className={fieldClass}
        >
          <option value={food.baseUnit}>{food.baseUnit}</option>
          {food.servingSize !== undefined && (
            <option value="piece">
              {fmt(foodAdd.pieceOf, {
                size: food.servingSize,
                unit: food.baseUnit,
              })}
            </option>
          )}
        </select>
      </div>
      <div className="mt-3">
        <NutritionBreakdown facts={facts} />
      </div>
      <Confirm
        disabled={!valid}
        reason={add.enterAmount}
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            if (quantity === undefined) return
            await onLog({
              foodId: food._id,
              label: food.name,
              quantity,
              quantityUnit: unit,
              nutrition: computeFoodEntryNutrition(food, quantity, unit),
            })
          })
        }
      />
    </ResultCard>
  )
}

function RecipeCard({
  recipe,
  expanded,
  onToggle,
  onLog,
}: {
  recipe: { _id: Id<'recipes'>; title: string; nutrition: NutritionFacts }
  expanded: boolean
  onToggle: () => void
  onLog: LogFn
}) {
  const { add, recipeAdd } = useMessages().nutrition.diary
  const [servings, setServings] = useState('1')
  const { busy, error, run } = useLogging()

  const quantity = parseDecimal(servings)
  const valid = quantity !== undefined && quantity > 0
  const facts = valid
    ? computeRecipeEntryNutrition(recipe.nutrition, quantity)
    : {}

  return (
    <ResultCard
      title={recipe.title}
      meta={
        recipe.nutrition.calories !== undefined
          ? fmt(recipeAdd.perServing, {
              calories: Math.round(recipe.nutrition.calories),
            })
          : undefined
      }
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          aria-label={add.amount}
          className={`${fieldClass} w-24`}
        />
        <span className="text-sm opacity-60">{recipeAdd.servings}</span>
      </div>
      <div className="mt-3">
        <NutritionBreakdown facts={facts} />
      </div>
      <Confirm
        disabled={!valid}
        reason={add.enterAmount}
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            if (quantity === undefined) return
            await onLog({
              recipeId: recipe._id,
              label: recipe.title,
              quantity,
              quantityUnit: 'serving',
              nutrition: computeRecipeEntryNutrition(
                recipe.nutrition,
                quantity,
              ),
            })
          })
        }
      />
    </ResultCard>
  )
}

/**
 * An Open Food Facts result is not a food yet. Confirming imports it — which is
 * what puts it in your own library for next time — and then logs it.
 */
function OffCard({
  result,
  expanded,
  onToggle,
  onImport,
  onLog,
}: {
  result: OffSearchResult
  expanded: boolean
  onToggle: () => void
  onImport: (mapped: OffMappedFood, barcode: string) => Promise<FoodSummary>
  onLog: LogFn
}) {
  const { add, foodAdd } = useMessages().nutrition.diary
  const [amount, setAmount] = useState(String(result.servingSize ?? 100))
  const { busy, error, run } = useLogging()

  const quantity = parseDecimal(amount)
  const valid = quantity !== undefined && quantity > 0
  const facts = valid ? computeFoodEntryNutrition(result, quantity, 'g') : {}

  return (
    <ResultCard
      title={result.name}
      subtitle={result.brand}
      meta={
        result.nutritionPer100.calories !== undefined
          ? fmt(foodAdd.perHundred, {
              calories: Math.round(result.nutritionPer100.calories),
            })
          : undefined
      }
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={add.amount}
          className={`${fieldClass} w-24`}
        />
        <span className="text-sm opacity-60">g</span>
      </div>
      <div className="mt-3">
        <NutritionBreakdown facts={facts} />
      </div>
      <Confirm
        disabled={!valid}
        reason={add.enterAmount}
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            if (quantity === undefined) return
            const food = await onImport(result, result.barcode)
            await onLog({
              foodId: food._id,
              label: food.name,
              quantity,
              quantityUnit: 'g',
              nutrition: computeFoodEntryNutrition(food, quantity, 'g'),
            })
          })
        }
      />
    </ResultCard>
  )
}

/**
 * What a search that matched nothing offers: log the words you already typed,
 * with whatever figures you have. A restaurant meal is not a dead end.
 */
function OneOffCard({
  term,
  expanded,
  onToggle,
  onLog,
}: {
  term: string
  expanded: boolean
  onToggle: () => void
  onLog: LogFn
}) {
  const { add } = useMessages().nutrition.diary
  const [inputs, setInputs] = useState(() => toNutrientInputs())
  const { busy, error, run } = useLogging()

  return (
    <ResultCard
      title={fmt(add.oneOffTitle, { term })}
      subtitle={add.oneOffHint}
      expanded={expanded}
      onToggle={onToggle}
    >
      <NutrientInputGrid
        values={inputs}
        onChange={(key, value) =>
          setInputs((prev) => ({ ...prev, [key]: value }))
        }
        disabled={busy}
      />
      <Confirm
        disabled={false}
        reason=""
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            await onLog({
              label: term,
              quantity: 1,
              quantityUnit: 'piece',
              nutrition: nutrientInputsToFacts(inputs),
            })
          })
        }
      />
    </ResultCard>
  )
}
