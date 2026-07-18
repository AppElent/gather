import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useConvex, useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import {
  FoodForm,
  type FoodFormValues,
} from '../../../components/foods/FoodForm'

export const Route = createFileRoute('/_app/foods/new')({
  component: NewFood,
  validateSearch: (search: Record<string, unknown>): { barcode?: string } => ({
    barcode: typeof search.barcode === 'string' ? search.barcode : undefined,
  }),
})

function NewFood() {
  const { barcode } = Route.useSearch()
  const navigate = useNavigate()
  const convex = useConvex()
  const lookupBarcode = useAction(api.foodsLookup.lookupBarcode)
  const create = useMutation(api.foods.create)
  const upsertFromOff = useMutation(api.foods.upsertFromOff)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(Boolean(barcode))
  const [prefill, setPrefill] = useState<{
    values: Partial<FoodFormValues>
    version: number
  }>({ values: { barcode }, version: 0 })
  const [sourceNote, setSourceNote] = useState<string | undefined>()
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
        navigate({
          to: '/foods/$foodId',
          params: { foodId: existing._id },
          replace: true,
        })
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
              servingSize: mapped.servingSize,
              servingLabel: mapped.servingLabel,
            },
            version: Date.now(),
          })
          setSourceNote('From Open Food Facts — review before saving.')
        }
      } catch {
        // A failed OFF lookup (timeout, network error, thrown ConvexError)
        // leaves the form a blank manual entry prefilled with the barcode —
        // never blocks manual entry — but the user still gets a non-blocking
        // heads-up about why nothing was prefilled (spec §6).
        setLookupNotice(
          "Couldn't reach Open Food Facts — fill in the details yourself.",
        )
      } finally {
        setLooking(false)
      }
    })()
  }, [])

  if (looking) {
    return <p className="text-sm opacity-60">Looking up barcode…</p>
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Add food</h1>
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
            const id = sourceNote
              ? await upsertFromOff({
                  ...values,
                  barcode: values.barcode as string,
                })
              : await create(values)
            navigate({ to: '/foods/$foodId', params: { foodId: id } })
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : 'Could not save food'
                : err instanceof Error
                  ? err.message
                  : 'Could not save food',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
