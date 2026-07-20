import { useAction } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useSpace } from '../spaces/SpaceContext'

const unsafeApi = api as unknown as {
  spaceAdmin: { rename: unknown; deleteSpace: unknown }
}

export function SpaceSettings() {
  const { space, role } = useSpace()
  const [name, setName] = useState(space.name ?? '')
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => setName(space.name ?? ''), [space.name])
  const rename = (useAction as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceAdmin.rename,
  ) as (args: { spaceSlug: string; name: string }) => Promise<unknown>
  const deleteSpace = (useAction as unknown as (reference: unknown) => unknown)(
    unsafeApi.spaceAdmin.deleteSpace,
  ) as (args: { spaceSlug: string; confirmation: string }) => Promise<unknown>
  const exactConfirmation = `DELETE ${space.name ?? 'SPACE'}`

  if (role !== 'admin')
    return (
      <p role="alert" className="m-0 text-sm text-[var(--app-muted)]">
        Admin access required
      </p>
    )

  return (
    <section className="grid max-w-2xl gap-8">
      <header>
        <h1 className="m-0 text-2xl font-semibold">Space settings</h1>
      </header>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim())
            void rename({ spaceSlug: space.slug, name: name.trim() })
        }}
      >
        <h2 className="m-0 text-lg font-semibold">Name</h2>
        <label className="grid gap-1 text-sm">
          Space name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!name.trim()}>
          Rename Space
        </button>
      </form>
      <section className="grid gap-3 rounded-[var(--app-radius)] border border-red-500/50 p-4">
        <h2 className="m-0 text-lg font-semibold">Danger zone</h2>
        <p className="m-0 text-sm text-[var(--app-muted)]">
          This deletes the Space and its module data. The operation can safely
          be retried if interrupted.
        </p>
        <label className="grid gap-1 text-sm">
          Type {exactConfirmation} to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={confirmation !== exactConfirmation}
          onClick={() =>
            void deleteSpace({ spaceSlug: space.slug, confirmation })
          }
        >
          Delete Space
        </button>
      </section>
    </section>
  )
}
