import { createFileRoute, notFound } from '@tanstack/react-router'

/** Retired and unknown URLs are deliberately not resolved or redirected. */
export const Route = createFileRoute('/_app/$')({
  beforeLoad: () => {
    throw notFound()
  },
})
