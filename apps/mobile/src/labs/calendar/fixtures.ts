/**
 * A household's month, handwritten.
 *
 * Nothing here is fetched and nothing here is written. The prototype answers a
 * design question (`prototypes/calendar/build-brief.md`), and the five schema
 * changes the real Module needs — `calendars.color`, `calendarEvents.assigneeId`,
 * `updateCalendarEvent`, `allDay`/`location`/`notes`, and a view preference on
 * `memberships` — are all faked below rather than migrated.
 *
 * ## Anchored to today, not to September 2026
 *
 * The canvas drew a fixed month, which is right for a drawing and wrong for
 * something you open on a phone: a calendar whose "today" is eighteen months
 * ago tells you nothing about how today's cell reads, and a fixed day-of-month
 * puts the interesting days behind you for three weeks out of four. So every
 * event is an **offset from today**, and the busy days are always the ones
 * under your thumb when the screen opens.
 *
 * ## What the set is for
 *
 * Every case the canvas argued about, so no variant gets to look good by
 * having nothing hard to draw:
 *
 * - **An event nobody is on** — tomorrow, and the boiler service. This is the
 *   *common* case, not an edge one: `calendarEvents` has no assignee column, so
 *   on the day the real Module ships every event is a dot.
 * - **Three events on one day across two calendars** — the day after tomorrow,
 *   which also overflows the three-mark ceiling and so is the only place `+n`
 *   appears. Today itself has three across three calendars, one of them hidden.
 * - **An all-day event** — yesterday, tomorrow, +2 and +19.
 * - **A title far too long for a row** — the parents' evening at +2.
 * - **An empty stretch** — nothing at all from +3 to +18, which is long enough
 *   to guarantee a completely empty grid row whatever weekday the month starts
 *   on, so an empty week is always on screen.
 * - **A hidden calendar** — Work, off by default, with an event on today, so
 *   hiding is visible the moment the screen opens rather than only after you
 *   go looking.
 */
import type { ModuleGroup } from '@gather/core/module-tints'

import { addDays } from '../../modules/tasks/taskDates'

export interface LabCalendar {
  id: string
  name: string
  /**
   * A Module-tint token name, never a hex. Four of them is the whole palette,
   * which is the ceiling the brief flags and nothing here answers.
   */
  tint: ModuleGroup
}

export interface LabMember {
  id: string
  name: string
  /**
   * `groups.members` returns a name and a standing and nothing else — there is
   * no image field, by design — so a person is an initial and never an avatar.
   * Held rather than derived because two members can share one, and whatever
   * disambiguates Eric from Emma is not designed either.
   */
  initial: string
}

export interface LabEvent {
  id: string
  /** `YYYY-MM-DD`, never an instant. No timezone conversion, anywhere. */
  date: string
  title: string
  calendarId: string
  allDay: boolean
  /** `HH:MM`, absent on an all-day event. */
  start?: string
  end?: string
  /** Member ids. Empty is the common case, not a missing value. */
  who: string[]
  location?: string
}

export const LAB_CALENDARS: LabCalendar[] = [
  { id: 'household', name: 'Household', tint: 'home' },
  { id: 'school', name: 'School', tint: 'kitchen' },
  { id: 'work', name: 'Work', tint: 'tasting' },
]

export const LAB_MEMBERS: LabMember[] = [
  { id: 'eric', name: 'Eric', initial: 'E' },
  { id: 'sanne', name: 'Sanne', initial: 'S' },
  // Mila rather than a second E, because initials collide and nothing in the
  // canvas designed the disambiguation.
  { id: 'mila', name: 'Mila', initial: 'M' },
]

/** Off when the screen opens, so the hidden case is the first thing you see. */
export const LAB_HIDDEN_CALENDAR_IDS = ['work']

interface Seed {
  /** Whole days from today. Negative is behind you, which the agenda skips. */
  offset: number
  title: string
  calendarId: string
  allDay?: boolean
  start?: string
  end?: string
  who?: string[]
  location?: string
}

const SEEDS: Seed[] = [
  {
    offset: -1,
    title: 'First day of school',
    calendarId: 'school',
    allDay: true,
    who: ['mila'],
  },
  {
    offset: 0,
    title: 'Physio',
    calendarId: 'work',
    start: '08:00',
    end: '08:45',
    who: ['sanne'],
  },
  {
    offset: 0,
    title: 'Dentist — Mila',
    calendarId: 'household',
    start: '14:30',
    end: '15:15',
    who: ['sanne', 'mila'],
    location: 'Tandartspraktijk Noord',
  },
  {
    offset: 0,
    title: 'Football training',
    calendarId: 'school',
    start: '18:00',
    end: '19:30',
    who: ['mila'],
  },
  {
    offset: 1,
    title: 'Bins out',
    calendarId: 'household',
    allDay: true,
    who: [],
  },
  {
    offset: 2,
    title: 'Swimming lesson',
    calendarId: 'school',
    start: '16:00',
    end: '16:45',
    who: ['mila'],
  },
  {
    offset: 2,
    title:
      'Parents’ evening about next year’s subject choices and the exam timetable',
    calendarId: 'school',
    start: '19:30',
    end: '21:00',
    who: ['eric', 'sanne'],
  },
  {
    offset: 2,
    title: 'Big shop',
    calendarId: 'household',
    allDay: true,
    who: [],
  },
  {
    offset: 19,
    title: 'Sanne away — Berlin',
    calendarId: 'household',
    allDay: true,
    who: ['sanne'],
  },
  {
    offset: 20,
    title: 'Grandad’s birthday',
    calendarId: 'household',
    start: '15:00',
    who: ['eric', 'sanne', 'mila'],
  },
  {
    offset: 22,
    title: 'Sprint planning',
    calendarId: 'work',
    start: '10:00',
    end: '11:30',
    who: ['eric'],
  },
  {
    offset: 23,
    title: 'Report meeting',
    calendarId: 'school',
    start: '17:00',
    end: '17:20',
    who: ['eric'],
  },
  {
    offset: 26,
    title: 'Boiler service',
    calendarId: 'household',
    start: '11:00',
    end: '13:00',
    who: [],
  },
  {
    offset: 34,
    title: 'Swimming lesson',
    calendarId: 'school',
    start: '16:00',
    end: '16:45',
    who: ['mila'],
  },
]

/**
 * The set, resolved against a day. Pure and parameterised, so a test can ask it
 * what the month looks like when today is the 31st without waiting for one.
 */
export function labEvents(today: string): LabEvent[] {
  return SEEDS.map((seed, index) => {
    return {
      id: `lab-${index}`,
      date: addDays(today, seed.offset),
      title: seed.title,
      calendarId: seed.calendarId,
      allDay: seed.allDay ?? false,
      start: seed.start,
      end: seed.end,
      who: seed.who ?? [],
      location: seed.location,
    }
  })
}
