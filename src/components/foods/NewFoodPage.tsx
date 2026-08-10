import { useNavigate } from '@tanstack/react-router'
import { useAction, useConvex, useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { AppLink } from '../../lib/appLink'
import { useMessages } from '../../lib/i18n'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { FoodForm, type FoodFormValues } from './FoodForm'
import type { FoodNav } from './foodNav'

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

export interface NewFoodPageProps {
  barcode?: string
  /** Prefills the name, for a search that matched nothing (#79). */
  name?: string
  /**
   * Where saving hands the person back to, given the food that now exists.
   *
   * Absent means the food's own page, which is where adding a food from the
   * Foods module has always landed. The add sheet supplies one so that
   * importing or adding a food *while logging breakfast* returns to breakfast
   * with the food ready to log, rather than stranding somebody in the Catalog
   * (#93, #79). Built by the route, which is the only thing that knows both
   * Modules' addresses.
   */
  after?: (foodId: Id<'foods'>) => AppLink
  nav: FoodNav
}

/** Adding a food to the Catalog, whole. Shared by both `new` routes. */
export function NewFoodPage({ barcode, name, after, nav }: NewFoodPageProps) {
  const navigate = useNavigate()
  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
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
  const trail: Crumb[] = [
    { label: messages.foods.list.title, link: nav.list },
    { label: createText.title },
  ]

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(Boolean(barcode))
  const [prefill, setPrefill] = useState<{
    values: Partial<FoodFormValues>
    version: number
  }>({ values: { barcode, name }, version: 0 })
  const [sourceNote, setSourceNote] = useState<string | undefined>()
  // Where Open Food Facts keeps this product's picture. Held rather than
  // fetched: nothing is stored until the save, so a review that is abandoned
  // leaves no blob behind (#93).
  const [offImageUrl, setOffImageUrl] = useState<string | undefined>()
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
      const existing = await convex.query(api.foods.getByBarcode, { barcode })
      if (existing) {
        // A barcode you already have is not an import, so there is nothing to
        // review — and if somebody came from the add sheet to log it, that is
        // where they wanted to be, not on the food's page (#93).
        const to = after ? after(existing._id) : nav.detail(existing._id)
        navigate({ ...to, replace: true })
        return
      }
      try {
        const mapped = await lookupBarcode({ barcode })
        if (mapped) {
          setPrefill({
            values: {
              barcode,
              name: mapped.name,
              brand: mapped.brand,
              nutritionPer100: mapped.nutritionPer100,
              servings: mapped.servings,
              // Open Food Facts' figures until the person types over one, at
              // which point the form says `manual` and the save records it.
              nutritionSource: 'imported',
            },
            version: Date.now(),
          })
          setOffImageUrl(mapped.imageUrl)
          setSourceNote(createText.fromOff)
        }
      } catch {
        // A failed OFF lookup (timeout, network error, thrown ConvexError)
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
        sourceNote={sourceNote}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id: Id<'foods'> = sourceNote
              ? await importFromOff({
                  ...values,
                  barcode: values.barcode as string,
                  imageUrl: offImageUrl,
                })
              : await create(values)
            navigate(after ? after(id) : nav.detail(id))
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : form.saveFailed
                : err instanceof Error
                  ? err.message
                  : form.saveFailed,
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
