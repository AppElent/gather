import { Link } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { type ReactNode, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { type ComboCounts, comboEntries } from '../../../convex/lib/combos'
import {
  computeRecipeEntryNutrition,
  type MealName,
  type QuantityUnit,
} from '../../../convex/lib/consumption'
import type { NutritionFacts } from '../../../convex/lib/nutrition'
import { barcodeTerm } from '../../../convex/lib/offFetch'
import type {
  OffMappedFood,
  OffSearchResult,
} from '../../../convex/lib/offMapping'
import type { Serving } from '../../../convex/lib/servings'
import { offeredServings, resolveAmount } from '../../../convex/lib/servings'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { BarcodeScanner } from '../foods/BarcodeScanner'
import { BottomSheet } from './BottomSheet'
import { ComboCard, type ComboSummary } from './ComboCard'
import { FoodThumbnail } from './FoodThumbnail'
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
import {
  initialSelection,
  ServingPicker,
  type ServingSelection,
  toChoice,
} from './ServingPicker'
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
  servings?: Serving[]
  /** Resolved by the query from the stored file; null when there is no picture. */
  imageUrl?: string | null
}

/** What a recipe card needs, from a search match or from your own history. */
interface RecipeSummary {
  _id: Id<'recipes'>
  title: string
  nutrition: NutritionFacts
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
  const recipes = useQuery(api.recipes.listAcrossMyGroups, term ? {} : 'skip')
  // What this person usually has at *this* meal, most-chosen first (#76). Only
  // asked for while the search box is empty: once there is a term, the sheet is
  // answering that instead, and the whole library is behind it.
  const suggestions = useQuery(
    api.consumption.suggestionsForMeal,
    term ? 'skip' : { date, meal },
  )
  const combos = useQuery(api.combos.list, {})
  const createEntry = useMutation(api.consumption.create)
  const createEntries = useMutation(api.consumption.createMany)
  const replaceComboItems = useMutation(api.combos.replaceItems)
  const importFromOff = useAction(api.foodsLookup.importFromOff)
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const convex = useConvex()
  const { announce } = useJustLogged()
  const messages = useMessages()
  const { add, foodAdd, meals } = {
    ...messages.nutrition.diary,
    meals: messages.nutrition.meals,
  }

  const searchRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [comboBusy, setComboBusy] = useState(false)
  const [comboError, setComboError] = useState<string | null>(null)
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
  // not have surfaced. Reuse it rather than importing over it — the import
  // would replace its name, nutrition and base unit with the mapped data.
  async function importOff(
    mapped: OffMappedFood,
    barcode: string,
  ): Promise<FoodSummary> {
    const existing = await convex.query(api.foods.getByBarcode, { barcode })
    if (existing) return existing
    // An action rather than the mutation, because this is where the product's
    // picture is fetched and stored (#69).
    const id = await importFromOff({
      barcode,
      name: mapped.name,
      brand: mapped.brand,
      baseUnit: 'g',
      nutritionPer100: mapped.nutritionPer100,
      servings: mapped.servings,
      imageUrl: mapped.imageUrl,
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

  /**
   * Log a Combo as it stands today.
   *
   * The adjustments are today's entries only — the stored Combo is not touched
   * (ADR-0012). If it *was* changed, the confirmation carries an unobtrusive
   * offer to make the change permanent; ignoring it leaves the Combo alone.
   */
  async function logCombo(
    combo: ComboSummary,
    counts: ComboCounts,
    modified: boolean,
  ) {
    const entries = comboEntries(combo.components, counts)
    if (entries.length === 0) return
    setComboBusy(true)
    setComboError(null)
    try {
      const ids = await createEntries({
        date,
        meal,
        entries: entries.map((entry) => ({
          ...entry,
          foodId: entry.foodId as Id<'foods'> | undefined,
          recipeId: entry.recipeId as Id<'recipes'> | undefined,
        })),
      })
      announce(
        combo.name,
        ids,
        modified
          ? {
              label: fmt(messages.nutrition.diary.combos.update, {
                name: combo.name,
              }),
              run: async () => {
                await replaceComboItems({
                  id: combo._id as Id<'combos'>,
                  components: entries.map((entry) => ({
                    foodId: entry.foodId as Id<'foods'> | undefined,
                    recipeId: entry.recipeId as Id<'recipes'> | undefined,
                    label: entry.label,
                    quantity: entry.quantity,
                    quantityUnit: entry.quantityUnit,
                    nutrition:
                      entry.foodId || entry.recipeId
                        ? undefined
                        : entry.nutrition,
                  })),
                })
              },
            }
          : undefined,
      )
      onClose()
    } catch (err) {
      setComboError(errorMessage(err, messages.nutrition.diary.add.logFailed))
    } finally {
      setComboBusy(false)
    }
  }

  const matchingCombos = (combos ?? []).filter(
    (combo) => !term || combo.name.toLowerCase().includes(term.toLowerCase()),
  )
  // Empty box: your habits, bounded and ranked by the query. Anything typed:
  // what matches it. The two never mix — a term is a question the sheet has to
  // answer with the whole library rather than with the first screen's guesses.
  const foods: FoodSummary[] = term
    ? (search.results ?? [])
    : (suggestions?.foods ?? [])
  const matchingRecipes: RecipeSummary[] = term
    ? (recipes ?? [])
        .filter(
          (r) =>
            r.nutrition && r.title.toLowerCase().includes(term.toLowerCase()),
        )
        .map((r) => ({
          _id: r._id,
          title: r.title,
          // Filtered to recipes that have it, which the type cannot see.
          nutrition: r.nutrition as NutritionFacts,
        }))
    : (suggestions?.recipes ?? [])
  const offResults = search.offResults ?? []
  const foundNothing =
    term.length > 0 &&
    matchingCombos.length === 0 &&
    foods.length === 0 &&
    matchingRecipes.length === 0 &&
    offResults.length === 0 &&
    !search.offSearching
  // A barcode that matched nothing is not a thing to log the digits of: it is a
  // product nobody has yet, so it gets the route the scanner already has for
  // that — add it to your library, with the barcode it was looked up by —
  // rather than the one-off card, which would write "8712345678901" in a diary.
  const searchedBarcode = barcodeTerm(term)

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
            <div className="relative flex min-w-0 flex-1 items-center">
              <input
                ref={searchRef}
                value={search.term}
                onChange={(e) => search.setTerm(e.target.value)}
                onFocus={() => setPromotions((n) => n + 1)}
                placeholder={add.searchPlaceholder}
                aria-label={add.searchPlaceholder}
                className={`${fieldClass} w-full min-w-0 pr-12`}
              />
              {/* Only while there is something to clear: an always-present ✕
                  over an empty field is a control that does nothing. Focus goes
                  back to the input, so clearing is the start of the next search
                  rather than the end of this one — and the refocus re-promotes
                  the sheet, which is why clearing never drops it to peek. */}
              {search.term !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    search.setTerm('')
                    searchRef.current?.focus()
                  }}
                  aria-label={add.clearSearch}
                  className="absolute right-0 flex min-h-11 min-w-11 items-center justify-center text-sm opacity-60"
                >
                  ✕
                </button>
              )}
            </div>
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
          {/* Pressing Scan in the header is the press that starts the camera:
              this surface exists only because that was pressed, so making you
              press a second Scan inside it was two taps for one intent (#81).
              The header button is what stops it again. */}
          <BarcodeScanner onDetected={onBarcode} autoStart />
        </div>
      )}
      {scanFailure && (
        <p className="mb-3 text-xs opacity-60">
          {scanFailure.message ?? (
            <NoSuchBarcode barcode={scanFailure.barcode} nav={nav} />
          )}
        </p>
      )}

      {/* Combos first: the fastest path is the first thing you see. */}
      {matchingCombos.length > 0 && (
        <Section title={messages.nutrition.diary.combos.section}>
          {matchingCombos.map((combo) => (
            <ComboCard
              key={combo._id}
              combo={combo}
              expanded={expanded === `combo:${combo._id}`}
              onToggle={() => toggle(`combo:${combo._id}`)}
              busy={comboBusy}
              error={expanded === `combo:${combo._id}` ? comboError : null}
              onLog={(counts, modified) => logCombo(combo, counts, modified)}
            />
          ))}
        </Section>
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
        <Section title={term ? add.sections.foods : add.sections.usualFoods}>
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
        <Section
          title={term ? add.sections.recipes : add.sections.usualRecipes}
        >
          {matchingRecipes.map((recipe) => (
            <RecipeCard
              key={recipe._id}
              recipe={recipe}
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

      {foundNothing &&
        (searchedBarcode ? (
          <p className="py-2 text-xs opacity-60">
            <NoSuchBarcode barcode={searchedBarcode} nav={nav} />
          </p>
        ) : (
          <Section title={fmt(add.nothingFound, { term })}>
            <OneOffCard
              term={term}
              expanded={expanded === 'one-off'}
              onToggle={() => toggle('one-off')}
              onLog={log}
            />
          </Section>
        ))}

      {/* The hint used to require no Combos *and* no Recipes, and every recipe
          you owned counted — so it almost never appeared. Now that the first
          screen is your own history, it shows exactly when there is no history
          to show: a person who has logged nothing yet, for whom the search box
          really is the only way in. Both queries have to have answered first,
          or it flashes on the way to a full sheet. */}
      {!term &&
        combos !== undefined &&
        suggestions !== undefined &&
        matchingCombos.length === 0 &&
        foods.length === 0 &&
        matchingRecipes.length === 0 &&
        !scanned && <p className="py-2 text-sm opacity-60">{add.searchHint}</p>}
    </BottomSheet>
  )
}

/**
 * What a barcode nobody has offers: adding it yourself, with the barcode
 * already filled in — so the next person who scans or types it finds a food
 * rather than this line again. Shared by the scanner and by a barcode typed
 * into the search box, which are the same dead end reached two ways.
 */
function NoSuchBarcode({
  barcode,
  nav,
}: {
  barcode: string | undefined
  nav: NutritionNav
}) {
  const { foodAdd } = useMessages().nutrition.diary
  return (
    <>
      {foodAdd.notFound}{' '}
      <Link {...nav.createFood(barcode)} className="underline">
        {foodAdd.addToLibrary}
      </Link>{' '}
      {foodAdd.addToLibraryAfter}
    </>
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
  const { add, foodAdd } = useMessages().nutrition.diary
  // Your own past amounts for this food, which is what covers a Catalog food
  // nobody may edit and a food whose authored list is empty. Only asked for
  // once the card is open — a list of twenty results should not be twenty
  // queries about amounts nobody is looking at.
  const loggedAmounts = useQuery(
    api.consumption.loggedAmountsForFood,
    expanded ? { foodId: food._id } : 'skip',
  )
  const offered = offeredServings(food, loggedAmounts ?? [])
  const [selection, setSelection] = useState<ServingSelection | null>(null)
  const current = selection ?? initialSelection(offered)
  const { busy, error, run } = useLogging()

  const choice = toChoice(offered, current)
  const resolved = choice ? resolveAmount(food, choice) : undefined

  return (
    <ResultCard
      thumbnail={<FoodThumbnail src={food.imageUrl} alt={food.name} />}
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
      <ServingPicker
        baseUnit={food.baseUnit}
        offered={offered}
        selection={current}
        onSelect={setSelection}
      />
      <div className="mt-3">
        <NutritionBreakdown facts={resolved?.nutrition ?? {}} />
      </div>
      <Confirm
        disabled={!resolved}
        reason={add.enterAmount}
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            if (!resolved) return
            await onLog({
              foodId: food._id,
              label: food.name,
              quantity: resolved.amount,
              quantityUnit: food.baseUnit,
              nutrition: resolved.nutrition,
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
  // An Open Food Facts result is always in grams: it is not a food of yours
  // yet, so it has no base unit of its own and no history behind it.
  const offUnit = { ...result, baseUnit: 'g' as const }
  const offered = offeredServings(offUnit)
  const [selection, setSelection] = useState<ServingSelection | null>(null)
  const current = selection ?? initialSelection(offered)
  const { busy, error, run } = useLogging()

  const choice = toChoice(offered, current)
  const resolved = choice ? resolveAmount(offUnit, choice) : undefined

  return (
    <ResultCard
      thumbnail={<FoodThumbnail src={result.imageUrl} alt={result.name} />}
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
      <ServingPicker
        baseUnit="g"
        offered={offered}
        selection={current}
        onSelect={setSelection}
      />
      <div className="mt-3">
        <NutritionBreakdown facts={resolved?.nutrition ?? {}} />
      </div>
      <Confirm
        disabled={!resolved}
        reason={add.enterAmount}
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            if (!resolved) return
            const food = await onImport(result, result.barcode)
            // The import may hand back a row that already existed — one
            // somebody has since corrected by hand, or that carries different
            // figures from this result's. The entry must snapshot the food it
            // references, not the search result it was chosen from, or a later
            // quantity edit recomputes to figures the entry never had.
            const logged = resolveAmount(food, {
              kind: 'custom',
              value: resolved.amount,
              unit: 'base',
            })
            if (!logged) return
            await onLog({
              foodId: food._id,
              label: food.name,
              quantity: logged.amount,
              quantityUnit: food.baseUnit,
              nutrition: logged.nutrition,
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
