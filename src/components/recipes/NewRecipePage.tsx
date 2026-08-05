import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ImageUploadField } from '../app/ImageUploadField'
import { RecipeDestinationNotice } from './RecipeDestinationNotice'
import { RecipeForm, type RecipeFormValues } from './RecipeForm'
import type { RecipeDestination } from './recipeDestination'
import type { RecipeNav } from './recipeNav'

export interface NewRecipeSearch {
  url?: string
}

/** The import URL, validated identically on both routes. */
export function validateNewRecipeSearch(
  search: Record<string, unknown>,
): NewRecipeSearch {
  return { url: typeof search.url === 'string' ? search.url : undefined }
}

export interface NewRecipePageProps {
  /** A recipe URL to import on arrival, from `?url=`. */
  initialUrl?: string
  /** The Group the recipe lands in — resolved by the route, never guessed here. */
  destination: RecipeDestination
  nav: RecipeNav
}

/**
 * Adding a recipe, whole. Rendered by both `/recipes/new` and
 * `/g/<slug>/recipes/new`; the saved recipe is opened through `nav`, so the
 * Group-scoped route stays in its Group afterwards.
 *
 * Where the recipe *goes* arrives the same way, as `destination`. One page, one
 * mechanism, a different Group on each route — and the server is told which,
 * rather than deciding for itself.
 */
export function NewRecipePage({
  initialUrl,
  destination,
  nav,
}: NewRecipePageProps) {
  const create = useMutation(api.recipes.create)
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const importFromUrl = useAction(api.recipeImport.importFromUrl)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)
  const navigate = useNavigate()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [importUrl, setImportUrl] = useState(initialUrl ?? '')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [imported, setImported] = useState<{
    values: RecipeFormValues
    version: number
  } | null>(null)
  // Tracked separately from `imported` so a failed re-import can invalidate
  // it immediately without remounting RecipeForm/ImageUploadField (which
  // would wipe out anything the user typed since the last successful import).
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>()
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const runImport = async (url: string) => {
    if (!url.trim()) return
    setImporting(true)
    setImportError(null)
    // Invalidate the previous import's sourceUrl the moment a new attempt
    // starts — if this one fails, saving must not silently reattach the URL
    // from an earlier, unrelated successful import.
    setSourceUrl(null)
    try {
      const result = await importFromUrl({
        url: url.trim(),
        groupSlug: destination.groupSlug,
      })
      setImported({
        values: {
          title: result.title,
          description: result.description,
          ingredients: result.ingredients,
          steps: result.steps,
          tags: result.tags,
          servings: result.servings,
          nutrition: result.nutrition,
          nutritionSource: result.nutritionSource,
        },
        version: Date.now(),
      })
      setSourceUrl(result.sourceUrl)
      setImageId(result.imageId)
      setImageUrl(result.imageUrl)
    } catch (err) {
      setImportError(
        err instanceof ConvexError
          ? typeof err.data === 'string'
            ? err.data
            : 'Could not import that recipe'
          : err instanceof Error
            ? err.message
            : 'Could not import that recipe',
      )
    } finally {
      setImporting(false)
    }
  }

  const hasAutoImported = useRef(false)
  // Only ever run once, for the URL present when the page first loaded.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only
  useEffect(() => {
    if (initialUrl && !hasAutoImported.current) {
      hasAutoImported.current = true
      runImport(initialUrl)
    }
  }, [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>

      <div className="mx-auto mb-6 max-w-2xl rounded-xl border p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Import from URL</span>
          <div className="flex gap-2">
            <input
              className="w-full rounded border px-2 py-1"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://example.com/some-recipe"
            />
            <button
              type="button"
              disabled={importing || !importUrl.trim()}
              onClick={() => runImport(importUrl)}
              className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </label>
        <div className="mt-2">
          <RecipeDestinationNotice destination={destination} />
        </div>
        {importError && (
          <p className="mt-2 text-sm text-red-800">{importError}</p>
        )}
        {imported && !importing && !importError && (
          <p className="mt-2 text-sm text-green-700">
            Imported — review the details below, then save.
          </p>
        )}
      </div>

      <ImageUploadField
        key={`image-${imported?.version ?? 'blank'}`}
        imageUrl={imageUrl}
        preset="recipePhoto"
        generateUploadUrl={generateUploadUrl}
        onChange={(id) => {
          setImageId(id)
          if (id === undefined) setImageUrl(null)
        }}
      />

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <RecipeForm
        key={`form-${imported?.version ?? 'blank'}`}
        submitting={submitting}
        initial={imported?.values}
        destination={destination}
        onEstimate={
          aiConfigured ? (args) => estimateNutrition(args) : undefined
        }
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id = await create({
              ...values,
              groupSlug: destination.groupSlug,
              sourceUrl: sourceUrl ?? undefined,
              imageId,
            })
            navigate(nav.detail(id))
          } catch (err) {
            setError(
              err instanceof ConvexError
                ? typeof err.data === 'string'
                  ? err.data
                  : 'Could not save recipe'
                : err instanceof Error
                  ? err.message
                  : 'Could not save recipe',
            )
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
