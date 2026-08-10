import { FoodThumbnail } from '../nutrition/FoodThumbnail'

export type RecipeViewMode = 'grid' | 'banner' | 'compact'

export interface RecipeCardData {
  title: string
  rating?: number
  tags: string[]
  imageUrl: string | null
}

interface RecipeCardProps {
  recipe: RecipeCardData
  mode: RecipeViewMode
}

function Stars({ rating }: { rating?: number }) {
  if (rating == null) return null
  return <p className="text-xs opacity-60">{'★'.repeat(rating)}</p>
}

function Photo({
  imageUrl,
  className,
}: {
  imageUrl: string | null
  className: string
}) {
  return (
    <FoodThumbnail
      src={imageUrl}
      kind="recipe"
      className={className}
      glyphClassName="text-4xl"
    />
  )
}

export function RecipeCard({ recipe, mode }: RecipeCardProps) {
  if (mode === 'banner') {
    return (
      <div className="relative h-56 overflow-hidden rounded-xl">
        <Photo
          imageUrl={recipe.imageUrl}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="font-medium">{recipe.title}</p>
          <Stars rating={recipe.rating} />
        </div>
      </div>
    )
  }

  if (mode === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-xl border p-2">
        <Photo
          imageUrl={recipe.imageUrl}
          className="h-16 w-16 flex-shrink-0 rounded-lg"
        />
        <div>
          <p className="font-medium">{recipe.title}</p>
          <Stars rating={recipe.rating} />
          {recipe.tags.length > 0 && (
            <p className="mt-1 text-xs opacity-50">{recipe.tags.join(', ')}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-4">
      <Photo
        imageUrl={recipe.imageUrl}
        className="mb-3 h-32 w-full rounded-lg"
      />
      <p className="font-medium">{recipe.title}</p>
      <Stars rating={recipe.rating} />
      {recipe.tags.length > 0 && (
        <p className="mt-1 text-xs opacity-50">{recipe.tags.join(', ')}</p>
      )}
    </div>
  )
}
