import { createFileRoute, Outlet } from '@tanstack/react-router'
export const Route = createFileRoute('/_app/s/$spaceSlug/settings')({
  component: Outlet,
})
