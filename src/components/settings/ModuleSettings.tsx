import { useAction, useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  MODULES,
  type ModuleDef,
  type SpaceModuleState,
} from '../../lib/modules'
import { useSpace } from '../spaces/SpaceContext'

const unsafeApi = api as unknown as {
  spaceModules: {
    setState: unknown
    deleteData: unknown
  }
}

function stateFor(
  moduleId: string,
  states: readonly { moduleId: string; state: SpaceModuleState }[],
) {
  return (
    states.find((state) => state.moduleId === moduleId)?.state ?? 'archived'
  )
}

export function ModuleSettings() {
  const { space, role, modules } = useSpace()
  const setState = (useMutation as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceModules.setState,
  ) as (args: {
    spaceSlug: string
    moduleId: string
    state: SpaceModuleState
  }) => Promise<unknown>
  const deleteData = (useAction as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceModules.deleteData,
  ) as (args: {
    spaceSlug: string
    moduleId: string
    confirmation: string
  }) => Promise<unknown>
  const [confirmation, setConfirmation] = useState<Record<string, string>>({})

  if (role !== 'admin') {
    return (
      <section className="grid gap-2">
        <h1 className="m-0 text-2xl font-semibold">Module settings</h1>
        <p role="alert" className="m-0 text-sm text-[var(--app-muted)]">
          Admin access required
        </p>
      </section>
    )
  }

  const live = MODULES.filter((module) => module.availability === 'live')
  const comingSoon = MODULES.filter(
    (module) => module.availability === 'comingSoon',
  )
  const saveState = (moduleId: string, state: SpaceModuleState) =>
    void setState({ spaceSlug: space.slug, moduleId, state })

  const catalog = (items: readonly ModuleDef[], title: string) => (
    <section className="grid gap-3">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <div className="grid gap-3">
        {items.map((module) => {
          const state = stateFor(module.id, modules)
          const exactConfirmation = `DELETE ${module.label}`
          return (
            <article
              key={module.id}
              className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
            >
              <div>
                <h3 className="m-0 text-base font-semibold">{module.label}</h3>
                <p className="mb-0 mt-1 text-sm text-[var(--app-muted)]">
                  {module.description}
                </p>
                {module.availability === 'comingSoon' &&
                module.defaultForNewSpaces ? (
                  <p className="mb-0 mt-2 text-sm">
                    Enabled automatically when available
                  </p>
                ) : null}
                {state === 'archived' ? (
                  <p className="mb-0 mt-2 text-sm text-[var(--app-muted)]">
                    Archived modules keep their existing data until it is
                    permanently deleted.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {state === 'archived' ? (
                  <button
                    type="button"
                    onClick={() =>
                      saveState(
                        module.id,
                        module.availability === 'live'
                          ? 'enabled'
                          : 'preEnabled',
                      )
                    }
                  >
                    {module.availability === 'live' ? 'Enable' : 'Pre-enable'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => saveState(module.id, 'archived')}
                  >
                    Archive
                  </button>
                )}
              </div>
              {state === 'archived' ? (
                <details>
                  <summary>Delete module data permanently</summary>
                  <p className="text-sm text-[var(--app-muted)]">
                    Type {exactConfirmation} to permanently delete this module's
                    data.
                  </p>
                  <label className="grid gap-1 text-sm">
                    Confirmation
                    <input
                      value={confirmation[module.id] ?? ''}
                      onChange={(event) =>
                        setConfirmation((current) => ({
                          ...current,
                          [module.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={confirmation[module.id] !== exactConfirmation}
                    onClick={() =>
                      void deleteData({
                        spaceSlug: space.slug,
                        moduleId: module.id,
                        confirmation: confirmation[module.id] ?? '',
                      })
                    }
                  >
                    Permanently delete {module.label} data
                  </button>
                </details>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )

  return (
    <section className="grid gap-8">
      <header>
        <h1 className="m-0 text-2xl font-semibold">Module settings</h1>
        <p className="mb-0 mt-1 text-sm text-[var(--app-muted)]">
          Choose what is available in {space.name ?? 'this Space'}.
        </p>
      </header>
      {catalog(live, 'Live modules')}
      {catalog(comingSoon, 'Coming soon')}
    </section>
  )
}
