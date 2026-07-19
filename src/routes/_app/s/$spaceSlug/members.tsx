import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '../../../../components/spaces/SpaceContext'
export const Route = createFileRoute('/_app/s/$spaceSlug/members')({
  component: SpaceMembers,
})
function SpaceMembers() {
  const { role } = useSpace()
  return <h1 className="m-0 text-2xl font-semibold">Members ({role})</h1>
}
