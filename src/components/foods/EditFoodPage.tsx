import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import { linkTo, newFoodLink } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { EditFoodForm } from './FoodForm'

export interface EditFoodPageProps {
  foodId: string
}

/** Editing a Catalog food, whole. */
export function EditFoodPage({ foodId }: EditFoodPageProps) {
  const food = useQuery(api.foods.get, { id: foodId as Id<'foods'> })
  const navigate = useNavigate()
  const messages = useMessages()
  const { detail, edit } = messages.foods

  // Foods → this food → Edit. The middle step is the page this form saves back
  // to, so the trail and the save land in the same place.
  const trail: Crumb[] = [
    { label: messages.foods.list.title, link: linkTo('foods') },
    ...(food ? [{ label: food.name, link: linkTo('food', { foodId }) }] : []),
    { label: messages.common.actions.edit },
  ]

  if (food === undefined)
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
      </div>
    )
  if (food === null)
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{detail.notFound}</p>
      </div>
    )

  // Reachable by typing the URL even though the detail page hides the link.
  // `foods.update` refuses too — this only avoids offering a form that is
  // guaranteed to fail on submit.
  if (!food.canEdit) {
    const builtIn = food.seedKey !== undefined
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <h1 className="mb-4 text-2xl font-semibold">{food.name}</h1>
        <p className="text-sm opacity-60">
          {builtIn && <>{edit.builtInBefore} </>}
          <Link {...newFoodLink()} className="underline">
            {detail.createYourOwn}
          </Link>
          {builtIn && <> {edit.builtInAfter}</>}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs trail={trail} />
      <h1 className="mb-6 text-2xl font-semibold">{edit.title}</h1>
      <EditFoodForm
        food={food}
        onSaved={() => navigate(linkTo('food', { foodId }))}
      />
    </div>
  )
}
