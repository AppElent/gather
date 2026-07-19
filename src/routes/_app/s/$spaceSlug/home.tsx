import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '../../../../components/spaces/SpaceContext'
export const Route = createFileRoute('/_app/s/$spaceSlug/home')({
  component: SpaceHome,
})
function SpaceHome() {
  const { space } = useSpace()
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="m-0 text-2xl font-semibold">{space.slug}</h1>
      <p className="mt-2 text-sm text-[var(--app-muted)]">
        Your Space dashboard is ready to customize.
      </p>
    </div>
  )
}
