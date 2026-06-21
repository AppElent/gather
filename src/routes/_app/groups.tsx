import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'

export const Route = createFileRoute('/_app/groups')({ component: GroupsPage })

function GroupsPage() {
  const groups = useQuery(api.groups.myGroups)
  const createGroup = useMutation(api.groups.createGroup)
  const joinByInvite = useMutation(api.groups.joinByInvite)
  const setDefault = useMutation(api.groups.setDefaultGroup)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const errorMessage = (err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong'

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Groups</h1>

      {error && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {groups === undefined ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {groups.map((g) => (
            <li
              key={g._id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>
                {g.name}{' '}
                <span className="opacity-50">· invite {g.inviteCode}</span>
                {g.isDefault && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">
                    default
                  </span>
                )}
              </span>
              {!g.isDefault && (
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setError(null)
                    void setDefault({ groupId: g._id }).catch((err) =>
                      setError(errorMessage(err)),
                    )
                  }}
                >
                  Make default
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form
          className="rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            if (name.trim())
              void createGroup({ name: name.trim() })
                .then(() => setName(''))
                .catch((err) => setError(errorMessage(err)))
          }}
        >
          <p className="mb-2 text-sm font-medium">New group</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wine club"
            className="mb-2 w-full rounded border px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded border px-3 py-1 text-sm">
            Create
          </button>
        </form>

        <form
          className="rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            if (code.trim())
              void joinByInvite({ inviteCode: code.trim() })
                .then(() => setCode(''))
                .catch((err) => setError(errorMessage(err)))
          }}
        >
          <p className="mb-2 text-sm font-medium">Join with invite code</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="8-char code"
            className="mb-2 w-full rounded border px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded border px-3 py-1 text-sm">
            Join
          </button>
        </form>
      </div>
    </div>
  )
}
