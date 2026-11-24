import { createFileRoute } from '@tanstack/react-router'
import { GroceriesError } from '../../../components/groceries/GroceriesError'
import { GroceriesInStockPage } from '../../../components/groceries/GroceriesNestedPages'

export const Route = createFileRoute('/_app/groceries/in-stock')({
  errorComponent: GroceriesError,
  component: GroceriesInStockPage,
})
