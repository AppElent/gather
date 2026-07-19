import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '../../../../components/spaces/SpaceContext'
export const Route = createFileRoute('/_app/s/$spaceSlug/modules')({
  component: SpaceModules,
})
function SpaceModules() {
  const { modules } = useSpace()
  return (
    <h1 className="m-0 text-2xl font-semibold">Modules ({modules.length})</h1>
  )
}
