import { Redirect } from 'expo-router'

import { moduleHref } from '../../../../../src/modules/moduleDestination'

/**
 * The Pantry folded into Groceries as In stock (APP-314). A link or a pin from
 * before lands there.
 */
export default function PantryRedirect() {
  return <Redirect href={moduleHref('/all/groceries/in-stock')} />
}
