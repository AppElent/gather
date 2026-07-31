import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import { Icon } from '../../../../components/app/Icon'
import { Pill, SurfaceCard } from '../../../../components/app/ShellPrimitives'
import { moduleLink } from '../../../../lib/groupPaths'
import type { ModuleDef } from '../../../../lib/modules'
import { MODULE_GROUPS, modulesByGroup } from '../../../../lib/modules'
import {
  movePin,
  pinnedModuleIds,
  pinnedModules,
  togglePin,
} from '../../../../lib/pins'

/**
 * Every Module in this Group, pinned or not.
 *
 * This is what makes a large Module count tolerable without any Group ever
 * enabling or disabling one: everything is here, always, and Pins only decide
 * what you personally see first. It is a page rather than a sidebar section so
 * that the desktop sidebar and the mobile dock can end in the same place.
 */
export const Route = createFileRoute('/_app/g/$groupSlug/all')({
  component: AllModulesPage,
})

/** Says who can see a Module's data, so nobody has to infer it from the URL. */
function ScopeMark({ module }: { module: ModuleDef }) {
  if (module.scope !== 'personal') return null
  return (
    <span title="Only you can see this. It is the same in every group.">
      <Pill>Only you</Pill>
    </span>
  )
}

function ModuleFace({
  module,
  groupSlug,
}: {
  module: ModuleDef
  groupSlug: string
}) {
  return (
    <Link
      {...moduleLink(module, groupSlug)}
      className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 text-sm font-semibold text-[var(--app-fg)] no-underline"
    >
      <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon name={module.icon} className="h-4 w-4" />
      </span>
      <span className="truncate">{module.label}</span>
    </Link>
  )
}

const ROW =
  'flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] py-2 first:border-t-0 first:pt-0'

const BUTTON =
  'inline-flex min-h-8 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs font-semibold text-[var(--app-fg)] disabled:opacity-40'

function AllModulesPage() {
  const { groupSlug } = Route.useParams()
  const me = useQuery(api.users.me)
  const savePins = useMutation(api.users.setPins)

  // Until the answer arrives, showing the default would be showing somebody
  // else's pins — an empty list and disabled buttons is the honest state.
  const loaded = me !== undefined
  const ids = loaded ? pinnedModuleIds(me?.pinnedModuleIds) : []
  const pinned = loaded ? pinnedModules(me?.pinnedModuleIds) : []
  const byGroup = modulesByGroup()

  const write = (next: string[]) => {
    void savePins({ moduleIds: next })
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <header>
        <h1 className="m-0 text-2xl font-semibold">All modules</h1>
        <p className="mt-1 mb-0 text-sm leading-6 text-[var(--app-muted)]">
          Every module is available in this group. Pinning one keeps it in your
          own navigation — nobody else in the group sees your choices.
        </p>
      </header>

      <SurfaceCard ariaLabel="Your pins">
        <h2 className="m-0 mb-2 text-sm font-semibold">Your pins</h2>
        {pinned.length === 0 ? (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            {loaded
              ? 'Nothing pinned. Pin a module below to keep it in your navigation.'
              : 'Loading…'}
          </p>
        ) : (
          <div className="grid">
            {pinned.map((module, index) => (
              <div key={module.id} className={ROW}>
                <div className="flex min-w-0 items-center gap-2">
                  <ModuleFace module={module} groupSlug={groupSlug} />
                  <ScopeMark module={module} />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={index === 0}
                    aria-label={`Move ${module.label} up`}
                    onClick={() => write(movePin(ids, module.id, 'up'))}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={index === pinned.length - 1}
                    aria-label={`Move ${module.label} down`}
                    onClick={() => write(movePin(ids, module.id, 'down'))}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    aria-label={`Unpin ${module.label}`}
                    onClick={() => write(togglePin(ids, module.id))}
                  >
                    Unpin
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {MODULE_GROUPS.map((group) => (
        <SurfaceCard key={group} ariaLabel={group}>
          <h2 className="m-0 mb-2 text-sm font-semibold">{group}</h2>
          <div className="grid">
            {byGroup[group].map((module) => {
              const isOn = ids.includes(module.id)
              return (
                <div key={module.id} className={ROW}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <ModuleFace module={module} groupSlug={groupSlug} />
                    {module.status === 'placeholder' ? <Pill>Soon</Pill> : null}
                    <ScopeMark module={module} />
                  </div>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={!loaded}
                    aria-label={
                      isOn ? `Unpin ${module.label}` : `Pin ${module.label}`
                    }
                    onClick={() => write(togglePin(ids, module.id))}
                  >
                    {isOn ? 'Unpin' : 'Pin'}
                  </button>
                </div>
              )
            })}
          </div>
        </SurfaceCard>
      ))}
    </div>
  )
}
