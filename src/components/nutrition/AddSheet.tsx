import { Link, useNavigate } from '@tanstack/react-router'
import { useAction, useConvex, useMutation, useQuery } from 'convex/react'
import { Barcode, Plus } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { type ComboCounts, comboEntries } from '../../../convex/lib/combos'
import {
  computeRecipeEntryNutrition,
  type MealName,
  type QuantityUnit,
} from '../../../convex/lib/consumption'
import type {
  NutritionFacts,
  NutritionSource,
} from '../../../convex/lib/nutrition'
import { barcodeTerm } from '../../../convex/lib/offFetch'
import type { OffSearchResult } from '../../../convex/lib/offMapping'
import type { Serving } from '../../../convex/lib/servings'
import { offeredServings, resolveAmount } from '../../../convex/lib/servings'
import type { AppLink } from '../../lib/appLink'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { BarcodeScanner } from '../foods/BarcodeScanner'
import { FoodForm } from '../foods/FoodForm'
import { IconPicker } from '../foods/IconPicker'
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
  barcode?: string
  baseUnit: 'g' | 'ml'
  nutritionPer100: NutritionFacts
  nutritionSource?: NutritionSource
  servings?: Serving[]
  /** Resolved by the query from the stored file; null when there is no picture. */
  imageUrl?: string | null
  /** The emoji somebody picked for it, shown when there is no picture (#94). */
  icon?: string
  /** Catalog rows are read-only, so they never get the editor. */
  seedKey?: string
  /** User-created foods can only be changed by their creator. */
  createdBy?: Id<'users'>
}

interface Props {
  date: string
  meal: MealName
  /**
   * The food a review form just saved and handed back (#93/#79). It opens
   * expanded and ready to log, so reviewing an import reads as a step inside
   * logging rather than a detour through the Catalog.
   */
  justAddedFoodId?: string
  nav: NutritionNav
  onClose: () => void
}

/**
 * Adding food: one sheet, one list, no tabs.
 *
 * The dialog this replaces made you choose *what kind of thing* you were
 * logging — Recipes, Foods or Quick add — before you were allowed to search for
 * it. Here there is one search box and one list, with your foods, your Recipes
 * and Open Food Facts in labelled sections. Quick add is not a separate place:
 * the always-visible Add control gives it and adding to the foods library equal
 * weight, while an empty result repeats both offers at the moment of highest
 * intent.
 */
export function AddSheet({ date, meal, justAddedFoodId, nav, onClose }: Props) {
  const search = useFoodSearch()
  const term = search.term.trim()
  const recipes = useQuery(api.recipes.listAcrossMyGroups, {})
  const combos = useQuery(api.combos.list, {})
  const me = useQuery(api.users.me)
  // The food a review form just saved. Read back rather than carried in the
  // URL, because what is logged has to be the row as it was written — the form
  // is where somebody may have corrected the figures.
  const justAdded = useQuery(
    api.foods.get,
    justAddedFoodId ? { id: justAddedFoodId as Id<'foods'> } : 'skip',
  )
  const createEntry = useMutation(api.consumption.create)
  const createEntries = useMutation(api.consumption.createMany)
  const replaceComboItems = useMutation(api.combos.replaceItems)
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)
  const storeOffImage = useAction(api.foodsLookup.storeOffImage)
  const convex = useConvex()
  const navigate = useNavigate()
  const { announce } = useJustLogged()
  const messages = useMessages()
  const { add, foodAdd, meals } = {
    ...messages.nutrition.diary,
    meals: messages.nutrition.meals,
  }

  const searchRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState<string | null>(
    justAddedFoodId ? `food:${justAddedFoodId}` : null,
  )
  // The add sheet stays mounted when its `food` search parameter changes. A
  // state initializer only sees the first value, so follow later return trips
  // too (#112).
  useEffect(() => {
    if (justAddedFoodId) setExpanded(`food:${justAddedFoodId}`)
  }, [justAddedFoodId])
  const [comboBusy, setComboBusy] = useState(false)
  const [comboError, setComboError] = useState<string | null>(null)
  const [promotions, setPromotions] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [adding, setAdding] = useState(false)
  const [scanned, setScanned] = useState<FoodSummary | null>(null)
  const [scanFailure, setScanFailure] = useState<{
    barcode?: string
    message?: string
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<{
    barcode: string
    message: string
  } | null>(null)
  // State only updates after React handles this event. The ref closes the gap
  // between two quick taps so they cannot start two imports before the buttons
  // rerender disabled.
  const importInFlight = useRef(false)

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
    /** Only a one-off sends one — everything else has a row to read it from. */
    icon?: string
  }) {
    const id = await createEntry({ date, meal, ...entry })
    announce(entry.label, [id])
    onClose()
  }

  /**
   * Reviewing a food before it exists: the pre-filled form, with the day and
   * the meal along for the ride so saving comes back here (#93/#79).
   *
   * There is no second editor and no second prefill. `NewFoodPage` already
   * resolves a barcode against Open Food Facts and fills the form from the
   * mapping, so an import is a *link to it*, not a copy of it.
   */
  function review(intent: { barcode?: string; name?: string }) {
    return nav.createFood({ ...intent, returnTo: { date, meal } })
  }

  /**
   * The fast OFF path writes the food first, then reopens this same meal with
   * its stored card expanded for the amount choice. Its photograph follows in
   * the background: an unreliable remote image must not hold up logging.
   *
   * OFF supplies figures per 100g and no reliable unit signal, which is the
   * same `g` default the review form starts with. Checking first remains how a
   * person changes that default or any imported figure before writing.
   */
  async function importOff(result: OffSearchResult): Promise<boolean> {
    if (importInFlight.current) return false
    importInFlight.current = true
    setImporting(true)
    setImportError(null)
    try {
      const id = await upsertFromOff({
        barcode: result.barcode,
        name: result.name,
        brand: result.brand,
        baseUnit: 'g',
        nutritionPer100: result.nutritionPer100,
        nutritionSource: 'imported',
        ...(result.servings?.length ? { servings: result.servings } : {}),
      })
      navigate(nav.addEntry(date, meal, id))
      if (result.imageUrl) {
        void storeOffImage({ id, imageUrl: result.imageUrl }).catch(() => {
          // A picture is decoration. The food already exists and is ready to
          // log, so a failed OFF fetch must remain invisible to that flow.
        })
      }
      return true
    } catch {
      setImportError({ barcode: result.barcode, message: foodAdd.importFailed })
      return false
    } finally {
      importInFlight.current = false
      setImporting(false)
    }
  }

  /**
   * A scanned barcode.
   *
   * A product you already have is not an import: it goes straight to the
   * expanded card, ready to log, which is the one-tap path #63/#66 built. A
   * named product that is *new* takes the fast import path. A product with no
   * `product_name` still opens review, whose required name field prevents an
   * import under the name `""` (#112).
   */
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
      setScanning(false)
      if (!mapped.name.trim()) {
        navigate(review({ barcode }))
        return
      }
      if (!(await importOff({ ...mapped, barcode }))) {
        setScanFailure({ message: foodAdd.importFailed })
      }
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
                    // Same rule as the figures beside it: only a one-off keeps
                    // its own, and this payload rebuilds every row, so leaving
                    // it out would drop the icon on every Combo edit.
                    icon:
                      entry.foodId || entry.recipeId ? undefined : entry.icon,
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
  // Returning from an OFF name search preserves the typed term. Its saved row
  // will now match that term too, but it belongs in the focused "Just added"
  // slot rather than twice in the list.
  const foods = (search.results ?? []).filter(
    (food) => food._id !== justAdded?._id,
  )
  const withNutrition = (recipes ?? []).filter((r) => r.nutrition)
  const matchingRecipes = term
    ? withNutrition.filter((r) =>
        r.title.toLowerCase().includes(term.toLowerCase()),
      )
    : withNutrition
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
          <div className="flex min-w-0 items-center gap-2">
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
              onClick={() => {
                setScanning((on) => !on)
                setAdding(false)
              }}
              aria-label={
                scanning ? add.hideScanner : messages.foods.scanner.scan
              }
              aria-pressed={scanning}
              title={scanning ? add.hideScanner : messages.foods.scanner.scan}
              className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)]"
            >
              <Barcode className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding((on) => !on)
                setScanning(false)
              }}
              aria-label={add.addFood}
              aria-expanded={adding}
              title={add.addFood}
              className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)]"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
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
            <NoSuchBarcode barcode={scanFailure.barcode} createFood={review} />
          )}
        </p>
      )}

      {adding && (
        <Section title={add.addOptions}>
          {!searchedBarcode && (
            <OneOffCard
              key={`one-off-${term}`}
              term={term}
              expanded={expanded === 'persistent-one-off'}
              onToggle={() => toggle('persistent-one-off')}
              onLog={log}
            />
          )}
          <li>
            <Link
              {...review(
                searchedBarcode
                  ? { barcode: searchedBarcode }
                  : term
                    ? { name: term }
                    : {},
              )}
              className="flex min-h-14 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2 text-sm no-underline"
            >
              {searchedBarcode
                ? foodAdd.addToLibrary
                : term
                  ? fmt(add.addAsFood, { term })
                  : add.addFood}
            </Link>
          </li>
        </Section>
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

      {justAdded && (
        <Section title={add.sections.justAdded}>
          <FoodCard
            key={justAdded._id}
            food={justAdded}
            expanded={expanded === `food:${justAdded._id}`}
            onToggle={() => toggle(`food:${justAdded._id}`)}
            onLog={log}
            canEdit={justAdded.createdBy === me?._id}
          />
        </Section>
      )}

      {scanned && (
        <Section title={add.sections.scanned}>
          <FoodCard
            food={scanned}
            expanded={expanded === `food:${scanned._id}`}
            onToggle={() => toggle(`food:${scanned._id}`)}
            onLog={log}
            canEdit={scanned.createdBy === me?._id}
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
              canEdit={food.createdBy === me?._id}
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
                imageUrl: recipe.imageUrl,
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
              importing={importing}
              error={
                importError?.barcode === result.barcode
                  ? importError.message
                  : null
              }
              onImport={() => importOff(result)}
              reviewLink={review({ barcode: result.barcode })}
            />
          ))}
        </Section>
      )}

      {foundNothing &&
        (searchedBarcode ? (
          <p className="py-2 text-xs opacity-60">
            <NoSuchBarcode barcode={searchedBarcode} createFood={review} />
          </p>
        ) : (
          // Two routes, both carrying the words already typed. A one-off is
          // right for a restaurant meal and wrong for a product you will eat
          // again next week — that one is logged once and can never be found
          // again, so the next search for the same words offers a one-off
          // again (#79). Which of the two this is is a thing only the person
          // knows, so both are offered rather than guessed at.
          <Section title={fmt(add.nothingFound, { term })}>
            <OneOffCard
              term={term}
              expanded={expanded === 'one-off'}
              onToggle={() => toggle('one-off')}
              onLog={log}
            />
            <li>
              <Link
                {...review({ name: term })}
                className="flex min-h-14 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2 text-sm no-underline"
              >
                {fmt(add.addAsFood, { term })}
              </Link>
            </li>
          </Section>
        ))}

      {!term &&
        matchingCombos.length === 0 &&
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
  createFood,
}: {
  barcode: string | undefined
  createFood: (intent: { barcode?: string }) => AppLink
}) {
  const { foodAdd } = useMessages().nutrition.diary
  return (
    <>
      {foodAdd.notFound}{' '}
      <Link {...createFood({ barcode })} className="underline">
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
      {/* `grid-cols-1` rather than a bare `grid`: the implicit column a bare
          `grid` creates is sized `auto`, whose *minimum* is the min-content
          width of its widest row, so one row that cannot shrink drags the whole
          section past the sheet — and every other row in it stretches to match
          (#83). `grid-cols-1` compiles to `repeat(1, minmax(0, 1fr))`, which
          pins the track to the container instead. */}
      <ul className="grid grid-cols-1 gap-2">{children}</ul>
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
  icon?: string
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
  canEdit,
}: {
  food: FoodSummary
  expanded: boolean
  onToggle: () => void
  onLog: LogFn
  canEdit: boolean
}) {
  const messages = useMessages()
  const { add, foodAdd } = messages.nutrition.diary
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
  const [editing, setEditing] = useState(false)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const updateFood = useMutation(api.foods.update)
  const current = selection ?? initialSelection(offered)
  const { busy, error, run } = useLogging()

  const choice = toChoice(offered, current)
  const resolved = choice ? resolveAmount(food, choice) : undefined

  return (
    <ResultCard
      thumbnail={<FoodThumbnail src={food.imageUrl} icon={food.icon} />}
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
      {food.seedKey === undefined && canEdit && (
        <div className="mt-3 border-t border-[var(--app-border)] pt-3">
          <button
            type="button"
            onClick={() => {
              setEditing((value) => !value)
              setEditError(null)
            }}
            className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm"
          >
            {editing ? messages.common.actions.cancel : foodAdd.editFood}
          </button>
          {editing && (
            <div className="mt-3">
              {editError && (
                <p className="mb-3 text-sm text-red-700">{editError}</p>
              )}
              <FoodForm
                key={food._id}
                submitting={editBusy}
                initial={{
                  name: food.name,
                  brand: food.brand,
                  barcode: food.barcode,
                  baseUnit: food.baseUnit,
                  icon: food.icon,
                  nutritionPer100: food.nutritionPer100,
                  servings: food.servings,
                  nutritionSource: food.nutritionSource,
                }}
                onSubmit={async ({
                  nutritionSource: _decidedByTheServer,
                  ...values
                }) => {
                  setEditBusy(true)
                  setEditError(null)
                  try {
                    await updateFood({ id: food._id, ...values })
                    setEditing(false)
                  } catch (err) {
                    setEditError(
                      errorMessage(err, messages.foods.form.saveFailed),
                    )
                  } finally {
                    setEditBusy(false)
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
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
  recipe: {
    _id: Id<'recipes'>
    title: string
    imageUrl: string | null
    nutrition: NutritionFacts
  }
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
      thumbnail={<FoodThumbnail src={recipe.imageUrl} kind="recipe" />}
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
 * Tapping an Open Food Facts result imports it, then returns to this meal with
 * the newly stored card expanded for its amount. Review remains available as a
 * secondary action for the times its incomplete data needs correcting (#112).
 */
function OffCard({
  result,
  importing,
  error,
  onImport,
  reviewLink,
}: {
  result: OffSearchResult
  importing: boolean
  error: string | null
  onImport: () => void
  reviewLink: AppLink
}) {
  const { foodAdd } = useMessages().nutrition.diary

  return (
    <li className="min-w-0 rounded-[var(--app-radius)] border border-[var(--app-border)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          disabled={importing}
          onClick={onImport}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
        >
          <FoodThumbnail src={result.imageUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {result.name}
            </span>
            {result.brand && (
              <span className="block truncate text-xs opacity-60">
                {result.brand}
              </span>
            )}
          </span>
          {result.nutritionPer100.calories !== undefined && (
            <span className="shrink-0 text-xs opacity-60">
              {fmt(foodAdd.perHundred, {
                calories: Math.round(result.nutritionPer100.calories),
              })}
            </span>
          )}
        </button>
        <Link
          {...reviewLink}
          className="flex min-h-11 shrink-0 items-center text-sm underline"
        >
          {foodAdd.review}
        </Link>
      </div>
      <p className="border-t border-[var(--app-border)] px-3 py-2 text-xs opacity-60">
        {error ?? foodAdd.reviewHint}
      </p>
    </li>
  )
}

/**
 * What a search that matched nothing offers: log the words you already typed,
 * with whatever figures you have. A restaurant meal is not a dead end.
 *
 * The icon here is the one case that can never be answered any other way: a
 * one-off has no food and no recipe behind it, so there is nothing for it to
 * inherit a picture from and there never will be (#94). It is decoration on
 * something ephemeral — logged once, never reused — and it earns its place
 * because the diary rows are where it shows.
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
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | undefined>()
  const { busy, error, run } = useLogging()

  return (
    <ResultCard
      title={term ? fmt(add.oneOffTitle, { term }) : add.oneOffTitleEmpty}
      subtitle={add.oneOffHint}
      expanded={expanded}
      onToggle={onToggle}
    >
      {!term && (
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">{add.oneOffName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${fieldClass} w-full`}
          />
        </label>
      )}
      <NutrientInputGrid
        values={inputs}
        onChange={(key, value) =>
          setInputs((prev) => ({ ...prev, [key]: value }))
        }
        disabled={busy}
      />
      <div className="mt-3">
        <IconPicker value={icon} onChange={setIcon} disabled={busy} />
      </div>
      <Confirm
        disabled={!term && name.trim() === ''}
        reason={add.enterOneOffName}
        busy={busy}
        error={error}
        onConfirm={() =>
          run(async () => {
            await onLog({
              label: term || name.trim(),
              quantity: 1,
              quantityUnit: 'piece',
              nutrition: nutrientInputsToFacts(inputs),
              icon,
            })
          })
        }
      />
    </ResultCard>
  )
}
