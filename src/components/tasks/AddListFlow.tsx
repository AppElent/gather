import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type {
  PropertyMapping,
  ProviderSource,
  SourceProperty,
} from '../../../convex/lib/taskProviders/types'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, type Messages, useMessages } from '../../lib/i18n'
import type { ExternalProvider } from '../../lib/oauth'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useConnectProvider } from '../settings/ConnectionsSettings'

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

export interface AddListFlowProps {
  /** The Group the list is being added to. Always the one in the URL. */
  groupSlug: string
  /** Where the provider OAuth round-trip should come back to. */
  returnTo: string
  onDone: () => void
}

export function AddListFlow({ groupSlug, returnTo, onDone }: AddListFlowProps) {
  const connections = useQuery(api.integrations.listConnections, { groupSlug })
  const listSources = useAction(api.integrations.listSources)
  const getSourceSchema = useAction(api.integrations.getSourceSchema)
  const createList = useMutation(api.taskLists.create)
  const connect = useConnectProvider(groupSlug, returnTo)
  const messages = useMessages()
  const { addList, notionMapping } = messages.tasks

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
      setError(errorMessage(e, addList.failed))
    } finally {
      setBusy(false)
    }
  }

  function connectionFor(provider: ExternalProvider) {
    return connections?.find((c) => c.provider === provider)
  }

  async function pickExternal(provider: ExternalProvider) {
    await run(async () => {
      const sources = await listSources({ provider, groupSlug })
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
          groupSlug,
        })
        onDone()
      })
      return
    }
    await run(async () => {
      const schema = await getSourceSchema({
        provider,
        groupSlug,
        sourceId: source.id,
      })
      setStep({ kind: 'notion-mapping', source, schema })
    })
  }

  async function createLocal(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await run(async () => {
      await createList({ name: trimmed, provider: 'local', groupSlug })
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
        groupSlug,
      })
      onDone()
    })
  }

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">{addList.title}</h3>
        <button
          type="button"
          className="text-sm text-[var(--app-muted)]"
          onClick={onDone}
        >
          {messages.common.actions.cancel}
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
            {addList.local}
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
                {fmt(addList.mirror, {
                  provider: provider === 'notion' ? 'Notion' : 'Todoist',
                })}
              </button>
            ) : (
              <button
                key={provider}
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => void run(() => connect(provider))}
              >
                {fmt(addList.connectFirst, {
                  provider: provider === 'notion' ? 'Notion' : 'Todoist',
                })}
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
            placeholder={addList.listName}
            aria-label={addList.listName}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass} disabled={busy}>
            {addList.create}
          </button>
        </form>
      )}

      {step.kind === 'source' && (
        <div className="grid gap-2">
          <p className="m-0 text-sm text-[var(--app-muted)]">
            {step.provider === 'notion'
              ? addList.pickNotion
              : addList.pickTodoist}
          </p>
          {step.sources.length === 0 && (
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {step.provider === 'notion'
                ? addList.nothingFoundNotion
                : addList.nothingFoundTodoist}
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
          text={notionMapping}
          listNameLabel={addList.listName}
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

/**
 * Takes its words as props rather than reading the context itself — it is
 * defined below its only caller and rendered by it alone, so threading them
 * through keeps the whole flow's strings resolved in one place.
 */
function NotionMappingForm({
  text,
  listNameLabel,
  schema,
  name,
  onNameChange,
  busy,
  onSubmit,
}: {
  text: Messages['tasks']['notionMapping']
  listNameLabel: string
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
          {!required && <option value="">{text.notMapped}</option>}
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
      <p className="m-0 text-sm text-[var(--app-muted)]">{text.intro}</p>
      <label className="grid gap-1 text-sm">
        {listNameLabel}
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={selectClass}
          aria-label={listNameLabel}
        />
      </label>
      <MappingSelect
        label={text.titleProperty}
        value={title}
        onChange={setTitle}
        options={titleProps}
        required
      />
      <MappingSelect
        label={text.doneProperty}
        value={done}
        onChange={setDone}
        options={doneProps}
        required
      />
      <MappingSelect
        label={text.dueDateProperty}
        value={dueDate}
        onChange={setDueDate}
        options={dateProps}
      />
      <MappingSelect
        label={text.priorityProperty}
        value={priority}
        onChange={setPriority}
        options={selectProps}
      />
      <MappingSelect
        label={text.labelsProperty}
        value={labels}
        onChange={setLabels}
        options={multiSelectProps}
      />
      <button
        type="submit"
        disabled={busy || !title || !done}
        className="inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
      >
        {text.create}
      </button>
    </form>
  )
}
