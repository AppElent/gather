import { createFileRoute, redirect } from '@tanstack/react-router'

// The Pantry folded into Groceries as In stock (APP-314); an old link lands
// on Groceries.
export const Route = createFileRoute('/_app/pantry')({
  beforeLoad: () => {
    throw redirect({ to: '/groceries' })
  },
})
