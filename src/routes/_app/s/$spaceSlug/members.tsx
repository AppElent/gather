import { createFileRoute } from '@tanstack/react-router'
import { SpaceMembers } from '../../../../components/settings/SpaceMembers'

export const Route = createFileRoute('/_app/s/$spaceSlug/members')({
  component: SpaceMembers,
})
