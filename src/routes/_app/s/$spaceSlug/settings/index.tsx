import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_app/s/$spaceSlug/settings/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/s/$spaceSlug/settings/modules',
      params: { spaceSlug: params.spaceSlug },
    })
  },
})
