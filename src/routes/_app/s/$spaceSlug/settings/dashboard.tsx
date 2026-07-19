import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/_app/s/$spaceSlug/settings/dashboard')({
  component: () => (
    <h1 className="m-0 text-2xl font-semibold">Dashboard settings</h1>
  ),
})
