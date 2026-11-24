import {
  GROCERY_AISLES,
  GROCERY_UNITS,
  type GroceryAisle,
  type GroceryUnit,
  stepGroceryQuantity,
} from '@gather/core/groceries'
import { aisleOf, stockKey } from '@gather/core/grocery-list'
import { useBlocker } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useId, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n, useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { Dialog } from '../app/Dialog'
import { DetailPanelHeader } from '../app/ListDetailLayout'
import { fieldClass, inputClass } from '../recipes/fields'
import {
  formatAmountDraft,
  parseAmountDraft,
  unitOptionLabel,
} from './groceryList'

export interface GroceryListOption {
  _id: Id<'taskLists'>
  name: string
  writable: boolean
}

/** The editable fields, as the form holds them. */
interface Draft {
  title: string
  amount: string
  unit: GroceryUnit | ''
  aisle: GroceryAisle
  listId: Id<'taskLists'>
  notes: string
  staple: boolean
}

export interface GroceryItemEditorProps {
  groupSlug: string
  task: Doc<'tasks'>
  lists: readonly GroceryListOption[]
  /** Closes the panel; absent on the item's own page. */
  onClose?: () => void
  /** The item left the list it was opened from: moved or deleted. */
  onDone: () => void
}

/**
 * Grocery item detail and editor (APP-316, `designs/groceries/web.md`): name,
 * amount, unit, aisle (which the Group remembers), list, note, and whether it
 * is a staple. Saving is explicit (`docs/standards/editors.md`): only the
 * fields changed here are held, so another Member's change to the rest shows
 * at once, and leaving with a change asks first.
 */
export function GroceryItemEditor({
  groupSlug,
  task,
  lists,
  onClose,
  onDone,
}: GroceryItemEditorProps) {
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const updateTask = useMutation(api.tasks.update)
  const moveToList = useMutation(api.tasks.moveToList)
  const removeTask = useMutation(api.tasks.remove)
  const staplesData = useQuery(api.groceryStaples.list, { groupSlug })
  const members = useQuery(api.groups.members, { slug: groupSlug })
  const addStaple = useMutation(api.groceryStaples.add)
  const removeStaple = useMutation(api.groceryStaples.remove)
  const { confirm, dialog: confirmDialog } = useConfirmAction()
  const errorText = useErrorMessage()

  const writable = lists.some(
    (list) => list._id === task.listId && list.writable,
  )
  const matchingStaple = useMemo(() => {
    const key = stockKey(task.title)
    return staplesData?.staples.find((staple) => stockKey(staple.name) === key)
  }, [task.title, staplesData])

  const saved: Draft = {
    title: task.title,
    amount: formatAmountDraft(task.quantity, locale),
    unit: task.unit ?? '',
    aisle: aisleOf(task),
    listId: task.listId,
    notes: task.notes ?? '',
    staple: Boolean(matchingStaple),
  }
  const [edits, setEdits] = useState<Partial<Draft>>({})
  const draft: Draft = { ...saved, ...edits }
  const edit = (change: Partial<Draft>) =>
    setEdits((current) => ({ ...current, ...change }))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A move or a delete leaves by itself; nothing is left to ask about then.
  const leaving = useRef(false)

  const nameId = useId()
  const qtyLabelId = useId()
  const unitId = useId()
  const aisleId = useId()
  const listIdField = useId()
  const noteId = useId()
  const stapleId = useId()

  const title = draft.title.trim()
  const notes = draft.notes.trim()
  const parsedAmount = parseAmountDraft(draft.amount)
  const amountValid = parsedAmount !== undefined
  const quantity = parsedAmount ?? undefined
  const unit = draft.unit || undefined

  const dirty =
    title !== saved.title ||
    !amountValid ||
    quantity !== task.quantity ||
    unit !== task.unit ||
    draft.aisle !== saved.aisle ||
    draft.listId !== saved.listId ||
    notes !== saved.notes ||
    draft.staple !== saved.staple

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !leaving.current,
    enableBeforeUnload: () => dirty && !leaving.current,
    withResolver: true,
  })

  const stepAmount = (direction: 1 | -1) => {
    const next = stepGroceryQuantity(quantity, unit, direction)
    if (next === null) return
    edit({ amount: formatAmountDraft(next, locale) })
  }

  const canDecrease =
    writable && stepGroceryQuantity(quantity, unit, -1) !== null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!writable || saving || !dirty || !title || !amountValid) return
    setSaving(true)
    setError(null)
    try {
      await updateTask({
        taskId: task._id,
        groupSlug,
        ...(title !== task.title ? { title } : {}),
        ...(quantity !== task.quantity ? { quantity: quantity ?? null } : {}),
        ...(unit !== task.unit ? { unit: unit ?? null } : {}),
        ...(draft.aisle !== saved.aisle ? { category: draft.aisle } : {}),
        ...(notes !== saved.notes ? { notes: notes || null } : {}),
      })
      if (draft.staple && !matchingStaple) {
        await addStaple({ groupSlug, name: title })
      } else if (!draft.staple && matchingStaple) {
        await removeStaple({ groupSlug, id: matchingStaple._id })
      }
      const moved = draft.listId !== task.listId
      if (moved) {
        await moveToList({
          taskId: task._id,
          groupSlug,
          listId: draft.listId,
        })
      }
      setEdits({})
      if (moved) {
        leaving.current = true
        onDone()
      }
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = () =>
    confirm({
      title: fmt(g.web.deleteConfirmTitle, { name: task.title }),
      body: g.web.deleteConfirmBody,
      confirmLabel: messages.common.actions.delete,
      run: async () => {
        await removeTask({ taskId: task._id, groupSlug })
        leaving.current = true
        onDone()
      },
    })

  const listOptions = lists.filter(
    (list) => list.writable || list._id === task.listId,
  )
  const addedOn = new Date(task._creationTime).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
  })
  const addedBy = members?.find((member) => member.userId === task.createdBy)

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="grid gap-4 p-4"
      data-testid="grocery-item-editor"
    >
      <DetailPanelHeader
        title={task.title}
        subtitle={
          addedBy
            ? fmt(g.web.addedBy, { name: addedBy.name, date: addedOn })
            : fmt(g.web.addedOn, { date: addedOn })
        }
        level={onClose ? 2 : 1}
        onClose={onClose}
      />

      {error || !amountValid ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-3 py-2 text-footnote font-semibold text-[var(--danger)]"
        >
          {error ?? g.web.invalidAmount}
        </p>
      ) : null}

      <div className="grid gap-1.5">
        <label
          htmlFor={nameId}
          className="text-footnote font-semibold text-[var(--muted)]"
        >
          {g.web.itemName}
        </label>
        <input
          id={nameId}
          type="text"
          value={draft.title}
          disabled={!writable || saving}
          onChange={(event) => edit({ title: event.target.value })}
          className={inputClass}
        />
      </div>

      <div className="grid gap-3 sm:gap-x-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              id={qtyLabelId}
              className="text-footnote font-semibold text-[var(--muted)]"
            >
              {g.amount}
            </span>
            {writable && (draft.amount || draft.unit) ? (
              <button
                type="button"
                onClick={() => edit({ amount: '', unit: '' })}
                className="pointer-coarse:min-h-[var(--size-control-min)] text-footnote font-semibold text-[var(--accent-text)] hover:underline"
              >
                {g.clearAmount}
              </button>
            ) : null}
          </div>
          <div
            role="group"
            aria-labelledby={qtyLabelId}
            className="inline-flex min-h-11 items-center gap-1 justify-self-start rounded-[var(--radius-control)] border border-[var(--control-edge)] bg-[var(--surface)] px-1"
          >
            <button
              type="button"
              disabled={!canDecrease || saving}
              aria-label={g.decrease}
              onClick={() => stepAmount(-1)}
              className="grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-35"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              type="text"
              inputMode="decimal"
              aria-label={g.amount}
              placeholder="1"
              disabled={!writable || saving}
              aria-invalid={!amountValid}
              value={draft.amount}
              onChange={(event) => edit({ amount: event.target.value })}
              className="w-16 border-0 bg-transparent text-center font-rounded text-[16px] font-bold text-[var(--ink)] tabular-nums outline-none"
            />
            <button
              type="button"
              disabled={!writable || saving}
              aria-label={g.increase}
              onClick={() => stepAmount(1)}
              className="grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-35"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={unitId}
            className="text-footnote font-semibold text-[var(--muted)]"
          >
            {g.unit}
          </label>
          <select
            id={unitId}
            disabled={!writable || saving}
            value={draft.unit}
            onChange={(event) =>
              edit({ unit: event.target.value as GroceryUnit | '' })
            }
            className={fieldClass}
          >
            <option value="">{g.web.noUnit}</option>
            {GROCERY_UNITS.map((unitKey) => (
              <option key={unitKey} value={unitKey}>
                {unitOptionLabel(unitKey, g.units)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <label
          htmlFor={aisleId}
          className="text-footnote font-semibold text-[var(--muted)]"
        >
          {g.aisle}
        </label>
        <select
          id={aisleId}
          disabled={!writable || saving}
          value={draft.aisle}
          onChange={(event) => edit({ aisle: event.target.value as GroceryAisle })}
          className={fieldClass}
        >
          {GROCERY_AISLES.map((id) => (
            <option key={id} value={id}>
              {g.aisles[id]}
            </option>
          ))}
        </select>
        <p className="m-0 text-footnote text-[var(--muted)]">
          {fmt(g.web.aisleRememberHint, { name: title || task.title })}
        </p>
      </div>

      {listOptions.length > 1 ? (
        <div className="grid gap-1.5">
          <label
            htmlFor={listIdField}
            className="text-footnote font-semibold text-[var(--muted)]"
          >
            {g.web.itemList}
          </label>
          <select
            id={listIdField}
            disabled={!writable || saving}
            value={draft.listId}
            onChange={(event) => edit({ listId: event.target.value as Id<'taskLists'> })}
            className={fieldClass}
          >
            {listOptions.map((candidate) => (
              <option key={candidate._id} value={candidate._id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <label
          htmlFor={noteId}
          className="text-footnote font-semibold text-[var(--muted)]"
        >
          {g.web.itemNote}
        </label>
        <input
          id={noteId}
          type="text"
          disabled={!writable || saving}
          placeholder={g.web.itemNotePlaceholder}
          value={draft.notes}
          onChange={(event) => edit({ notes: event.target.value })}
          className={inputClass}
        />
      </div>

      <label
        htmlFor={stapleId}
        className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t-[0.5px] border-[var(--hair)] pt-3"
      >
        <span>
          <span className="block text-body font-semibold text-[var(--ink)]">
            {g.web.stapleLabel}
          </span>
          <span className="block text-footnote text-[var(--muted)]">
            {g.web.stapleHint}
          </span>
        </span>
        <input
          id={stapleId}
          type="checkbox"
          role="switch"
          disabled={!writable || saving || staplesData === undefined}
          checked={draft.staple}
          onChange={(event) => edit({ staple: event.target.checked })}
          className="size-5 shrink-0 accent-[var(--accent-text)]"
        />
      </label>

      {writable ? (
        <div className="flex flex-wrap items-center gap-2 border-t-[0.5px] border-[var(--hair)] pt-3">
          <button
            type="submit"
            disabled={!dirty || !title || !amountValid || saving}
            className={buttonClass.primary}
          >
            {saving
              ? messages.common.actions.saving
              : messages.common.actions.save}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (onClose) return onClose()
              setEdits({})
              setError(null)
            }}
            className={buttonClass.secondary}
          >
            {messages.common.actions.cancel}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={confirmDelete}
            className={`${buttonClass.danger} ml-auto`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {messages.common.actions.delete}
          </button>
        </div>
      ) : null}

      {blocker.status === 'blocked' ? (
        <Dialog
          title={g.web.unsavedTitle}
          onClose={blocker.reset}
          role="alertdialog"
          closeButton={false}
          actions={
            <>
              <button
                type="button"
                onClick={blocker.reset}
                className={buttonClass.secondary}
              >
                {g.web.keepEditing}
              </button>
              <button
                type="button"
                onClick={blocker.proceed}
                className={buttonClass.secondaryDanger}
              >
                {g.web.discard}
              </button>
            </>
          }
        >
          <p className="m-0 text-subhead text-[var(--muted)]">
            {g.web.unsavedBody}
          </p>
        </Dialog>
      ) : null}

      {confirmDialog}
    </form>
  )
}

/** The item panel when there is no item to edit: on its way, or gone. */
export function GroceryItemNotice({
  loading,
  deleted,
  onClose,
}: {
  loading: boolean
  deleted: boolean
  onClose?: () => void
}) {
  const messages = useMessages()
  const words = messages.tasks.grocery.web
  return (
    <div className="grid gap-3 p-4" aria-busy={loading}>
      <DetailPanelHeader
        title={words.itemTitle}
        level={onClose ? 2 : 1}
        onClose={onClose}
      />
      <p role="status" className="m-0 text-subhead text-[var(--muted)]">
        {loading
          ? messages.common.errors.loading
          : deleted
            ? words.itemDeleted
            : words.itemNotFound}
      </p>
    </div>
  )
}
