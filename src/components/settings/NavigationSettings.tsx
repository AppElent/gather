import { useMutation } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useSpaceModules } from '../spaces/SpaceContext'

const unsafeApi = api as unknown as {
  spacePreferences: { saveNavigation: unknown; resetNavigation: unknown }
  spaces: { saveDefaultNavigation: unknown }
}

function reorder(values: string[], value: string, direction: -1 | 1) {
  const index = values.indexOf(value)
  const next = index + direction
  if (index < 0 || next < 0 || next >= values.length) return values
  const copy = [...values]
  ;[copy[index], copy[next]] = [copy[next], copy[index]]
  return copy
}

export type NavigationMode = 'space' | 'personal'

export function NavigationSettings({ mode }: { mode?: NavigationMode }) {
  const { space, role, visibleModules, navigation } = useSpaceModules()
  const adminMode = mode ? mode === 'space' : role === 'admin'
  const initialPins = adminMode
    ? (navigation.spaceDefaultPinnedModuleIds ?? navigation.pinnedModuleIds)
    : navigation.pinnedModuleIds
  const [pins, setPins] = useState<string[]>([...initialPins])
  useEffect(() => setPins([...initialPins]), [initialPins])
  const moduleById = useMemo(
    () => new Map(visibleModules.map((module) => [module.id, module])),
    [visibleModules],
  )
  const savePersonal = (
    useMutation as unknown as (reference: unknown) => unknown
  )(unsafeApi.spacePreferences.saveNavigation) as (args: {
    spaceSlug: string
    pinnedModuleIds: string[]
  }) => Promise<unknown>
  const resetPersonal = (
    useMutation as unknown as (reference: unknown) => unknown
  )(unsafeApi.spacePreferences.resetNavigation) as (args: {
    spaceSlug: string
  }) => Promise<unknown>
  const saveDefault = (
    useMutation as unknown as (reference: unknown) => unknown
  )(unsafeApi.spaces.saveDefaultNavigation) as (args: {
    spaceSlug: string
    pinnedModuleIds: string[]
  }) => Promise<unknown>
  const selected = pins.map((id) => moduleById.get(id)).filter(Boolean)
  const available = visibleModules.filter((module) => !pins.includes(module.id))
  const preview = pins
    .slice(0, 3)
    .map((id) => moduleById.get(id)?.label)
    .filter(Boolean)

  return (
    <section className="grid max-w-2xl gap-6">
      <header>
        <h1 className="m-0 text-2xl font-semibold">
          {adminMode ? 'Space navigation' : 'My navigation'}
        </h1>
        <p className="mb-0 mt-1 text-sm text-[var(--app-muted)]">
          {adminMode
            ? 'Set the default menu for this Space.'
            : navigation.source === 'personal'
              ? 'Your menu is customized.'
              : 'You are using the Space default menu.'}
        </p>
      </header>
      <section className="grid gap-3">
        <h2 className="m-0 text-lg font-semibold">Menu items</h2>
        {selected.map((module, index) =>
          module ? (
            <div
              key={module.id}
              className="flex flex-wrap items-center gap-2 rounded border border-[var(--app-border)] p-2"
            >
              <span className="mr-auto font-medium">{module.label}</span>
              <button
                type="button"
                aria-label={`Move ${module.label} up`}
                disabled={index === 0}
                onClick={() =>
                  setPins((current) => reorder(current, module.id, -1))
                }
              >
                Move up
              </button>
              <button
                type="button"
                aria-label={`Move ${module.label} down`}
                disabled={index === selected.length - 1}
                onClick={() =>
                  setPins((current) => reorder(current, module.id, 1))
                }
              >
                Move down
              </button>
              <button
                type="button"
                aria-label={`Remove ${module.label}`}
                onClick={() =>
                  setPins((current) => current.filter((id) => id !== module.id))
                }
              >
                Remove
              </button>
            </div>
          ) : null,
        )}
        {available.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => setPins((current) => [...current, module.id])}
          >
            Add {module.label}
          </button>
        ))}
      </section>
      <section
        className="grid gap-2 rounded border border-[var(--app-border)] p-3"
        aria-label="Mobile menu preview"
      >
        <strong>Mobile preview</strong>
        <span>{['Home', ...preview, 'All'].join(' / ')}</span>
      </section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            void (adminMode
              ? saveDefault({ spaceSlug: space.slug, pinnedModuleIds: pins })
              : savePersonal({ spaceSlug: space.slug, pinnedModuleIds: pins }))
          }
        >
          {adminMode ? 'Save Space menu' : 'Save my menu'}
        </button>
        {!adminMode ? (
          <button
            type="button"
            onClick={() => void resetPersonal({ spaceSlug: space.slug })}
          >
            Use Space default
          </button>
        ) : null}
      </div>
    </section>
  )
}
