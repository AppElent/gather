import type { MealSlot } from '@gather/core/meal-planner'
import {
  busyEvent,
  clock,
  dayTitle,
  eatersOf,
  eatingLabel,
  mealIn,
  weekdayName,
} from '@gather/core/week-menu'
import { draftIn } from '@gather/core/week-menu-plan'
import { Link } from '@tanstack/react-router'
import { type DragEvent, useState } from 'react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { useIsDesktop } from '../app/useMediaQuery'
import {
  canMoveTo,
  cardSlots,
  eatingCount,
  type PlannedMeal,
  recordLink,
  type WeekData,
} from './data'
import { useWeekDays, useWorkspace } from './MealPlannerWorkspace'

const DRAG_TYPE = 'application/x-gather-meal'

/** Seven day cards. A meal drags onto another day's slot to move or swap. */
export function WeekGrid({
  selectedId,
  panelOpen,
}: {
  selectedId?: string
  panelOpen: boolean
}) {
  const { data, actions } = useWorkspace()
  const days = useWeekDays()
  const [dragging, setDragging] = useState<PlannedMeal | null>(null)
  if (!data) return null

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] items-start gap-3 ${
        // Beside the open panel two columns only fit from `xl`.
        panelOpen
          ? 'xl:grid-cols-[repeat(2,minmax(0,1fr))]'
          : 'lg:grid-cols-[repeat(2,minmax(0,1fr))]'
      }`}
    >
      {days.map((date) => (
        <DayCard
          key={date}
          date={date}
          data={data}
          selectedId={selectedId}
          dragging={dragging}
          onDragging={setDragging}
          onDrop={(slot) => {
            if (dragging) actions.move(data, dragging, date, slot)
            setDragging(null)
          }}
        />
      ))}
    </div>
  )
}

function DayCard({
  date,
  data,
  selectedId,
  dragging,
  onDragging,
  onDrop,
}: {
  date: string
  data: WeekData
  selectedId?: string
  dragging: PlannedMeal | null
  onDragging: (meal: PlannedMeal | null) => void
  onDrop: (slot: MealSlot) => void
}) {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner.web
  const { today, drafts = [] } = useWorkspace()
  const [over, setOver] = useState<MealSlot | null>(null)
  const slots = cardSlots(data, drafts, date)
  const busy = busyEvent(data.events, date)
  const isToday = date === today
  const sub = [
    isToday ? words.today : null,
    busy
      ? [busy.title, clock(busy.startMinutes)].filter(Boolean).join(' ')
      : null,
  ].filter(Boolean)

  /** The slot a drop here would fill: a row's own, else the meal's slot. */
  const target = (event: DragEvent): MealSlot | null => {
    if (!dragging) return null
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-slot]',
    )
    const slot = (row?.dataset.slot as MealSlot | undefined) ?? dragging.slot
    return canMoveTo(data, dragging, date, slot) ? slot : null
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping is the pointer's shortcut; a meal's "Move to" buttons are the accessible path
    <section
      aria-labelledby={`day-${date}`}
      data-testid={`day-${date}`}
      onDragOver={(event) => {
        const slot = target(event)
        setOver(slot)
        if (!slot) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOver(null)
      }}
      onDrop={(event) => {
        const slot = target(event)
        setOver(null)
        if (!slot) return
        event.preventDefault()
        onDrop(slot)
      }}
      className="min-w-0 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] pt-2.5"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 px-4 pb-1.5">
        <h2
          id={`day-${date}`}
          className={`m-0 text-subhead font-bold ${
            isToday ? 'text-[var(--kitchen-text)]' : 'text-[var(--ink)]'
          }`}
        >
          <span aria-hidden="true">
            {weekdayName(date, locale)} {Number(date.slice(8))}
          </span>
          <span className="sr-only">{dayTitle(date, locale)}</span>
        </h2>
        {sub.length > 0 ? (
          <p
            aria-label={
              busy
                ? [
                    isToday ? words.today : null,
                    fmt(t.mealPlanner.busyLabel, {
                      title: busy.title,
                      time: clock(busy.startMinutes),
                    }),
                  ]
                    .filter(Boolean)
                    .join(', ')
                : undefined
            }
            className="m-0 min-w-0 text-footnote text-[var(--muted)]"
          >
            {sub.join(' · ')}
          </p>
        ) : null}
      </div>
      {slots.length === 0 ? (
        <p className="m-0 border-t-[0.5px] border-[var(--hair)] px-4 py-3 text-footnote text-[var(--muted)]">
          {words.slotsOff}
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {slots.map((slot) => (
            <SlotRow
              key={slot}
              date={date}
              slot={slot}
              data={data}
              selectedId={selectedId}
              dropping={over === slot}
              dragged={dragging}
              onDragging={onDragging}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SlotRow({
  date,
  slot,
  data,
  selectedId,
  dropping,
  dragged,
  onDragging,
}: {
  date: string
  slot: MealSlot
  data: WeekData
  selectedId?: string
  dropping: boolean
  dragged: PlannedMeal | null
  onDragging: (meal: PlannedMeal | null) => void
}) {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const { week, drafts = [], open } = useWorkspace()
  const desktop = useIsDesktop()
  const meal = mealIn(data.meals, date, slot)
  const draft = meal ? undefined : draftIn(drafts, date, slot)
  const record = meal ?? draft
  const selected = record !== undefined && record._id === selectedId
  const day = dayTitle(date, locale)
  const count = eatingCount(data, date, slot, meal)
  const eaters = eatersOf(data, date, slot, meal?.eaterIds)
  const rowClass =
    'flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)] pointer-coarse:min-h-[var(--size-row-min)]'
  const label = (
    <span className="w-[72px] shrink-0 text-footnote text-[var(--muted)]">
      {words.slots[slot]}
    </span>
  )

  return (
    <li
      data-slot={slot}
      draggable={Boolean(meal)}
      onDragStart={(event) => {
        if (!meal) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(DRAG_TYPE, meal._id)
        onDragging(meal)
      }}
      onDragEnd={() => onDragging(null)}
      className={`border-t-[0.5px] border-[var(--hair)] ${
        selected ? 'bg-[var(--surface-2)]' : ''
      } ${
        dropping
          ? 'bg-[var(--surface-2)] outline-2 outline-offset-[-2px] outline-[var(--kitchen-text)] outline-dashed'
          : ''
      } ${meal ? 'cursor-grab' : ''} ${
        meal && dragged?._id === meal._id ? 'opacity-50' : ''
      }`}
    >
      {record ? (
        <Link
          {...recordLink(
            { kind: meal ? 'meal' : 'draft', id: record._id },
            week,
            desktop,
          )}
          draggable={false}
          aria-current={selected ? 'true' : undefined}
          aria-label={
            meal
              ? `${fmt(words.web.rowLabel, {
                  slot: words.slots[slot],
                  day,
                  title: record.title,
                })}. ${eatingLabel(data.members, eaters, words, locale)}`
              : fmt(words.web.draftRowLabel, {
                  slot: words.slots[slot],
                  day,
                  title: record.title,
                })
          }
          className={rowClass}
        >
          {label}
          <span
            className={`min-w-0 flex-1 text-subhead break-words ${
              selected ? 'font-semibold' : ''
            } ${draft ? 'italic' : ''}`}
          >
            {record.title}
          </span>
          {draft ? (
            <span className="shrink-0 rounded-[var(--radius-pill)] border border-dashed border-[var(--kitchen-text)] px-2 py-0.5 text-xs font-semibold text-[var(--kitchen-text)]">
              {words.web.pill}
            </span>
          ) : null}
          <span
            title={plural(locale, count, words.people)}
            className="shrink-0 text-footnote text-[var(--muted)] tabular-nums"
          >
            {count}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          aria-label={fmt(words.web.chooseSomethingLabel, {
            slot: words.slots[slot],
            day,
          })}
          onClick={() => open({ kind: 'pick', date, slot })}
          className={`${rowClass} cursor-pointer border-0 bg-transparent`}
        >
          {label}
          <span className="text-subhead text-[var(--muted)]">
            {words.web.chooseSomething}
          </span>
        </button>
      )}
    </li>
  )
}
