import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type {
  PropertyMapping,
  ProviderSource,
  SourceProperty,
} from '../../../convex/lib/taskProviders/types'
import type { ExternalProvider } from '../../lib/oauth'
import { SurfaceCard } from '../app/ShellPrimitives'
import {
  errorMessage,
  useConnectProvider,
} from '../settings/ConnectionsSettings'

type Step =
  | { kind: 'provider' }
  | { kind: 'local-name' }
  | { kind: 'source'; provider: ExternalProvider; sources: ProviderSource[] }
  | {
      kind: 'notion-mapping'
      source: ProviderSource
      schema: SourceProperty[]
    }

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold'
const inputClass =
  'min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-2 text-sm'

export function AddListFlow({ onDone }: { onDone: () => void }) {
  const connections = useQuery(api.integrations.listConnections)
  const listSources = useAction(api.integrations.listSources)
  const getSourceSchema = useAction(api.integrations.getSourceSchema)
  const createList = useMutation(api.taskLists.create)
  const connect = useConnectProvider('/tasks')

  const [step, setStep] = useState<Step>({ kind: 'provider' })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e, 'Something went wrong — try again.'))
    } finally {
      setBusy(false)
    }
  }

  function connectionFor(provider: ExternalProvider) {
    return connections?.find((c) => c.provider === provider)
  }

  async function pickExternal(provider: ExternalProvider) {
    await run(async () => {
      const sources = await listSources({ provider })
      setStep({ kind: 'source', provider, sources })
    })
  }

  async function pickSource(
    provider: ExternalProvider,
    source: ProviderSource,
  ) {
    setName(source.name)
    if (provider === 'todoist') {
      await run(async () => {
        const conn = connectionFor('todoist')
        if (!conn) throw new Error('No connection')
        await createList({
          name: source.name,
          provider: 'todoist',
          providerConfig: { connectionId: conn._id, sourceId: source.id },
        })
        onDone()
      })
      return
    }
    await run(async () => {
      const schema = await getSourceSchema({ provider, sourceId: source.id })
      setStep({ kind: 'notion-mapping', source, schema })
    })
  }

  async function createLocal(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await run(async () => {
      await createList({ name: trimmed, provider: 'local' })
      onDone()
    })
  }

  async function createNotion(
    source: ProviderSource,
    mapping: PropertyMapping,
  ) {
    await run(async () => {
      const conn = connectionFor('notion')
      if (!conn) throw new Error('No connection')
      await createList({
        name: name.trim() || source.name,
        provider: 'notion',
        providerConfig: {
          connectionId: conn._id,
          sourceId: source.id,
          propertyMapping: mapping,
        },
      })
      onDone()
    })
  }

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Add a list</h3>
        <button
          type="button"
          className="text-sm text-[var(--app-muted)]"
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
      {error && <p className="m-0 mb-2 text-sm text-red-600">{error}</p>}

      {step.kind === 'provider' && (
        <div className="grid gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setStep({ kind: 'local-name' })}
          >
            Local list — created and edited here
          </button>
          {(['notion', 'todoist'] as const).map((provider) =>
            connectionFor(provider) ? (
              <button
                key={provider}
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => void pickExternal(provider)}
              >
                {provider === 'notion' ? 'Notion' : 'Todoist'} — read-only
                mirror
              </button>
            ) : (
              <button
                key={provider}
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => void run(() => connect(provider))}
              >
                Connect {provider === 'notion' ? 'Notion' : 'Todoist'} first…
              </button>
            ),
          )}
        </div>
      )}

      {step.kind === 'local-name' && (
        <form onSubmit={(e) => void createLocal(e)} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            aria-label="List name"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass} disabled={busy}>
            Create
          </button>
        </form>
      )}

      {step.kind === 'source' && (
        <div className="grid gap-2">
          <p className="m-0 text-sm text-[var(--app-muted)]">
            {step.provider === 'notion'
              ? 'Pick the Notion database to mirror:'
              : 'Pick the Todoist project to mirror:'}
          </p>
          {step.sources.length === 0 && (
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Nothing found — make sure the connection has access to at least
              one {step.provider === 'notion' ? 'database' : 'project'}.
            </p>
          )}
          {step.sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => void pickSource(step.provider, source)}
            >
              {source.name}
            </button>
          ))}
        </div>
      )}

      {step.kind === 'notion-mapping' && (
        <NotionMappingForm
          schema={step.schema}
          name={name}
          onNameChange={setName}
          busy={busy}
          onSubmit={(mapping) => void createNotion(step.source, mapping)}
        />
      )}
    </SurfaceCard>
  )
}

function NotionMappingForm({
  schema,
  name,
  onNameChange,
  busy,
  onSubmit,
}: {
  schema: SourceProperty[]
  name: string
  onNameChange: (name: string) => void
  busy: boolean
  onSubmit: (mapping: PropertyMapping) => void
}) {
  const titleProps = schema.filter((p) => p.type === 'title')
  const doneProps = schema.filter(
    (p) => p.type === 'checkbox' || p.type === 'status',
  )
  const dateProps = schema.filter((p) => p.type === 'date')
  const selectProps = schema.filter((p) => p.type === 'select')
  const multiSelectProps = schema.filter((p) => p.type === 'multi_select')

  const [title, setTitle] = useState(titleProps[0]?.name ?? '')
  const [done, setDone] = useState(doneProps[0]?.name ?? '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('')
  const [labels, setLabels] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !done) return
    onSubmit({
      title,
      done,
      dueDate: dueDate || undefined,
      priority: priority || undefined,
      labels: labels || undefined,
    })
  }

  const selectClass =
    'min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-2 text-sm'

  function MappingSelect({
    label,
    value,
    onChange,
    options,
    required,
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: SourceProperty[]
    required?: boolean
  }) {
    return (
      <label className="grid gap-1 text-sm">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          {!required && <option value="">Not mapped</option>}
          {options.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="m-0 text-sm text-[var(--app-muted)]">
        Map this database's properties so gather knows how to read it. A status
        property counts as done when it is named Done, Complete, or Completed.
      </p>
      <label className="grid gap-1 text-sm">
        List name
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={selectClass}
          aria-label="List name"
        />
      </label>
      <MappingSelect
        label="Title property"
        value={title}
        onChange={setTitle}
        options={titleProps}
        required
      />
      <MappingSelect
        label="Done property (checkbox or status)"
        value={done}
        onChange={setDone}
        options={doneProps}
        required
      />
      <MappingSelect
        label="Due date property"
        value={dueDate}
        onChange={setDueDate}
        options={dateProps}
      />
      <MappingSelect
        label="Priority property (select named 1–4 or P1–P4)"
        value={priority}
        onChange={setPriority}
        options={selectProps}
      />
      <MappingSelect
        label="Labels property"
        value={labels}
        onChange={setLabels}
        options={multiSelectProps}
      />
      <button
        type="submit"
        disabled={busy || !title || !done}
        className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
      >
        Create linked list
      </button>
    </form>
  )
}
