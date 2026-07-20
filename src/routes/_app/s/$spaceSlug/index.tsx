import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_app/s/$spaceSlug/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/s/$spaceSlug/home',
      params: { spaceSlug: params.spaceSlug },
    })
  },
})
