import { createFileRoute } from '@tanstack/react-router'

/**
 * The diary with nothing open on top of it.
 *
 * The day view itself is rendered by the parent route, which stays mounted
 * while `/nutrition/add` is open. This route exists to be the address the sheet
 * closes back to, and renders nothing of its own.
 */
export const Route = createFileRoute('/_app/nutrition/')({
  component: () => null,
})
