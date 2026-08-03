import { createFileRoute } from '@tanstack/react-router'
import { RecipesPage } from '../../../../../components/recipes/RecipesPage'
import { groupRecipeNav } from '../../../../../components/recipes/recipeNav'

/**
 * Recipes inside a Group. The very same page as `/recipes`, differing only in
 * where its links go — every one of them carries the slug, so browsing on from
 * here stays in the Group you opened (ADR-0002).
 */
export const Route = createFileRoute('/_app/g/$groupSlug/recipes/')({
  component: GroupRecipeList,
})

function GroupRecipeList() {
  const { groupSlug } = Route.useParams()

  return <RecipesPage nav={groupRecipeNav(groupSlug)} groupSlug={groupSlug} />
}
