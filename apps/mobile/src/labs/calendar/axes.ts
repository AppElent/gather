/**
 * The three things the canvas decided that a phone can still disagree with.
 *
 * Each is an axis rather than a whole screen, because the answer worth having
 * is usually a mix — see `../variants.ts`. The `chosen` option on each is the
 * canvas verdict from `prototypes/calendar/build-brief.md`, and it is also the
 * default, so the screen opens on the decided design.
 */
import type { Messages } from '../../i18n'
import type { VariantAxis } from '../variants'

/** How you change what the screen is showing. */
export type NavVariant = 'menu' | 'segmented' | 'fluid'
/** What a month cell says about a day. */
export type CellVariant = 'marks' | 'bars'
/** How you add an event. */
export type ComposerVariant = 'card' | 'sheet' | 'inline'

export const CALENDAR_VIEWS = ['month', 'week', 'agenda'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export function navAxis(t: Messages): VariantAxis<NavVariant> {
  return {
    id: 'nav',
    label: t.labs.calendar.axes.nav,
    options: [
      // The verdict: iOS's own "how should this be displayed" control.
      { value: 'menu', label: t.labs.calendar.axes.navMenu, chosen: true },
      // Always visible, one tap, and permanently spending a strip of the screen.
      { value: 'segmented', label: t.labs.calendar.axes.navSegmented },
      // The canvas deferred this one to a real device, in as many words: the
      // month and the week become a drag rather than a choice, and the view
      // menu stops existing.
      { value: 'fluid', label: t.labs.calendar.axes.navFluid },
    ],
  }
}

export function cellAxis(t: Messages): VariantAxis<CellVariant> {
  return {
    id: 'cell',
    label: t.labs.calendar.axes.cell,
    options: [
      { value: 'marks', label: t.labs.calendar.axes.cellMarks, chosen: true },
      // The other answer in the room: a bar per event, tinted by its calendar.
      // Says how many and whose calendar, says nothing at all about who.
      { value: 'bars', label: t.labs.calendar.axes.cellBars },
    ],
  }
}

export function composerAxis(t: Messages): VariantAxis<ComposerVariant> {
  return {
    id: 'composer',
    label: t.labs.calendar.axes.composer,
    options: [
      { value: 'card', label: t.labs.calendar.axes.composerCard, chosen: true },
      // The house style: every other property in this app is edited in a
      // `NativeSheet`, and a calendar event being the exception needs an
      // argument the card has to win on a device.
      { value: 'sheet', label: t.labs.calendar.axes.composerSheet },
      // The Tasks list's own composer — one line, return commits, everything
      // else set afterwards by opening what you just made.
      { value: 'inline', label: t.labs.calendar.axes.composerInline },
    ],
  }
}
