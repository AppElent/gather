import { createFileRoute } from '@tanstack/react-router'
import { useGroup } from '../../../../components/app/GroupGate'

export const Route = createFileRoute('/_app/g/$groupSlug/')({
  component: GroupHome,
})

/**
 * A landing page that does one thing: name the Group you are in, so the gate
 * has somewhere to land and the switcher has somewhere to fall back to.
 *
 * #22 builds the real Home — the Group's shared surface, carrying its activity.
 * Nothing here should grow until then; anything added now is something that
 * ticket has to remove first.
 */
function GroupHome() {
  const group = useGroup()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{group.name}</h1>
      <p className="m-0 text-sm text-[var(--app-muted)]">
        {group.isPersonal
          ? 'Your own group. Anything kept here is private to you.'
          : 'Pick a module from the sidebar to get started.'}
      </p>
    </div>
  )
}
