import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { RecipeForm } from '../../../components/recipes/RecipeForm'

export const Route = createFileRoute('/_app/recipes/new')({ component: NewRecipe })

function NewRecipe() {
  const create = useMutation(api.recipes.create)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>
      <RecipeForm
        submitting={submitting}
        onSubmit={async (values) => {
          setSubmitting(true)
          const id = await create(values)
          navigate({ to: '/recipes/$recipeId', params: { recipeId: id } })
        }}
      />
    </div>
  )
}
