import {
  addGroceryAmounts,
  capitalise,
  formatGroceryAmount,
  GROCERY_AISLES,
  type GroceryAisle,
  type GroceryCompletion,
  type GroceryHabit,
  groceryAddFields,
  groceryCadence,
  groceryCompletions,
  groceryNames,
  parseGroceryLine,
  typedSpan,
} from '@gather/core/groceries'
import { stockKey } from '@gather/core/grocery-list'
import { useMutation } from 'convex/react'
import { BookOpen, ChevronDown, Clock, Plus } from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useMenu } from '../app/useMenu'
import { fieldClass } from '../recipes/fields'
import { useRecognisedAisle } from './useRecipeLines'

export interface GroceryAddFormProps {
  groupSlug: string
  listId: Id<'taskLists'>
  tasks: readonly Doc<'tasks'>[]
  habits: readonly GroceryHabit[]
}

/**
 * Top-of-list inline grocery add form (APP-316, `designs/groceries/web.md`):
 * local amount/unit/aisle recognition chips, clickable aisle override menu,
 * history and dictionary autocomplete with keyboard navigation. A suggestion
 * for an item already open adds the typed amount to it.
 */
export function GroceryAddForm({
  groupSlug,
  listId,
  tasks,
  habits,
}: GroceryAddFormProps) {
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const addTask = useMutation(api.tasks.add)
  const updateTask = useMutation(api.tasks.update)
  const errorText = useErrorMessage()

  const [typed, setTyped] = useState('')
  const [chosenAisle, setChosenAisle] = useState<GroceryAisle | undefined>()
  const aisleMenu = useMenu()
  const [activeIndex, setActiveIndex] = useState(-1)
  const [listOpen, setListOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const listboxId = useId()

  const trimmed = typed.trim()
  const fields = useMemo(
    () => (trimmed ? groceryAddFields(trimmed) : null),
    [trimmed],
  )
  const detectedAisle = useRecognisedAisle(groupSlug, listId, trimmed)
  const aisle = chosenAisle ?? detectedAisle

  const completions = useMemo(
    () => (trimmed ? groceryCompletions(trimmed, habits, groceryNames()) : []),
    [trimmed, habits],
  )
  const showListbox = listOpen && completions.length > 0

  const amountText = (
    quantity: number | undefined,
    unit: Doc<'tasks'>['unit'],
  ) => formatGroceryAmount(quantity, unit, locale, g.units)

  const cadenceText = (intervalDays: number) => {
    const cadence = groceryCadence(intervalDays)
    const words = g.suggestions.cadence
    return 'count' in cadence
      ? fmt(words[cadence.unit], { count: cadence.count })
      : words[cadence.unit]
  }

  const openNamed = (key: string) =>
    tasks.find(
      (task) => !task.done && stockKey(task.title) === key,
    )

  const typedParsed = useMemo(() => parseGroceryLine(typed), [typed])
  const typedAmount =
    typedParsed.quantity !== null || typedParsed.unit !== null
      ? {
          ...(typedParsed.quantity !== null
            ? { quantity: typedParsed.quantity }
            : {}),
          ...(typedParsed.unit !== null ? { unit: typedParsed.unit } : {}),
        }
      : undefined

  const clearInput = () => {
    setTyped('')
    setChosenAisle(undefined)
    aisleMenu.close(false)
    setListOpen(false)
    setActiveIndex(-1)
  }

  const commitItem = async (item: {
    title: string
    quantity?: number
    unit?: Doc<'tasks'>['unit']
    mergeAmount?: { quantity?: number; unit?: Doc<'tasks'>['unit'] }
    open?: Doc<'tasks'>
  }) => {
    const line = typed
    const aisleChoice = chosenAisle
    setError(null)
    // Cleared at once, so the next line can be typed while this one saves.
    clearInput()
    inputRef.current?.focus()
    try {
      let taskId = item.open?._id
      if (item.open) {
        if (item.mergeAmount) {
          await updateTask({
            taskId: item.open._id,
            groupSlug,
            quantity: item.mergeAmount.quantity ?? null,
            unit: item.mergeAmount.unit ?? null,
          })
        }
      } else {
        taskId = await addTask({
          listId,
          groupSlug,
          title: item.title,
          ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
          ...(item.unit !== undefined ? { unit: item.unit } : {}),
        })
      }
      // The item is on the list by now: a failed aisle choice alone must not
      // put the line back to be added twice.
      if (aisleChoice && taskId)
        await updateTask({ taskId, groupSlug, category: aisleChoice }).catch(
          (caught) =>
            setError(errorText(caught, messages.common.errors.didNotWork)),
        )
    } catch (caught) {
      setError(errorText(caught, messages.common.errors.didNotWork))
      // Back for another try, unless the next line is already being typed.
      setTyped((current) => current || line)
      setChosenAisle((current) => current ?? aisleChoice)
    }
  }

  const itemOfCompletion = (completion: GroceryCompletion) => {
    if (completion.source === 'history') {
      const { habit } = completion
      return {
        key: habit.key,
        title: habit.title,
        ...(typedAmount ?? { quantity: habit.quantity, unit: habit.unit }),
      }
    }
    return {
      key: completion.name.key,
      title: capitalise(completion.name.name),
      ...typedAmount,
    }
  }

  const pickCompletion = (completion: GroceryCompletion) => {
    const item = itemOfCompletion(completion)
    const open = openNamed(item.key)
    const merged =
      open && typedAmount
        ? addGroceryAmounts(
            {
              ...(open.quantity !== undefined ? { quantity: open.quantity } : {}),
              ...(open.unit !== undefined ? { unit: open.unit } : {}),
            },
            typedAmount,
          )
        : null
    void commitItem({
      title: item.title,
      quantity: item.quantity,
      unit: item.unit,
      open,
      mergeAmount: merged ?? undefined,
    })
  }

  const submitTyped = (event: FormEvent) => {
    event.preventDefault()
    if (showListbox && activeIndex >= 0 && completions[activeIndex]) {
      pickCompletion(completions[activeIndex])
      return
    }
    if (!fields?.title) return
    // As on the phone: a typed line is a new item; only a suggestion picked
    // from the list adds to an item already open.
    void commitItem({
      title: capitalise(fields.title),
      quantity: fields.quantity,
      unit: fields.unit,
    })
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showListbox) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) =>
        current < completions.length - 1 ? current + 1 : 0,
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) =>
        current > 0 ? current - 1 : completions.length - 1,
      )
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setListOpen(false)
      setActiveIndex(-1)
    }
  }

  const parsedAmount = fields
    ? amountText(fields.quantity, fields.unit)
    : null

  return (
    <form
      onSubmit={submitTyped}
      className="relative grid gap-2 rounded-[var(--radius-card)] bg-[var(--surface)] p-3.5"
    >
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {g.web.addLabel}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={typed}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showListbox}
          aria-controls={showListbox ? listboxId : undefined}
          aria-activedescendant={
            showListbox && activeIndex >= 0
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
          placeholder={g.web.addPlaceholder}
          onFocus={() => setListOpen(true)}
          onBlur={() => setListOpen(false)}
          onChange={(event) => {
            setTyped(event.target.value)
            setChosenAisle(undefined)
            setActiveIndex(-1)
            setListOpen(true)
          }}
          onKeyDown={onInputKeyDown}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={!trimmed}
          aria-label={messages.common.actions.add}
          className={`${buttonClass.primary} shrink-0 max-lg:w-[var(--size-control-min)] max-lg:px-0`}
        >
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
          <span className="hidden lg:inline">
            {messages.common.actions.add}
          </span>
        </button>
      </div>

      {fields ? (
        <div
          className="flex flex-wrap items-center gap-1.5 text-footnote"
          data-testid="grocery-recognised"
        >
          <span className="text-[var(--muted)]">{g.web.recognisedLabel}</span>
          {parsedAmount ? (
            <span className="inline-flex min-h-7 items-center rounded-[var(--radius-pill)] bg-[var(--kitchen-wash)] px-2.5 font-bold text-[var(--kitchen-text)] tabular-nums">
              {parsedAmount}
            </span>
          ) : null}
          <span className="inline-flex min-h-7 items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-2.5 font-semibold text-[var(--ink)]">
            {capitalise(fields.title)}
          </span>
          <span className="relative inline-flex">
            <button
              {...aisleMenu.button}
              aria-label={`${g.aisle}: ${g.aisles[aisle]}`}
              className="inline-flex min-h-7 pointer-coarse:min-h-[var(--size-control-min)] items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--kitchen-wash)] px-2.5 font-semibold text-[var(--kitchen-text)] hover:opacity-85"
            >
              <span>{g.aisles[aisle]}</span>
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
            {aisleMenu.open ? (
              <div
                {...aisleMenu.menu}
                aria-label={g.aisle}
                className="absolute top-full left-0 z-30 mt-1 grid max-h-64 min-w-52 overflow-y-auto rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] p-1 shadow-lg"
              >
                {GROCERY_AISLES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={id === aisle}
                    onClick={() => {
                      setChosenAisle(id)
                      aisleMenu.close(false)
                      inputRef.current?.focus()
                    }}
                    className={`flex min-h-9 pointer-coarse:min-h-[var(--size-control-min)] items-center justify-between gap-2 rounded-[8px] px-3 text-left text-subhead ${
                      id === aisle
                        ? 'bg-[var(--surface-2)] font-semibold text-[var(--ink)]'
                        : 'text-[var(--ink)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span>{g.aisles[id]}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </span>
          <span className="text-[var(--muted)]">{g.web.enterAdds}</span>
        </div>
      ) : (
        <p className="m-0 px-0.5 text-footnote text-[var(--muted)]">
          {g.web.addHint}
        </p>
      )}

      {showListbox ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={g.web.addLabel}
          className="m-0 list-none rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] p-1"
        >
          {completions.map((completion, index) => {
            const item = itemOfCompletion(completion)
            const open = openNamed(item.key)
            const merged =
              open && typedAmount
                ? addGroceryAmounts(
                    {
                      ...(open.quantity !== undefined
                        ? { quantity: open.quantity }
                        : {}),
                      ...(open.unit !== undefined ? { unit: open.unit } : {}),
                    },
                    typedAmount,
                  )
                : null
            const base =
              completion.source === 'dictionary'
                ? `${g.suggestions.dictionary} · ${g.aisles[completion.name.aisle]}`
                : completion.habit.intervalDays !== null
                  ? fmt(g.suggestions.often, {
                      cadence: cadenceText(completion.habit.intervalDays),
                    })
                  : completion.habit.category
                    ? `${g.suggestions.history} · ${g.aisles[completion.habit.category]}`
                    : g.suggestions.history
            const openAmount = open
              ? amountText(open.quantity, open.unit)
              : null
            const subtitle = open
              ? `${base} · ${
                  openAmount
                    ? fmt(g.suggestions.onListAmount, { amount: openAmount })
                    : g.suggestions.onList
                }`
              : base
            const trailingAmount = open
              ? merged && typedAmount
                ? `+${amountText(typedAmount.quantity, typedAmount.unit) ?? '1'}`
                : null
              : amountText(item.quantity, item.unit)
            const span = typedSpan(item.title, typed)
            const active = index === activeIndex

            return (
              <li
                key={`${completion.source}-${item.key}`}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={active}
                onMouseDown={(event) => {
                  event.preventDefault()
                  pickCompletion(completion)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] px-3 py-1.5 ${
                  active ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                {completion.source === 'history' ? (
                  <Clock
                    className="size-4 shrink-0 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                ) : (
                  <BookOpen
                    className="size-4 shrink-0 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-[var(--ink)]">
                    {span ? (
                      <>
                        {item.title.slice(0, span[0])}
                        <strong className="font-semibold">
                          {item.title.slice(span[0], span[1])}
                        </strong>
                        {item.title.slice(span[1])}
                      </>
                    ) : (
                      item.title
                    )}
                  </span>
                  <span className="block truncate text-footnote text-[var(--muted)]">
                    {subtitle}
                  </span>
                </span>
                {trailingAmount ? (
                  <span className="shrink-0 text-subhead font-bold text-[var(--ink)] tabular-nums">
                    {trailingAmount}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="m-0 text-footnote font-semibold text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}
