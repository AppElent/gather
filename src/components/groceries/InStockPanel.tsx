import type { GroceryAisle } from '@gather/core/groceries'
import { useMutation, useQuery } from 'convex/react'
import { Check, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { type FormEvent, useId, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { InsetList, SectionFooter, SectionLabel } from '../app/InsetList'
import { RowMenu } from '../app/RowMenu'
import { fieldClass } from '../recipes/fields'

interface StapleRow {
  _id: Id<'groceryStaples'>
  name: string
  aisle: GroceryAisle
  low: boolean
  note?: string
  onList: boolean
}

export interface InStockPanelProps {
  groupSlug: string
  /** `panel` inside the desktop 340 px aside; `page` on `/groceries/in-stock`. */
  mode?: 'panel' | 'page'
}

/**
 * Groceries' In stock (APP-314, APP-316): staples grouped by aisle with a
 * one-click In stock / Running low toggle pill (`aria-pressed`), inline Add a
 * staple form, and delete confirmation.
 */
export function InStockPanel({ groupSlug, mode = 'panel' }: InStockPanelProps) {
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const words = g.inStock
  const data = useQuery(api.groceryStaples.list, { groupSlug })
  const setLow = useMutation(api.groceryStaples.setLow)
  const addStaple = useMutation(api.groceryStaples.add)
  const removeStaple = useMutation(api.groceryStaples.remove)
  const { confirm, dialog } = useConfirmAction()
  const errorText = useErrorMessage()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busyAdd, setBusyAdd] = useState(false)
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const addInputId = useId()

  const staples = (data?.staples ?? []) as StapleRow[]
  const lowCount = staples.filter((staple) => staple.low).length

  const sections = useMemo(() => {
    const grouped: { aisle: GroceryAisle; rows: StapleRow[] }[] = []
    for (const staple of staples) {
      const last = grouped.at(-1)
      if (last?.aisle === staple.aisle) last.rows.push(staple)
      else grouped.push({ aisle: staple.aisle, rows: [staple] })
    }
    return grouped
  }, [staples])

  const toggle = async (staple: StapleRow) => {
    if (togglingIds.has(staple._id)) return
    setError(null)
    setTogglingIds((current) => new Set(current).add(staple._id))
    try {
      await setLow({ groupSlug, id: staple._id, low: !staple.low })
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
    } finally {
      setTogglingIds((current) => {
        const next = new Set(current)
        next.delete(staple._id)
        return next
      })
    }
  }

  const submitAdd = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || busyAdd) return
    setBusyAdd(true)
    setError(null)
    try {
      await addStaple({ groupSlug, name: trimmed })
      setNewName('')
      setAdding(false)
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
    } finally {
      setBusyAdd(false)
    }
  }

  const confirmRemove = (staple: StapleRow) =>
    confirm({
      title: fmt(words.removeTitle, { name: staple.name }),
      body: words.removeBody,
      confirmLabel: messages.common.actions.delete,
      run: () => removeStaple({ groupSlug, id: staple._id }),
    })

  const metaOf = (staple: StapleRow): string | undefined => {
    if (!staple.low) return staple.note
    if (staple.onList && data?.list)
      return fmt(words.onList, { list: data.list.name })
    return data?.list ? undefined : words.noList
  }

  const renderRows = (rows: StapleRow[]) =>
    rows.map((staple) => {
      const meta = metaOf(staple)
      const busy = togglingIds.has(staple._id)
      return (
        <li
          key={staple._id}
          className={`group/row flex min-h-[var(--size-row-min)] items-center gap-2 py-2 [&+li]:border-t-[0.5px] [&+li]:border-[var(--hair)] ${
            mode === 'page' ? 'px-4' : ''
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold text-[var(--ink)]">
              {staple.name}
            </span>
            {meta ? (
              <span className="block truncate text-footnote text-[var(--muted)]">
                {meta}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            aria-pressed={staple.low}
            aria-label={fmt(staple.low ? words.toInStock : words.toLow, {
              name: staple.name,
            })}
            onClick={() => void toggle(staple)}
            className={`inline-flex min-h-8 pointer-coarse:min-h-[var(--size-control-min)] shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 text-footnote font-semibold whitespace-nowrap disabled:opacity-60 ${
              staple.low
                ? 'bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90'
                : 'bg-[var(--surface-2)] text-[var(--ink)] hover:opacity-85'
            }`}
          >
            {staple.low ? (
              <TriangleAlert className="size-3.5" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
            )}
            <span>{staple.low ? words.low : words.inStock}</span>
          </button>
          <RowMenu
            item={staple.name}
            actions={[
              {
                id: 'delete',
                label: messages.common.actions.delete,
                danger: true,
                icon: <Trash2 className="size-4" aria-hidden="true" />,
                onSelect: () => confirmRemove(staple),
              },
            ]}
          />
        </li>
      )
    })

  const addBlock = adding ? (
    <form
      onSubmit={(event) => void submitAdd(event)}
      className={`flex items-center gap-2 ${
        mode === 'page'
          ? 'rounded-[var(--radius-card)] bg-[var(--surface)] p-3.5'
          : 'border-t-[0.5px] border-[var(--hair)] pt-3'
      }`}
    >
      <label htmlFor={addInputId} className="sr-only">
        {words.add}
      </label>
      <input
        id={addInputId}
        type="text"
        value={newName}
        disabled={busyAdd}
        placeholder={words.addPlaceholder}
        onChange={(event) => setNewName(event.target.value)}
        className={`${fieldClass} min-w-0 flex-1`}
      />
      <button
        type="submit"
        disabled={busyAdd || !newName.trim()}
        className={buttonClass.primary}
      >
        {messages.common.actions.add}
      </button>
    </form>
  ) : (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className={`flex min-h-[var(--size-row-min)] w-full items-center gap-2 text-left text-subhead font-semibold text-[var(--accent-text)] ${
        mode === 'page'
          ? 'rounded-[var(--radius-card)] bg-[var(--surface)] px-4 hover:bg-[var(--surface-2)]'
          : 'border-t-[0.5px] border-[var(--hair)] pt-2 hover:opacity-80'
      }`}
    >
      <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
      <span>{words.add}</span>
    </button>
  )

  return (
    <div
      className={mode === 'panel' ? 'grid gap-3 p-4' : 'grid gap-4'}
      data-testid="in-stock-panel"
    >
      {data ? (
        <p className="m-0 text-footnote text-[var(--muted)]">
          {mode === 'panel' ? (
            <>
              <span className="font-semibold text-[var(--ink)] tabular-nums">
                {plural(locale, lowCount, words.running)}
              </span>
              {' · '}
              <span className="tabular-nums">
                {plural(locale, staples.length, words.staples)}
              </span>
              {' · '}
            </>
          ) : null}
          {words.sub}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="m-0 text-footnote font-semibold text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {data === undefined ? (
        <p className="m-0 text-subhead text-[var(--muted)]">
          {messages.common.errors.loading}
        </p>
      ) : sections.length === 0 ? (
        <p className="m-0 text-subhead text-[var(--muted)]">{words.empty}</p>
      ) : (
        <div className="grid gap-4">
          {sections.map(({ aisle, rows }) =>
            mode === 'page' ? (
              <section key={aisle}>
                <SectionLabel level={2}>{g.aisles[aisle]}</SectionLabel>
                <InsetList>{renderRows(rows)}</InsetList>
              </section>
            ) : (
              <section key={aisle} className="grid gap-1">
                <h3 className="m-0 text-footnote font-semibold text-[var(--muted)]">
                  {g.aisles[aisle]}
                </h3>
                <ul className="m-0 list-none p-0">{renderRows(rows)}</ul>
              </section>
            ),
          )}
        </div>
      )}

      {addBlock}

      {mode === 'page' ? (
        <SectionFooter>{words.footnote}</SectionFooter>
      ) : (
        <p className="m-0 text-footnote text-[var(--muted)]">
          {words.footnote}
        </p>
      )}
      {dialog}
    </div>
  )
}
