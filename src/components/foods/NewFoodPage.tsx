import { MEAL_NAMES } from '@gather/core/domain'
import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { addFoodLink, linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { FoodForm, type FoodFormValues } from './FoodForm'
import { offFoodValues, useBarcodeLookup } from './foodLookup'

export interface NewFoodSearch {
  barcode?: string
  name?: string
  /** Where the add sheet that sent us here lives, so saving can go back (#93/#79). */
  returnDate?: string
  returnMeal?: string
}

/** A query value that is text, however the router's JSON codec read it. */
function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  // The router's default search codec JSON.parses raw query values, so a
  // hand-typed/bookmarked/QR-code URL's bare-digit barcode (e.g.
  // `?barcode=3017620422003`, valid JSON as a *number*) parses as a number, not
  // a string — accept both so external deep links work the same as the in-app
  // scan flow's own JSON-quoted `navigate({ search: { barcode } })`.
  if (typeof value === 'number') return String(value)
  return undefined
}

/** What the new-food route may be opened with, validated identically everywhere. */
export function validateNewFoodSearch(
  search: Record<string, unknown>,
): NewFoodSearch {
  return {
    barcode: asString(search.barcode),
    name: asString(search.name),
    returnDate: asString(search.returnDate),
    returnMeal: asString(search.returnMeal),
  }
}

/** Adding a food to the Catalog, whole. */
export function NewFoodPage({
  barcode,
  name,
  returnDate,
  returnMeal,
}: NewFoodSearch) {
  const navigate = useNavigate()
  const lookUp = useBarcodeLookup()
  const create = useMutation(api.foods.create)
  // An action rather than the mutation, because an Open Food Facts save is
  // where the product's picture is fetched and stored (#69). Fetching it here,
  // at the save, rather than when the form was opened, is what makes abandoning
  // the review leave no stored picture behind (#93).
  const importFromOff = useAction(api.foodsLookup.importFromOff)
  const messages = useMessages()
  const { create: createText, form } = messages.foods

  // Foods → Add food. Fixed: nothing on this page is loaded before the trail
  // is true, so it is the same trail from the first paint.
  /**
   * Where saving hands the person back to, given the food that now exists.
   *
   * A day and a meal mean somebody came from the add sheet — reviewing an Open
   * Food Facts import (#93) or adding a food a search found nothing for (#79) —
   * so saving returns them to that meal with the food ready to log, rather than
   * stranding them in the Catalog. Otherwise, the food's own page.
   */
  const meal = MEAL_NAMES.find((m) => m === returnMeal)
  const after = (foodId: Id<'foods'>) =>
    returnDate && meal
      ? addFoodLink(returnDate, meal, foodId)
      : linkTo('food', { foodId })

  const trail: Crumb[] = [
    { label: messages.foods.list.title, link: linkTo('foods') },
    { label: createText.title },
  ]

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(Boolean(barcode))
  const [prefill, setPrefill] = useState<{
    values: Partial<FoodFormValues>
    version: number
  }>({ values: { barcode, name }, version: 0 })
  // Set when the form holds an Open Food Facts product, which is what makes
  // the save an import. Its picture is held as a URL rather than fetched:
  // nothing is stored until the save, so a review that is abandoned leaves no
  // blob behind (#93).
  const [offImport, setOffImport] = useState<{
    barcode: string
    imageUrl?: string
  } | null>(null)
  // Non-blocking — shown alongside the (still fully usable) blank form when
  // OFF times out or is unreachable, per spec §6 ("same as not-found, plus
  // a non-blocking error toast"). Distinct from `error`, which is reserved
  // for save failures.
  const [lookupNotice, setLookupNotice] = useState<string | null>(null)

  const hasLookedUp = useRef(false)
  // Mount-only: resolve the barcode from the URL to either an existing
  // local food (redirect straight there) or an Open Food Facts match
  // (prefill for review) — mirrors the recipe-import mount-only effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only
  useEffect(() => {
    if (!barcode || hasLookedUp.current) return
    hasLookedUp.current = true
    ;(async () => {
      try {
        const match = await lookUp(barcode)
        if (match.kind === 'food') {
          // A barcode you already have has nothing to review — and if somebody
          // came from the add sheet to log it, that is where they wanted to
          // be, not on the food's page (#93).
          navigate({ ...after(match.food._id), replace: true })
          return
        }
        if (match.kind === 'product') {
          setPrefill({
            values: offFoodValues(match.product),
            version: Date.now(),
          })
          setOffImport({ barcode, imageUrl: match.product.imageUrl })
        }
      } catch {
        // A failed lookup (timeout, network error, thrown ConvexError)
        // leaves the form a blank manual entry prefilled with the barcode —
        // never blocks manual entry — but the user still gets a non-blocking
        // heads-up about why nothing was prefilled (spec §6).
        setLookupNotice(createText.offUnreachable)
      } finally {
        setLooking(false)
      }
    })()
  }, [])

  if (looking) {
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{createText.lookingUp}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs trail={trail} />
      <h1 className="mb-6 text-2xl font-semibold">{createText.title}</h1>
      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {lookupNotice && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {lookupNotice}
        </p>
      )}
      <FoodForm
        key={`form-${prefill.version}`}
        submitting={submitting}
        initial={prefill.values}
        sourceNote={offImport ? createText.fromOff : undefined}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id: Id<'foods'> = offImport
              ? await importFromOff({ ...values, ...offImport })
              : await create(values)
            navigate(after(id))
          } catch (err) {
            setError(errorMessage(err, form.saveFailed))
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
