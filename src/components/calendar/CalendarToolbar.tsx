import {
  CALENDAR_VIEWS,
  type CalendarPeopleFilter,
  type CalendarPerson,
  type CalendarView,
} from '@gather/core/calendar'
import { Check, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useMessages } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useMenu } from '../app/useMenu'
import { COLOR_BAR } from './colors'
import type { WebCalendar } from './useCalendar'

const chip =
  'inline-flex min-h-8 pointer-coarse:min-h-[var(--size-control-min)] shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 text-footnote text-[var(--ink)]'

/** Today, the period and its steps; the filters; the view. */
export function CalendarToolbar({
  title,
  view,
  onView,
  onToday,
  onStep,
  calendars,
  hiddenCalendarIds,
  onVisible,
  onManage,
  people,
  peopleFilter,
  onPeople,
}: {
  title: string
  view: CalendarView
  onView: (view: CalendarView) => void
  onToday: () => void
  onStep: (step: 1 | -1) => void
  calendars: readonly WebCalendar[]
  hiddenCalendarIds: readonly string[]
  onVisible: (id: WebCalendar['id'], visible: boolean) => void
  onManage: () => void
  people: readonly CalendarPerson[]
  peopleFilter: CalendarPeopleFilter | null
  onPeople: (filter: CalendarPeopleFilter | null) => void
}) {
  const words = useMessages().calendar
  const period = view === 'week' ? 'week' : 'month'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <div className="flex min-w-0 items-center gap-2 max-lg:order-2 max-lg:w-full">
        <button
          type="button"
          onClick={onToday}
          className={`${buttonClass.small} pointer-coarse:min-h-[var(--size-control-min)]`}
        >
          {words.today}
        </button>
        {([-1, 1] as const).map((step) => {
          const Icon = step === -1 ? ChevronLeft : ChevronRight
          const label = words.web[step === -1 ? 'previous' : 'next'][period]
          return (
            <button
              key={step}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onStep(step)}
              className="inline-grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface)] text-[var(--ink)]"
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          )
        })}
        <p
          aria-live="polite"
          data-testid="period"
          className="m-0 ml-1 min-w-0 truncate text-[17px] font-semibold"
        >
          {title}
        </p>
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-lg:contents">
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset draws its own box and legend */}
        <div
          role="group"
          aria-label={words.web.filters}
          className="flex min-w-0 flex-wrap items-center gap-2 max-lg:order-3 max-lg:w-full"
        >
          {calendars.map((calendar) => {
            const shown = !hiddenCalendarIds.includes(calendar.id)
            return (
              <button
                key={calendar.id}
                type="button"
                aria-pressed={shown}
                onClick={() => onVisible(calendar.id, !shown)}
                className={`${chip} max-w-48 pl-2 ${
                  shown
                    ? 'bg-[var(--surface)]'
                    : 'bg-transparent text-[var(--muted)] line-through inset-ring inset-ring-[var(--control-edge)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-[var(--radius-pill)] ${
                    shown ? COLOR_BAR[calendar.color] : 'bg-[var(--hair-strong)]'
                  }`}
                />
                <span className="truncate">{calendar.name}</span>
              </button>
            )
          })}
          <PeopleMenu
            people={people}
            filter={peopleFilter}
            onChange={onPeople}
          />
          <button
            type="button"
            onClick={onManage}
            className={`${chip} bg-[var(--surface)]`}
          >
            {words.web.manage}
          </button>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset draws its own box and legend */}
        <div
          role="group"
          aria-label={words.web.view}
          className="flex rounded-[var(--radius-pill)] bg-[var(--surface-2)] p-[3px] max-lg:order-1 max-lg:w-full"
        >
          {CALENDAR_VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => onView(option)}
              className={`min-h-[30px] pointer-coarse:min-h-[38px] rounded-[var(--radius-pill)] px-3.5 text-footnote font-semibold text-[var(--ink)] max-lg:flex-1 ${
                view === option ? 'bg-[var(--surface)]' : 'bg-transparent'
              }`}
            >
              {words.views[option]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Whose events show. The filter is the account's, so the phone's shows here. */
function PeopleMenu({
  people,
  filter,
  onChange,
}: {
  people: readonly CalendarPerson[]
  filter: CalendarPeopleFilter | null
  onChange: (filter: CalendarPeopleFilter | null) => void
}) {
  const words = useMessages().calendar
  const menu = useMenu()
  // Somebody who left the Group is refused by the server.
  const chosen = (filter?.userIds ?? []).filter((id) =>
    people.some((person) => person.id === id),
  )
  const withUnassigned = filter?.includeUnassigned ?? false
  const names = [
    ...people.filter(({ id }) => chosen.includes(id)).map(({ name }) => name),
    ...(withUnassigned ? [words.unassigned] : []),
  ]
  const item = (
    key: string,
    label: string,
    checked: boolean,
    next: CalendarPeopleFilter | null,
  ) => (
    <button
      key={key}
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      onClick={() => onChange(next)}
      className="flex min-h-10 pointer-coarse:min-h-[var(--size-control-min)] w-full items-center gap-2 rounded-[var(--radius-control)] bg-transparent px-3 text-left text-subhead hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {checked ? <Check className="size-4" aria-hidden="true" /> : null}
    </button>
  )
  return (
    <span className="relative">
      <button {...menu.button} className={`${chip} bg-[var(--surface)]`}>
        <Users className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="max-w-40 truncate">
          {filter === null
            ? words.web.peopleFilter
            : names.length > 0
              ? names.join(', ')
              : words.filtersActive}
        </span>
      </button>
      {menu.open ? (
        <div
          {...menu.menu}
          aria-label={words.web.peopleFilter}
          className="absolute top-full right-0 z-20 mt-1 grid max-h-80 w-56 overflow-y-auto rounded-[var(--radius-card)] border-[0.5px] border-[var(--hair-strong)] bg-[var(--surface)] p-1.5 max-lg:right-auto max-lg:left-0"
        >
          {item('everyone', words.everyone, filter === null, null)}
          {people.map(({ id, name }) =>
            item(id, name, chosen.includes(id), {
              userIds: chosen.includes(id)
                ? chosen.filter((each) => each !== id)
                : [...chosen, id],
              includeUnassigned: withUnassigned,
            }),
          )}
          {item('unassigned', words.unassigned, withUnassigned, {
            userIds: chosen,
            includeUnassigned: !withUnassigned,
          })}
        </div>
      ) : null}
    </span>
  )
}
