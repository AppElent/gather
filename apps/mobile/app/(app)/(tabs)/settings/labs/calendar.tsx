/**
 * The Calendar prototype's route.
 *
 * The variant axes live in the search params rather than in state, so a
 * combination is a link: a Labs row points at one, going back returns to one,
 * and rotating the phone does not lose it. `readAxis` falls back to whichever
 * option the canvas chose, so the bare route shows the decided design.
 */
import { router, useLocalSearchParams } from 'expo-router'
import { useI18n } from '../../../../../src/i18n'
import {
  type CellVariant,
  type ComposerVariant,
  cellAxis,
  composerAxis,
  type NavVariant,
  navAxis,
} from '../../../../../src/labs/calendar/axes'
import { CalendarLab } from '../../../../../src/labs/calendar/CalendarLab'
import {
  LAB_CALENDARS,
  LAB_MEMBERS,
  labEvents,
} from '../../../../../src/labs/calendar/fixtures'
import { VariantBar } from '../../../../../src/labs/VariantBar'
import { readAxis } from '../../../../../src/labs/variants'
import { CalendarScreen } from '../../../../../src/modules/calendar/CalendarScreen'

export default function CalendarLabRoute() {
  const { t } = useI18n()
  const params = useLocalSearchParams<{
    nav?: string
    cell?: string
    composer?: string
    production?: string
  }>()

  if (params.production === 'true') {
    const today = new Date().toISOString().slice(0, 10)
    const events = labEvents(today).map((event) => ({
      id: event.id,
      calendarId: event.calendarId,
      title: event.title,
      date: event.date,
      allDay: event.allDay,
      startMinutes: event.start
        ? Number(event.start.slice(0, 2)) * 60 + Number(event.start.slice(3))
        : undefined,
      endMinutes: event.end
        ? Number(event.end.slice(0, 2)) * 60 + Number(event.end.slice(3))
        : undefined,
      assigneeIds: event.who,
      location: event.location ?? '',
      notes: '',
      revision: 0,
      color:
        LAB_CALENDARS.find((calendar) => calendar.id === event.calendarId)
          ?.tint ?? 'home',
    }))
    return (
      <CalendarScreen
        today={today}
        data={{
          calendars: LAB_CALENDARS.map(({ id, name, tint }) => ({
            id,
            name,
            color: tint,
          })),
          people: LAB_MEMBERS,
          hiddenCalendarIds: ['work'],
          events,
        }}
      />
    )
  }

  const nav = navAxis(t)
  const cell = cellAxis(t)
  const composer = composerAxis(t)

  const current = {
    nav: readAxis(nav, params.nav),
    cell: readAxis(cell, params.cell),
    composer: readAxis(composer, params.composer),
  }

  const set = (key: 'nav' | 'cell' | 'composer') => (value: string) =>
    router.setParams({ ...current, [key]: value })

  return (
    <>
      <CalendarLab
        // Remounted per nav variant on purpose: swapping between a dragged
        // header and a menu mid-gesture leaves the shared value wherever the
        // finger left it, and a prototype that opens half-collapsed teaches
        // nothing about either.
        key={current.nav}
        nav={current.nav as NavVariant}
        cell={current.cell as CellVariant}
        composer={current.composer as ComposerVariant}
      />
      <VariantBar
        axes={[
          { axis: nav, value: current.nav, onChange: set('nav') },
          { axis: cell, value: current.cell, onChange: set('cell') },
          {
            axis: composer,
            value: current.composer,
            onChange: set('composer'),
          },
        ]}
      />
    </>
  )
}
