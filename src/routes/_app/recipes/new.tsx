import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ImageUploadField } from '../../../components/recipes/ImageUploadField'
import {
  RecipeForm,
  type RecipeFormValues,
} from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/new')({
  component: NewRecipe,
  validateSearch: (search: Record<string, unknown>): { url?: string } => ({
    url: typeof search.url === 'string' ? search.url : undefined,
  }),
})

function NewRecipe() {
  const create = useMutation(api.recipes.create)
  const importFromUrl = useAction(api.recipeImport.importFromUrl)
  const navigate = useNavigate()
  const { url: initialUrl } = Route.useSearch()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [importUrl, setImportUrl] = useState(initialUrl ?? '')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [imported, setImported] = useState<{
    values: RecipeFormValues
    sourceUrl: string
    version: number
  } | null>(null)

  const [imageId, setImageId] = useState<Id<'_storage'> | undefined>()
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const runImport = async (url: string) => {
    if (!url.trim()) return
    setImporting(true)
    setImportError(null)
    try {
      const result = await importFromUrl({ url: url.trim() })
      setImported({
        values: {
          title: result.title,
          description: result.description,
          ingredients: result.ingredients,
          steps: result.steps,
          tags: result.tags,
        },
        sourceUrl: result.sourceUrl,
        version: Date.now(),
      })
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
        key={imported?.version ?? 'blank'}
        imageUrl={imageUrl}
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
        key={imported?.version ?? 'blank'}
        submitting={submitting}
        initial={imported?.values}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            const id = await create({
              ...values,
              sourceUrl: imported?.sourceUrl,
              imageId,
            })
            navigate({ to: '/recipes/$recipeId', params: { recipeId: id } })
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
