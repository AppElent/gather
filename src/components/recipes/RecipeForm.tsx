import { useState } from 'react'

export interface RecipeFormValues {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  rating?: number
  prepMinutes?: number
}

interface Props {
  initial?: RecipeFormValues
  submitting: boolean
  onSubmit: (values: RecipeFormValues) => void
}

const lines = (s: string) =>
  s.split('\n').map((l) => l.trim()).filter(Boolean)
const csv = (s: string) =>
  s.split(',').map((l) => l.trim()).filter(Boolean)

export function RecipeForm({ initial, submitting, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [ingredients, setIngredients] = useState(
    (initial?.ingredients ?? []).join('\n'),
  )
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'))
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [rating, setRating] = useState(initial?.rating?.toString() ?? '')

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          ingredients: lines(ingredients),
          steps: lines(steps),
          tags: csv(tags),
          rating: rating ? Number(rating) : undefined,
        })
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input className="w-full rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea className="w-full rounded border px-2 py-1" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Ingredients</span>
        <textarea className="h-28 w-full rounded border px-2 py-1" value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="One per line" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Steps</span>
        <textarea className="h-28 w-full rounded border px-2 py-1" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="One per line" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tags</span>
        <input className="w-full rounded border px-2 py-1" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Rating (1–5)</span>
        <input type="number" min="1" max="5" className="w-24 rounded border px-2 py-1" value={rating} onChange={(e) => setRating(e.target.value)} />
      </label>
      <button type="submit" disabled={submitting} className="rounded-md border px-4 py-2 text-sm">
        {submitting ? 'Saving…' : 'Save recipe'}
      </button>
    </form>
  )
}
