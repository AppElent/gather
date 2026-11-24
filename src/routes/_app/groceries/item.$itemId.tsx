import { createFileRoute } from '@tanstack/react-router'
import { GroceriesError } from '../../../components/groceries/GroceriesError'
import { GroceriesItemPage } from '../../../components/groceries/GroceriesNestedPages'

export const Route = createFileRoute('/_app/groceries/item/$itemId')({
  errorComponent: GroceriesError,
  component: GroceriesItemRoute,
})

function GroceriesItemRoute() {
  const { itemId } = Route.useParams()
  return <GroceriesItemPage itemId={itemId} />
}
