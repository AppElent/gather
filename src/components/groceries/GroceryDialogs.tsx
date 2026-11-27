import {
  aisleOrder,
  GROCERY_AISLES,
  type GroceryAisle,
  isDefaultAisleOrder,
} from '@gather/core/groceries'
import { aisleCounts } from '@gather/core/grocery-list'
import { useMutation } from 'convex/react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { type FormEvent, useId, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { useDayIn } from '../../lib/useDayIn'
import { buttonClass } from '../app/buttons'
import { Dialog } from '../app/Dialog'
import { InsetList, InsetRow } from '../app/InsetList'
import { ModuleTile } from '../app/ModuleTile'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { inputClass } from '../recipes/fields'
import { moveItem } from './groceryList'

/**
 * Aisle order modal (`designs/groceries/web.md`, "Aisle order dialog"):
 * drag-and-drop plus up/down arrow buttons (keyboard & screen-reader path),
 * item counts per aisle, Restore default order, Cancel and Save.
 */
export function AisleOrderDialog({
  groupSlug,
  listId,
  listName,
  savedOrder,
  tasks,
  onClose,
}: {
  groupSlug: string
  listId: Id<'taskLists'>
  listName: string
  savedOrder: readonly string[] | null
  tasks: readonly Pick<Doc<'tasks'>, 'category' | 'done' | 'repeat' | 'dueDate'>[]
  onClose: () => void
}) {
  const { messages } = useI18n()
  const { timeZone } = useRequiredCurrentGroup()
  const g = messages.tasks.grocery
  const words = g.aisleOrder
  const setAisleOrder = useMutation(api.taskLists.setAisleOrder)

  const today = useDayIn(timeZone)
  const counts = useMemo(() => aisleCounts(tasks, today), [tasks, today])
  const [order, setOrder] = useState<GroceryAisle[]>(() =>
    aisleOrder(savedOrder),
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const isDefault = isDefaultAisleOrder(order)

  const step = (index: number, delta: -1 | 1) => {
    setOrder((current) => moveItem(current, index, index + delta))
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setFailed(false)
    try {
      await setAisleOrder({
        listId,
        groupSlug,
        order: isDefault ? null : order,
      })
      onClose()
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <Dialog
      title={words.title}
      onClose={onClose}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isDefault || saving}
            onClick={() => setOrder([...GROCERY_AISLES])}
            className="mr-auto text-subhead font-semibold text-[var(--accent-text)] hover:underline disabled:opacity-40"
          >
            {words.restore}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass.secondary}
          >
            {messages.common.actions.cancel}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className={buttonClass.primary}
          >
            {saving ? messages.common.actions.saving : words.save}
          </button>
        </div>
      }
    >
      <div className="grid gap-3" data-group="kitchen">
        <p className="m-0 text-subhead text-[var(--muted)]">
          {fmt(words.section, { list: listName })}
        </p>

        <ol className="m-0 list-none rounded-[var(--radius-control)] bg-[var(--ground)] px-2 py-1">
          {order.map((aisle, index) => {
            const label = g.aisles[aisle]
            const count = counts[aisle]
            return (
              <li
                key={aisle}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (dragIndex !== null && dragIndex !== index) {
                    setOrder((current) => moveItem(current, dragIndex, index))
                    setDragIndex(index)
                  }
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex min-h-11 items-center gap-2 px-1 [&+li]:border-t-[0.5px] [&+li]:border-[var(--hair)] ${
                  dragIndex === index ? 'rounded-[8px] bg-[var(--surface-2)]' : ''
                }`}
              >
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-[var(--muted)]"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 py-1.5 text-subhead font-semibold break-words text-[var(--ink)]">
                  {label}
                </span>
                {count ? (
                  <span className="min-w-5 text-right text-footnote text-[var(--muted)] tabular-nums">
                    {count}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={fmt(words.up, { aisle: label })}
                  onClick={() => step(index, -1)}
                  className="grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-30"
                >
                  <ChevronUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={index === order.length - 1}
                  aria-label={fmt(words.down, { aisle: label })}
                  onClick={() => step(index, 1)}
                  className="grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-30"
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ol>

        <p className="m-0 text-footnote text-[var(--muted)]">
          {words.footnote}
        </p>

        {failed ? (
          <p
            role="alert"
            className="m-0 text-footnote font-semibold text-[var(--danger)]"
          >
            {words.failed}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

/**
 * Create a new local grocery list (`kind: 'groceries'`, `keepGroceryList: true`).
 */
export function NewGroceryListDialog({
  groupSlug,
  onCreated,
  onClose,
}: {
  groupSlug: string
  onCreated: (listId: Id<'taskLists'>) => void
  onClose: () => void
}) {
  const { messages } = useI18n()
  const g = messages.tasks.grocery
  const createList = useMutation(api.taskLists.create)
  const errorText = useErrorMessage()

  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const listId = await createList({
        name: trimmed,
        provider: 'local',
        groupSlug,
        kind: 'groceries',
        keepGroceryList: true,
      })
      onCreated(listId)
      onClose()
    } catch (caught) {
      setError(errorText(caught, messages.tasks.newList.failed))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={g.lists.newList}
      onClose={onClose}
      initialFocus={inputRef}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass.secondary}
          >
            {messages.common.actions.cancel}
          </button>
          <button
            type="submit"
            form="new-grocery-list-form"
            disabled={busy || !name.trim()}
            className={buttonClass.primary}
          >
            {busy
              ? messages.common.actions.working
              : messages.tasks.newList.create}
          </button>
        </>
      }
    >
      <form
        id="new-grocery-list-form"
        onSubmit={(event) => void submit(event)}
        className="grid gap-3"
        data-group="kitchen"
      >
        <div className="grid gap-1.5">
          <label
            htmlFor={inputId}
            className="text-footnote font-semibold text-[var(--muted)]"
          >
            {messages.tasks.newList.nameLabel}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={name}
            disabled={busy}
            placeholder={g.web.newListPlaceholder}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </div>
        <p className="m-0 text-footnote text-[var(--muted)]">
          {g.lists.footnote}
        </p>
        {error ? (
          <p
            role="alert"
            className="m-0 text-footnote font-semibold text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}

/** Move one grocery item to another writable grocery list. */
export function MoveToListDialog({
  groupSlug,
  task,
  lists,
  onMoved,
  onClose,
}: {
  groupSlug: string
  task: Doc<'tasks'>
  lists: readonly { _id: Id<'taskLists'>; name: string; writable: boolean }[]
  onMoved: () => void
  onClose: () => void
}) {
  const { messages } = useI18n()
  const g = messages.tasks.grocery
  const moveToList = useMutation(api.tasks.moveToList)
  const errorText = useErrorMessage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targets = lists.filter(
    (list) => list.writable && list._id !== task.listId,
  )

  const choose = async (listId: Id<'taskLists'>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await moveToList({ taskId: task._id, groupSlug, listId })
      onMoved()
      onClose()
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={fmt(g.web.moveToListTitle, { name: task.title })}
      onClose={onClose}
      actions={
        <button
          type="button"
          onClick={onClose}
          className={buttonClass.secondary}
        >
          {messages.common.actions.cancel}
        </button>
      }
    >
      <div className="grid gap-3">
        {error ? (
          <p
            role="alert"
            className="m-0 text-footnote font-semibold text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
        <div className="rounded-[var(--radius-control)] bg-[var(--ground)] p-2">
          <InsetList label={g.lists.title}>
            {targets.map((list) => (
              <InsetRow
                key={list._id}
                title={list.name}
                leading={<ModuleTile group="kitchen" icon="Store" size="s" />}
                chevron
                onClick={() => void choose(list._id)}
              />
            ))}
          </InsetList>
        </div>
        <p className="m-0 text-footnote text-[var(--muted)]">
          {g.lists.footnote}
        </p>
      </div>
    </Dialog>
  )
}
